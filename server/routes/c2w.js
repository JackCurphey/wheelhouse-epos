// screens: cw-list, cw-new, cw-quote, cw-email, cw-order
// Cycle to Work orders and quotes (openspec/changes/cycle-to-work, design 2,
// 3 and 7; tasks 3.1–3.8). Anyone signed in sees the list, makes quotes and
// marks a customer applied (design 7). Everyone sees what the provider is
// expected to pay (decision H3); the owed totals go only to someone who can
// see costs (canSeeCosts; decision M6).
// Staff routes: a handler gets (req, res, params, query, afterRelease, shopId)
// with the shop's row-level security already bound.
import { randomBytes } from 'node:crypto';
import { canSeeCosts } from '../lib/can-see-costs.js';
import { currentSession } from '../lib/session.js';
import { dbExec, prepare } from '../db.js';
import { currentMoment, isDay, shopToday } from '../clock.js';
import { EMAIL_RE } from '../auth.js';
import { badRequest, notFound, readJsonBody, sendJson, ValidationError } from '../lib/http.js';
import { sendEmailTo } from '../messaging/engine.js';
import { oldestSite } from '../lib/stock.js';
import { CHECK_IN_FIRST, siteHere, whoIsBooking } from './purchase-orders.js';
import {
  GROUPS, ORDER_SELECT, PAID_SHOWN_DAYS, Refused, addDays, addEvent, emailClosing, eventsOf, freeHere, nextFor,
  quoteClosing, quoteItems, quoteRef, readyToOrder, serializeOrder, shopDay, shopTimeZone, takeStep,
} from '../c2w/orders.js';

const db = { prepare, exec: dbExec };
const EMAILS_PER_HOUR = 5;
const SETTINGS_NEEDED = { error: 'Set how long quotes are valid and how long bikes are held in Settings › Front desk › Cycle to Work first', code: 'settings_needed' };
const TOO_MANY = { error: 'This customer has been sent five Cycle to Work quotes in the last hour. Try again later.', code: 'too_many' };

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

// The list's top line and the sidebar's number: what's due or late (decision M3;
// decided while building, 12 Nov, item 7). The sidebar counts each order once.
function countsFor(rows, settings, today, tz, costs) {
  const active = rows.filter((r) => r.stage === 'quote' || r.stage === 'waiting');
  const soon = addDays(today, settings.remind_days ?? 0);
  const staleBy = settings.no_certificate_days ? addDays(today, -settings.no_certificate_days) : null;
  const due = {
    holdEndingSoon: active.filter((r) => r.hold_until_day && r.hold_until_day >= today && r.hold_until_day <= soon),
    holdEnded: active.filter((r) => r.hold_until_day && r.hold_until_day < today),
    readyToOrder: rows.filter((r) => readyToOrder(r, settings.order_rule)),
    noCertificate: staleBy ? active.filter((r) => shopToday(tz, new Date(r.quote_given_at)) <= staleBy) : [],
    paymentLate: rows.filter((r) => r.stage === 'collected' && r.expected_by_day && r.expected_by_day < today),
  };
  const counts = Object.fromEntries(Object.entries(due).map(([k, list]) => [k, list.length]));
  const count = new Set(Object.values(due).flat().map((r) => r.id)).size;
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
    const [settings, tz] = [await settingsRow(), await shopTimeZone()];
    const today = shopToday(tz);
    const rows = await listRows(today);
    const groups = Object.fromEntries(Object.entries(GROUPS).map(([g, stages]) => [g, rows.filter((r) => stages.includes(r.stage))
      .map((r) => ({ ...serializeOrder(r), next: nextFor(r, settings.order_rule, today) }))]));
    const providers = (await db.prepare('SELECT count(*)::int AS n FROM c2w_providers WHERE retired_at IS NULL').get()).n;
    // The shop's day, for the screens' dates (pull request 4), as the reports send it.
    sendJson(res, 200, { groups, ...countsFor(rows, settings, today, tz, costs), providers, today });
  });

  route('GET', '/api/c2w/count', async (req, res) => {
    const [settings, tz] = [await settingsRow(), await shopTimeZone()];
    const today = shopToday(tz);
    sendJson(res, 200, { count: countsFor(await listRows(today), settings, today, tz, false).count });
  });

  route('POST', '/api/c2w/orders', async (req, res) => {
    const body = await readJsonBody(req);
    const who = await whoIsBooking(req);
    if (!who) return sendJson(res, 409, CHECK_IN_FIRST);
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

      // A customer merged into another is hidden (active = 0) and isn't offered.
      if (!(await db.prepare('SELECT 1 FROM customers WHERE id = ? AND active <> 0').get(customerId))) throw new ValidationError('Choose the customer');
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

      // Only a bike in stock here is held; one that isn't is ordered (cw-new-not-in-stock).
      const holdNow = hold && (await freeHere(productId, site)) > 0;

      // The shop's counter, taken under the row's lock: two quotes never share a number.
      // A refusal after this rolls the counter back with everything else.
      await settingsRow();
      const s = await db.prepare('UPDATE c2w_settings SET next_quote_number = next_quote_number + 1 RETURNING *, next_quote_number - 1 AS taken').get();
      if (s.quote_valid_days === null || (holdNow && s.hold_days === null)) throw new Refused(409, SETTINGS_NEEDED);
      const today = await shopDay();
      const total = bike.price_pence + extras.reduce((sum, a) => sum + a.pricePence, 0);
      const { id } = await db.prepare(`INSERT INTO c2w_orders (customer_id, provider_id, site_id, product_id, quote_number, quote_given_at,
        valid_until, hold_until, hold_wanted, accessories, total_pence, customer_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?) RETURNING id`).get(
        customerId, providerId, site, productId, s.taken, currentMoment().toISOString(),
        addDays(today, s.quote_valid_days), holdNow ? addDays(today, s.hold_days) : null, hold, JSON.stringify(extras), total,
        randomBytes(32).toString('hex'),
      );
      const made = await loadOrder(id);
      // The line keeps the sentence the quote was given with, whatever Settings say later.
      await addEvent(id, 'quote_given', who, { detail: { quoteRef: quoteRef(s.taken), closing: quoteClosing(made, s.order_rule) } });
      return { order: serializeOrder(made) };
    });
  });

  route('GET', '/api/c2w/orders/:id', async (req, res, params) => {
    const row = await loadOrder(Number(params.id));
    if (!row) return notFound(res);
    sendJson(res, 200, { order: { ...serializeOrder(row), events: await eventsOf(row.id) }, today: shopToday(await shopTimeZone()) });
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
        items: quoteItems(row), totalPence: row.total_pence, closing: quoteClosing(row, settings.order_rule), howToApply: settings.how_to_apply,
      },
    });
  });

  // Email the quote (cw-email): queued like a receipt, five an hour for one customer.
  route('POST', '/api/c2w/orders/:id/email-quote', async (req, res, params) => {
    const body = await readJsonBody(req);
    const row = await loadOrder(Number(params.id));
    if (!row) return notFound(res);
    const who = await whoIsBooking(req);
    if (!who) return sendJson(res, 409, CHECK_IN_FIRST);
    const to = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : row.customer_email;
    if (!to || !EMAIL_RE.test(to)) return sendJson(res, 400, { error: 'Type an email address, like name@example.com', code: 'bad_address' });
    const settings = await settingsRow();
    const first = row.customer_name.split(/\s+/)[0];
    const text = [
      `Hi ${first}, here’s your quote ${quoteRef(row.quote_number)} for ${row.bike_name}, for your Cycle to Work scheme through ${row.provider_name}.`,
      emailClosing(row, settings.order_rule),
      settings.how_to_apply ? `How to apply: ${settings.how_to_apply}` : null,
    ].filter(Boolean).join('\n\n');
    const ctx = await currentSession(req);
    await save(res, 200, async () => {
      // Counted under the customer's lock, so two presses at once can't both slip under five.
      await db.prepare('SELECT id FROM customers WHERE id = ? FOR UPDATE').get(row.customer_id);
      const { n } = await db.prepare("SELECT count(*)::int AS n FROM customer_messages WHERE customer_id = ? AND template_key = 'c2w_quote' AND created_at > now() - interval '1 hour'").get(row.customer_id);
      if (n >= EMAILS_PER_HOUR) throw new Refused(429, TOO_MANY);
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
    const id = Number(params.id);
    const tz = await shopTimeZone();
    await save(res, 200, async () => {
      const today = shopToday(tz);
      const appliedOn = body.appliedOn ?? today;
      if (!isDay(appliedOn) || appliedOn > today) throw new ValidationError('Applied on is a date, today or earlier');
      const employer = optionalWords(body.employer, 'The employer', 120);
      const reference = optionalWords(body.reference, 'The application reference', 60);
      const detail = { appliedOn, ...(employer ? { employer } : {}), ...(reference ? { reference } : {}) };
      // Noon UTC is the same day in the UK all year round.
      await takeStep(id, 'applied', who, (row) => {
        if (appliedOn < shopToday(tz, new Date(row.quote_given_at))) throw new ValidationError('Applied on is a date on or after the day the quote was given');
        return { applied_at: `${appliedOn}T12:00:00Z`, application_reference: reference };
      }, { detail });
      return { order: serializeOrder(await loadOrder(id)) };
    });
  });
}

