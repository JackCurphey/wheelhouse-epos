// screens: cw-list, cw-new, cw-quote, cw-email, cw-order
// Cycle to Work orders and quotes (openspec/changes/cycle-to-work, design 2,
// 3 and 7; tasks 3.1–3.8). Anyone signed in sees the list, makes quotes and
// marks a customer applied (design 7); what the provider is expected to pay
// and the owed totals go only to someone who can see costs (canSeeCosts).
// Staff routes: a handler gets (req, res, params, query, afterRelease, shopId)
// with the shop's row-level security already bound.
import { randomBytes } from 'node:crypto';
import { canSeeCosts } from '../lib/can-see-costs.js';
import { currentSession } from '../lib/session.js';
import { dbExec, prepare } from '../db.js';
import { currentMoment, isDay } from '../clock.js';
import { EMAIL_RE } from '../auth.js';
import { badRequest, notFound, readJsonBody, sendJson, ValidationError } from '../lib/http.js';
import { sendEmailTo } from '../messaging/engine.js';
import { oldestSite } from '../lib/stock.js';
import { CHECK_IN_FIRST, siteHere, whoIsBooking } from './purchase-orders.js';
import {
  GROUPS, ORDER_SELECT, PAID_SHOWN_DAYS, Refused, addDays, addEvent, emailClosing, eventsOf, nextFor,
  quoteClosing, quoteItems, quoteRef, readyToOrder, serializeOrder, shopDay, takeStep,
} from '../c2w/orders.js';

const db = { prepare, exec: dbExec };
const EMAILS_PER_HOUR = 5;
const SETTINGS_NEEDED = { error: 'Set how long quotes are valid and how long bikes are held in Settings › Cycle to Work first', code: 'settings_needed' };

// BEGIN, the change, COMMIT; a refusal rolls back.
async function save(res, status, change) {
  let reply;
  await db.exec('BEGIN');
  try {
    reply = await change();
    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK').catch(() => {});
    if (err instanceof ValidationError) return badRequest(res, err.message);
    if (err instanceof Refused) return sendJson(res, err.status, err.body);
    throw err;
  }
  sendJson(res, status, reply);
}

const settingsRow = async () => {
  await db.prepare('INSERT INTO c2w_settings DEFAULT VALUES ON CONFLICT (shop_id) DO NOTHING RETURNING shop_id').run();
  return db.prepare('SELECT * FROM c2w_settings').get();
};
const loadOrder = (id) => (Number.isInteger(id) ? db.prepare(`${ORDER_SELECT} WHERE o.id = ?`).get(id) : null);

function wholeId(v, label) {
  if (!Number.isInteger(v) || v < 1) throw new ValidationError(`Choose ${label}`);
  return v;
}
function optionalWords(v, label, max) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') throw new ValidationError(`${label} is words`);
  const s = v.trim();
  if (s.length > max) throw new ValidationError(`${label} is up to ${max} characters`);
  return s || null;
}

// The list's top line and the sidebar's number (design, decided while building 4).
function countsFor(rows, settings, today, costs) {
  const active = rows.filter((r) => r.stage === 'quote' || r.stage === 'waiting');
  const soon = addDays(today, settings.remind_days ?? 0);
  const counts = {
    holdEndingSoon: active.filter((r) => r.hold_until_day && r.hold_until_day >= today && r.hold_until_day <= soon).length,
    holdEnded: active.filter((r) => r.hold_until_day && r.hold_until_day < today).length,
    readyToOrder: rows.filter((r) => readyToOrder(r, settings.order_rule)).length,
    paymentLate: rows.filter((r) => r.stage === 'collected' && r.expected_by_day && r.expected_by_day < today).length,
  };
  const count = counts.holdEndingSoon + counts.holdEnded + counts.readyToOrder + counts.paymentLate;
  if (costs) {
    const owed = (r) => Math.max(0, (r.expected_pence ?? 0) - (r.paid_pence ?? 0));
    const collected = rows.filter((r) => r.stage === 'collected');
    counts.owedPence = collected.reduce((s, r) => s + owed(r), 0);
    counts.owedLate = collected.filter((r) => r.expected_by_day && r.expected_by_day < today).reduce((s, r) => s + owed(r), 0);
  }
  return { counts, count };
}
async function listRows(today) {
  return db.prepare(`${ORDER_SELECT} WHERE o.stage IN ('quote', 'waiting', 'certificate', 'ready', 'collected')
    OR (o.stage = 'paid' AND o.paid_on >= ?) ORDER BY o.id`).all(addDays(today, -PAID_SHOWN_DAYS));
}

export function register(route) {
  route('GET', '/api/c2w/orders', async (req, res) => {
    const costs = await canSeeCosts(req);
    const [settings, today] = [await settingsRow(), await shopDay()];
    const rows = await listRows(today);
    const groups = Object.fromEntries(Object.entries(GROUPS).map(([g, stages]) => [g, rows.filter((r) => stages.includes(r.stage))
      .map((r) => ({ ...serializeOrder(r, costs), next: nextFor(r, settings.order_rule, today) }))]));
    const providers = (await db.prepare('SELECT count(*)::int AS n FROM c2w_providers WHERE retired_at IS NULL').get()).n;
    sendJson(res, 200, { groups, ...countsFor(rows, settings, today, costs), providers });
  });

  route('GET', '/api/c2w/count', async (req, res) => {
    const [settings, today] = [await settingsRow(), await shopDay()];
    sendJson(res, 200, { count: countsFor(await listRows(today), settings, today, false).count });
  });

  route('POST', '/api/c2w/orders', async (req, res) => {
    const body = await readJsonBody(req);
    const who = await whoIsBooking(req);
    if (!who) return sendJson(res, 409, CHECK_IN_FIRST);
    const costs = await canSeeCosts(req);
    const site = (await siteHere(req)) ?? (await oldestSite());
    await save(res, 201, async () => {
      const customerId = wholeId(body.customerId, 'the customer');
      const providerId = wholeId(body.providerId, 'the scheme provider');
      const productId = wholeId(body.productId, 'the bike');
      const accessoryIds = body.accessoryIds ?? [];
      if (!Array.isArray(accessoryIds) || accessoryIds.length > 20) throw new ValidationError('Choose up to 20 accessories');
      accessoryIds.forEach((a) => wholeId(a, 'an accessory'));
      const hold = body.hold ?? true;
      if (typeof hold !== 'boolean') throw new ValidationError('Hold is yes or no');

      if (!(await db.prepare('SELECT 1 FROM customers WHERE id = ?').get(customerId))) throw new ValidationError('Choose the customer');
      const provider = await db.prepare('SELECT retired_at FROM c2w_providers WHERE id = ?').get(providerId);
      if (!provider) throw new ValidationError('Choose the scheme provider');
      if (provider.retired_at) throw new Refused(400, { error: 'This provider is retired. Choose another.', code: 'retired_provider' });
      const bike = await db.prepare('SELECT id, price_pence FROM products WHERE id = ?').get(productId);
      if (!bike) throw new ValidationError('Choose the bike');
      const extras = [];
      for (const id of accessoryIds) {
        const p = await db.prepare('SELECT id, name, price_pence FROM products WHERE id = ?').get(id);
        if (!p) throw new ValidationError('Choose the accessories from the shop’s products');
        extras.push({ productId: p.id, name: p.name, pricePence: p.price_pence });
      }

      // The shop's counter, taken under the row's lock: two quotes never share a number.
      await settingsRow();
      const s = await db.prepare('UPDATE c2w_settings SET next_quote_number = next_quote_number + 1 RETURNING *, next_quote_number - 1 AS taken').get();
      if (s.quote_valid_days === null || (hold && s.hold_days === null)) throw new Refused(409, SETTINGS_NEEDED);
      const today = await shopDay();
      const total = bike.price_pence + extras.reduce((sum, a) => sum + a.pricePence, 0);
      const { id } = await db.prepare(`INSERT INTO c2w_orders (customer_id, provider_id, site_id, product_id, quote_number, quote_given_at,
        valid_until, hold_until, hold_wanted, accessories, total_pence, customer_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?) RETURNING id`).get(
        customerId, providerId, site, productId, s.taken, currentMoment().toISOString(),
        addDays(today, s.quote_valid_days), hold ? addDays(today, s.hold_days) : null, hold, JSON.stringify(extras), total,
        randomBytes(32).toString('hex'),
      );
      await addEvent(id, 'quote_given', who, { detail: { quoteRef: quoteRef(s.taken) } });
      return { order: serializeOrder(await loadOrder(id), costs) };
    });
  });

  route('GET', '/api/c2w/orders/:id', async (req, res, params) => {
    const row = await loadOrder(Number(params.id));
    if (!row) return notFound(res);
    sendJson(res, 200, { order: { ...serializeOrder(row, await canSeeCosts(req)), events: await eventsOf(row.id) } });
  });

  // What the printed quote shows (cw-quote).
  route('GET', '/api/c2w/orders/:id/quote', async (req, res, params) => {
    const row = await loadOrder(Number(params.id));
    if (!row) return notFound(res);
    const shop = await db.prepare(`SELECT s.name, s.address, s.phone, s.email, s.vat_number, ss.logo_url
      FROM shops s LEFT JOIN storefront_settings ss ON ss.shop_id = s.id WHERE s.id = current_setting('app.current_shop_id')::int`).get();
    const settings = await settingsRow();
    const tz = (await db.prepare('SELECT time_zone FROM workshop_settings LIMIT 1').get())?.time_zone || 'Europe/London';
    const day = (t) => (t ? new Date(t).toLocaleDateString('en-CA', { timeZone: tz }) : null);
    sendJson(res, 200, {
      quote: {
        shop: { name: shop.name, address: shop.address, phone: shop.phone, email: shop.email, vatNumber: shop.vat_number, logoUrl: shop.logo_url ?? null },
        quoteRef: quoteRef(row.quote_number), givenOn: day(row.quote_given_at), revisedOn: day(row.quote_revised_at), validUntil: row.valid_until_day,
        customerName: row.customer_name, providerName: row.provider_name,
        items: quoteItems(row), totalPence: row.total_pence, closing: quoteClosing(row), howToApply: settings.how_to_apply,
      },
    });
  });

  // Email the quote (cw-email): queued like a receipt, five an hour for one customer.
  route('POST', '/api/c2w/orders/:id/email-quote', async (req, res, params) => {
    const body = await readJsonBody(req);
    const row = await loadOrder(Number(params.id));
    if (!row) return notFound(res);
    const to = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : row.customer_email;
    if (!to || !EMAIL_RE.test(to)) return sendJson(res, 400, { error: 'Type an email address, like name@example.com', code: 'bad_address' });
    const { n } = await db.prepare("SELECT count(*)::int AS n FROM customer_messages WHERE customer_id = ? AND template_key = 'c2w_quote' AND created_at > now() - interval '1 hour'").get(row.customer_id);
    if (n >= EMAILS_PER_HOUR) return sendJson(res, 429, { error: 'This quote has been emailed five times in the last hour. Try again later.', code: 'too_many' });
    const who = (await whoIsBooking(req)) ?? { employeeId: null, name: null };
    const settings = await settingsRow();
    const first = row.customer_name.split(/\s+/)[0];
    const text = [
      `Hi ${first}, here’s your quote ${quoteRef(row.quote_number)} for ${row.bike_name}, for your Cycle to Work scheme through ${row.provider_name}.`,
      emailClosing(row),
      settings.how_to_apply ? `How to apply: ${settings.how_to_apply}` : null,
    ].filter(Boolean).join('\n\n');
    const ctx = await currentSession(req);
    await save(res, 200, async () => {
      await sendEmailTo({ to, subject: 'Your Cycle to Work quote', body: text, customerId: row.customer_id, loginId: ctx.login.id, templateKey: 'c2w_quote' });
      await addEvent(row.id, 'quote_emailed', who, { detail: { to } });
      return { sent: true, to };
    });
  });

  // Mark applied (cw-applied): the customer has applied through their employer.
  route('POST', '/api/c2w/orders/:id/applied', async (req, res, params) => {
    const body = await readJsonBody(req);
    const who = await whoIsBooking(req);
    if (!who) return sendJson(res, 409, CHECK_IN_FIRST);
    const costs = await canSeeCosts(req);
    const id = Number(params.id);
    await save(res, 200, async () => {
      const today = await shopDay();
      const appliedOn = body.appliedOn ?? today;
      if (!isDay(appliedOn) || appliedOn > today) throw new ValidationError('Applied on is a date, today or earlier');
      const employer = optionalWords(body.employer, 'The employer', 120);
      const reference = optionalWords(body.reference, 'The application reference', 60);
      const detail = { appliedOn, ...(employer ? { employer } : {}), ...(reference ? { reference } : {}) };
      // Noon UTC is the same day in the UK all year round.
      await takeStep(id, 'applied', who, () => ({ applied_at: `${appliedOn}T12:00:00Z`, application_reference: reference }), { detail });
      return { order: serializeOrder(await loadOrder(id), costs) };
    });
  });
}

