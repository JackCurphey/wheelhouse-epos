// screens: cw-list, cw-new, cw-quote, cw-email, cw-order, cw-order-held, cw-hold-ending
// Cycle to Work orders and quotes (openspec/changes/cycle-to-work, design 2,
// 3, 4 and 7; tasks 3.1–3.8 and 5.1–5.3). Anyone signed in sees the list, makes quotes and
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
import { queueC2wMessage, queueCertificateMessage, undoReadyMessage } from '../c2w/messages.js';
import { oldestSite } from '../lib/stock.js';
import { CHECK_IN_FIRST, siteHere, whoIsBooking } from './purchase-orders.js';
import { ownerOnly } from '../lib/owner-only.js';
import { nameKey } from '../lib/restock.js';
import {
  GROUPS, NOT_HELD, ORDER_SELECT, PAID_SHOWN_DAYS, Refused, addDays, addEvent, emailClosing, eventsOf, freeHere, heldHere,
  nextFor, notInStock, quoteClosing, quoteItems, quoteRef, readyToOrder, releaseHold, serializeOrder, shopDay, shopTimeZone, takeHold, takeStep,
} from '../c2w/orders.js';

const db = { prepare, exec: dbExec };
const EMAILS_PER_HOUR = 5;
const CHOOSE_DIFFERENCE = { error: 'The certificate is for less than the order. Choose what to do about the difference.', code: 'difference_choice' };
const SETTINGS_NEEDED = { error: 'Set how long quotes are valid and how long bikes are held in Settings › Front desk › Cycle to Work first', code: 'settings_needed' };
const NOT_TIME = { error: 'It isn’t time to order this bike yet. Use Order now anyway to order it before then.', code: 'not_time_to_order' };
const ALREADY_ORDERED = { error: 'This bike is already on order. Refresh to see where it is now.', code: 'already_ordered' };
const HAS_BIKE = { error: 'This order already has its bike, so there’s nothing to order.', code: 'has_bike' };
const NO_SUPPLIER = { error: 'This bike has no supplier in Settings › Suppliers to order it from. Set its supplier on the product first.', code: 'no_supplier' };
const NOTHING_ON_ORDER = { error: 'Nothing is on order for this bike. Refresh to see where it is now.', code: 'not_on_order' };
const ORDER_SENT = { error: 'The supplier order has been sent, so this can’t be undone here. Change it on the purchase order.', code: 'order_sent' };
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

      // The shop's counter, taken under the row's lock: two quotes never share a number.
      // A refusal after this rolls the counter back with everything else.
      await settingsRow();
      const s = await db.prepare('UPDATE c2w_settings SET next_quote_number = next_quote_number + 1 RETURNING *, next_quote_number - 1 AS taken').get();
      if (s.quote_valid_days === null) throw new Refused(409, SETTINGS_NEEDED);
      const today = await shopDay();
      const givenAt = currentMoment().toISOString();
      const total = bike.price_pence + extras.reduce((sum, a) => sum + a.pricePence, 0);
      const { id } = await db.prepare(`INSERT INTO c2w_orders (customer_id, provider_id, site_id, product_id, quote_number, quote_given_at,
        valid_until, hold_wanted, accessories, total_pence, customer_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?) RETURNING id`).get(
        customerId, providerId, site, productId, s.taken, givenAt,
        addDays(today, s.quote_valid_days), hold, JSON.stringify(extras), total, randomBytes(32).toString('hex'),
      );
      // Only a bike free here is held, under the stock lock; one that isn't is
      // ordered (cw-new-not-in-stock). A hold never ends by itself (design 4).
      const held = hold ? await takeHold(id, productId, site) : null;
      let until = null;
      if (held) {
        if (s.hold_days === null) throw new Refused(409, SETTINGS_NEEDED);
        until = addDays(today, s.hold_days);
        await db.prepare('UPDATE c2w_orders SET frame_id = ?, held_at = ?, hold_until = ? WHERE id = ? RETURNING id').get(held.frameId, givenAt, until, id);
      }
      const made = await loadOrder(id);
      // The line keeps the sentence the quote was given with, whatever Settings say later.
      await addEvent(id, 'quote_given', who, { detail: { quoteRef: quoteRef(s.taken), closing: quoteClosing(made, s.order_rule) } });
      if (held) {
        await addEvent(id, 'held', who, { detail: { until } });
        await queueC2wMessage(id, 'c2w_put_aside', { req, loginId: who.loginId });
      }
      return { order: serializeOrder(made) };
    });
  });

  route('GET', '/api/c2w/orders/:id', async (req, res, params) => {
    const row = await loadOrder(Number(params.id));
    if (!row) return notFound(res);
    const today = shopToday(await shopTimeZone());
    // The same next step as the list's row (cw-order-applied's Order from [supplier]).
    const next = nextFor(row, (await settingsRow()).order_rule, today);
    sendJson(res, 200, { order: { ...serializeOrder(row), next, events: await eventsOf(row.id) }, today });
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

  // Hold longer (cw-order-held, cw-hold-ending): another lot of the Settings days,
  // on from the hold's date, or from today once it has passed.
  route('POST', '/api/c2w/orders/:id/hold-longer', async (req, res, params) => {
    const who = await whoIsBooking(req);
    if (!who) return sendJson(res, 409, CHECK_IN_FIRST);
    const id = Number(params.id);
    await save(res, 200, async () => {
      const s = await settingsRow();
      if (s.hold_days === null) throw new Refused(409, SETTINGS_NEEDED);
      const today = await shopDay();
      const detail = {};
      await takeStep(id, 'hold_longer', who, (row) => {
        if (!row.held_at) throw new Refused(409, NOT_HELD);
        const from = row.hold_until_day;
        const until = addDays(from && from > today ? from : today, s.hold_days);
        Object.assign(detail, { from, until });
        return { hold_until: until };
      }, { detail });
      await queueC2wMessage(id, 'c2w_put_aside', { req, loginId: who.loginId });
      return { order: serializeOrder(await loadOrder(id)) };
    });
  });

  // Release the bike (cw-order-held, cw-hold-ending): the frame goes back on sale
  // and the order stays open where it is. Anyone checked in can release, until
  // the certificate makes the hold firm.
  route('POST', '/api/c2w/orders/:id/release', async (req, res, params) => {
    const who = await whoIsBooking(req);
    if (!who) return sendJson(res, 409, CHECK_IN_FIRST);
    const id = Number(params.id);
    await save(res, 200, async () => {
      // "What's happened" keeps which frame it was: cw-certificate-released checks it.
      const detail = {};
      await takeStep(id, 'released', who, async (row) => {
        if (!row.held_at) throw new Refused(409, NOT_HELD);
        await releaseHold(row);
        if (row.frame_id) detail.frameId = row.frame_id;
        return { frame_id: null, held_at: null, hold_until: null, released_at: currentMoment().toISOString() };
      }, { detail });
      return { order: serializeOrder(await loadOrder(id)) };
    });
  });

  // Order the bike from the supplier (cw-list's Order button, cw-ordered): a line for one,
  // naming the order, on the supplier's draft order, made if there isn't one. Anyone
  // checked in, once the shop's rule says it's time; before then, "Order now anyway…"
  // (cw-order-anyway) needs a reason and is the Owner's until roles are built.
  route('POST', '/api/c2w/orders/:id/order', async (req, res, params) => {
    const body = await readJsonBody(req);
    const who = await whoIsBooking(req);
    if (!who) return sendJson(res, 409, CHECK_IN_FIRST);
    const anyway = body.anyway === true;
    if (anyway && await ownerOnly(req, res, 'Only the shop’s owner can order a bike before it’s time')) return;
    const id = Number(params.id);
    await save(res, 200, async () => {
      const reason = anyway ? optionalWords(body.reason, 'Why', 500) : null;
      if (anyway && !reason) throw new ValidationError('Say why the bike is being ordered now');
      const s = await settingsRow();
      const detail = {};
      await takeStep(id, 'ordered', who, async () => {
        const row = await loadOrder(id);
        if (row.on_order) throw new Refused(409, ALREADY_ORDERED);
        if (!notInStock(row)) throw new Refused(409, HAS_BIKE);
        if (!anyway && !readyToOrder(row, s.order_rule)) throw new Refused(409, NOT_TIME);
        const product = await db.prepare('SELECT id, name, sku, cost, supplier FROM products WHERE id = ?').get(row.product_id);
        const supplier = nameKey(product.supplier)
          ? (await db.prepare('SELECT id, name FROM suppliers ORDER BY id').all()).find((x) => nameKey(x.name) === nameKey(product.supplier))
          : null;
        if (!supplier) throw new Refused(409, NO_SUPPLIER);
        // The supplier first, so an order and a restock at once make one draft between them.
        await db.prepare('SELECT id FROM suppliers WHERE id = ? FOR UPDATE').get(supplier.id);
        let po = await db.prepare("SELECT id FROM purchase_orders WHERE supplier_id = ? AND status = 'draft' ORDER BY id DESC LIMIT 1 FOR UPDATE").get(supplier.id);
        const now = currentMoment().toISOString();
        if (!po) po = { id: (await db.prepare("INSERT INTO purchase_orders (supplier_id, reference, notes, status, updated_at) VALUES (?, '', '', 'draft', ?)").run(supplier.id, now)).lastInsertRowid };
        await db.prepare(
          `INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, product_sku, qty_ordered, unit_cost, c2w_order_id)
           VALUES (?, ?, ?, ?, 1, ?, ?)`
        ).run(po.id, product.id, product.name, product.sku, product.cost, id);
        await db.prepare('UPDATE purchase_orders SET updated_at = ? WHERE id = ?').run(now, po.id);
        Object.assign(detail, { purchaseOrderId: po.id, supplier: supplier.name, ...(anyway ? { anyway: true } : {}) });
        return {};
      }, { detail, reason });
      return { order: serializeOrder(await loadOrder(id)), purchaseOrderId: detail.purchaseOrderId, supplier: detail.supplier };
    });
  });

  // Undo (cw-ordered's toast): the order's bike comes off the draft, while it is still a
  // draft: its line goes, or, edited up to more than one, keeps the rest as plain stock.
  // A draft left with nothing on it goes too.
  route('POST', '/api/c2w/orders/:id/order/undo', async (req, res, params) => {
    const who = await whoIsBooking(req);
    if (!who) return sendJson(res, 409, CHECK_IN_FIRST);
    const id = Number(params.id);
    await save(res, 200, async () => {
      const detail = {};
      await takeStep(id, 'order_undone', who, async () => {
        const open = await db.prepare(
          `SELECT i.id, i.purchase_order_id, po.status FROM purchase_order_items i JOIN purchase_orders po ON po.id = i.purchase_order_id
           WHERE i.c2w_order_id = ? AND po.status IN ('draft', 'ordered', 'partially_received') AND i.qty_received < i.qty_ordered
           ORDER BY i.id DESC LIMIT 1`
        ).get(id);
        if (!open) throw new Refused(409, NOTHING_ON_ORDER);
        if (open.status !== 'draft') throw new Refused(409, ORDER_SENT);
        // Only a draft is locked, and checked again once it is: booking in locks a sent
        // order and then this order, so locking a sent one here could deadlock.
        const po = await db.prepare('SELECT status FROM purchase_orders WHERE id = ? FOR UPDATE').get(open.purchase_order_id);
        if (po?.status !== 'draft') throw new Refused(409, ORDER_SENT);
        const line = await db.prepare('SELECT id, purchase_order_id, qty_ordered FROM purchase_order_items WHERE id = ? AND c2w_order_id = ?').get(open.id, id);
        if (!line) throw new Refused(409, NOTHING_ON_ORDER);
        if (line.qty_ordered > 1) {
          await db.prepare('UPDATE purchase_order_items SET qty_ordered = qty_ordered - 1, c2w_order_id = NULL WHERE id = ?').run(line.id);
        } else {
          await db.prepare('DELETE FROM purchase_order_items WHERE id = ?').run(line.id);
          await db.prepare("DELETE FROM purchase_orders WHERE id = ? AND status = 'draft' AND NOT EXISTS (SELECT 1 FROM purchase_order_items WHERE purchase_order_id = ?)").run(line.purchase_order_id, line.purchase_order_id);
        }
        detail.purchaseOrderId = line.purchase_order_id;
        return {};
      }, { detail });
      return { order: serializeOrder(await loadOrder(id)) };
    });
  });

  // The bike's stock for New order (cw-new: "1 free at Bolton · none held"):
  // each site, oldest first, with what's free and what's held for orders there.
  route('GET', '/api/c2w/stock', async (req, res, params, query) => {
    const productId = Number(query.get('productId'));
    if (!Number.isInteger(productId) || productId < 1) return badRequest(res, 'Choose the bike');
    if (!(await db.prepare('SELECT 1 FROM products WHERE id = ?').get(productId))) return notFound(res);
    const here = (await siteHere(req)) ?? (await oldestSite());
    const sites = [];
    for (const s of await db.prepare('SELECT id, name FROM sites ORDER BY id').all()) {
      sites.push({ siteId: s.id, siteName: s.name, free: await freeHere(productId, s.id), held: await heldHere(productId, s.id) });
    }
    sendJson(res, 200, { here, sites });
  });

  // Add the certificate (cw-certificate, -diff, -match, -more, -late, -released):
  // the hold becomes firm until collection (decision 3). Less than the order,
  // the shop changes the order to match or the customer pays the difference;
  // more, it keeps the order as quoted or adds to it. Anyone checked in.
  route('POST', '/api/c2w/orders/:id/certificate', async (req, res, params) => {
    const body = await readJsonBody(req);
    const who = await whoIsBooking(req);
    if (!who) return sendJson(res, 409, CHECK_IN_FIRST);
    const id = Number(params.id);
    await save(res, 200, async () => {
      const today = await shopDay();
      const number = typeof body.number === 'string' ? body.number.trim() : '';
      if (!number || number.length > 60) throw new ValidationError('The certificate number is 1 to 60 characters');
      const amount = body.amountPence;
      if (!Number.isInteger(amount) || amount < 1) throw new ValidationError('The amount on the certificate is in whole pence, more than nothing');
      const receivedOn = body.receivedOn ?? today;
      if (!isDay(receivedOn) || receivedOn > today) throw new ValidationError('Received is a date, today or earlier');
      const ready = body.ready ?? false;
      if (typeof ready !== 'boolean') throw new ValidationError('Ready is yes or no');
      const difference = body.difference ?? null;
      if (difference !== null && !['keep', 'match'].includes(difference)) throw new ValidationError('Keep the order or change it to match');
      let accessoryIds = null;
      if (difference === 'match') {
        accessoryIds = body.accessoryIds;
        if (!Array.isArray(accessoryIds) || accessoryIds.length > 20) throw new ValidationError('Choose up to 20 accessories');
        accessoryIds.forEach((a) => wholeId(a, 'an accessory'));
        if (new Set(accessoryIds).size !== accessoryIds.length) throw new ValidationError('Choose each accessory once');
      }
      const detail = { number, certificatePence: amount };
      let notReady = null;
      await takeStep(id, 'certificate', who, async (row) => {
        const fields = { certificate_number: number, certificate_pence: amount, certificate_received_on: receivedOn, hold_until: null };
        detail.quotePence = row.total_pence;
        if (amount === row.total_pence && difference !== 'match') fields.difference_choice = null;
        else if (difference === null && amount < row.total_pence) throw new Refused(400, CHOOSE_DIFFERENCE);
        else fields.difference_choice = difference ?? 'keep';
        if (fields.difference_choice === 'match') {
          // Kept accessories keep their quoted price; added ones take the shop's price now.
          const quoted = new Map(row.accessories.map((a) => [a.productId, a]));
          const extras = [];
          for (const pid of accessoryIds) {
            if (quoted.has(pid)) { extras.push(quoted.get(pid)); continue; }
            const p = await db.prepare('SELECT id, name, price_pence FROM products WHERE id = ?').get(pid);
            if (!p) throw new ValidationError('Choose the accessories from the shop’s products');
            extras.push({ productId: p.id, name: p.name, pricePence: p.price_pence });
          }
          const bikePence = row.total_pence - row.accessories.reduce((sum, a) => sum + a.pricePence, 0);
          const total = bikePence + extras.reduce((sum, a) => sum + a.pricePence, 0);
          if (total > amount) throw new ValidationError('The new total is more than the certificate. Take more off, or keep the order.');
          Object.assign(fields, { accessories: JSON.stringify(extras), total_pence: total, quote_revised_at: currentMoment().toISOString() });
        }
        // A bike let go before the certificate is held again if one is free at the
        // order's site; if none is, the order needs one ordering in.
        let heldAt = row.held_at;
        if (!heldAt) {
          const got = await takeHold(id, row.product_id, row.site_id);
          if (got) {
            heldAt = currentMoment().toISOString();
            Object.assign(fields, { frame_id: got.frameId, held_at: heldAt });
            detail.heldFrameId = got.frameId;
          }
        }
        // With no bike put aside, the tick is left off and the certificate is
        // still saved (cw-certificate-released: "certificate … saved").
        if (ready && !heldAt) notReady = NOT_HELD.code;
        else if (ready) {
          fields.stage = 'ready';
          detail.ready = true;
        }
        return fields;
      }, { detail });
      await queueCertificateMessage(id, { req, loginId: who.loginId });
      return { order: serializeOrder(await loadOrder(id)), ...(notReady ? { notReady } : {}) };
    });
  });

  // Mark ready to collect (cw-order-get-ready, cw-marked-ready), and its Undo.
  for (const [path, step] of [['ready', 'ready'], ['ready/undo', 'ready_undone']]) {
    route('POST', `/api/c2w/orders/:id/${path}`, async (req, res, params) => {
      const who = await whoIsBooking(req);
      if (!who) return sendJson(res, 409, CHECK_IN_FIRST);
      const id = Number(params.id);
      await save(res, 200, async () => {
        await takeStep(id, step, who, (row) => {
          if (step === 'ready' && !row.held_at) throw new Refused(409, NOT_HELD);
          return {};
        });
        if (step === 'ready') await queueC2wMessage(id, 'c2w_ready', { req, loginId: who.loginId });
        else await undoReadyMessage(id);
        return { order: serializeOrder(await loadOrder(id)) };
      });
    });
  }

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

