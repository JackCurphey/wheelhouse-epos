// The four Cycle to Work messages (decision 2026-10-02-cycle-to-work-review point 6;
// openspec/changes/cycle-to-work design 9): queued like every automatic message,
// sent the customer's chosen way after the Undo wait, and not at all when the shop
// has switched that message off. Inside the shop's runWithShop, on the request's
// own connection, so a step that is rolled back sends nothing.
import { prepare, dbExec } from '../db.js';
import { queueMessage, UNDO_MS } from '../messaging/engine.js';
import { messageLink } from '../workshop/job-messages.js';
import { shopToday } from '../clock.js';
import { ORDER_SELECT, longDate, quoteRef, providerPays, addEvent } from './orders.js';
import { c2wLinkPath } from './customer-view.js';
import { isHttpsRequest } from '../proxy-trust.js';

const pounds = (pence) => `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// The link's start: the app's public address, or the request's own host (as the
// workshop's messages do). A message queued with no request (booked in, the
// hold-ending round) needs APP_PUBLIC_URL once sending is real.
const baseFor = (req) => process.env.APP_PUBLIC_URL || (req ? `${isHttpsRequest(req) ? 'https' : 'http'}://${req.headers.host}` : null);

/**
 * Queues one Cycle to Work message for an order, filled in from the order as it
 * is now. `req` gives the link's host when there's no APP_PUBLIC_URL. Returns
 * queueMessage's answer ({ id } or { skipped }).
 */
export async function queueC2wMessage(orderId, key, { req = null, loginId = null } = {}) {
  const r = await prepare(`${ORDER_SELECT} WHERE o.id = ?`).get(orderId);
  if (!r) return { skipped: 'no_order' };
  const shop = await prepare("SELECT name, slug FROM shops WHERE id = current_setting('app.current_shop_id')::int").get();
  const base = baseFor(req);
  const link = await messageLink(async () => (base ? `${base}${c2wLinkPath(shop.slug, r.customer_code)}` : null));
  // Never a message without its link, and never a booking-in stopped for one.
  if (link === null) {
    console.error(`Messages: no APP_PUBLIC_URL, so Cycle to Work order ${orderId}'s ${key} message wasn't sent`);
    return { skipped: 'no_link' };
  }
  const vars = {
    'Customer’s first name': (r.customer_name ?? '').trim().split(/\s+/)[0],
    Bike: r.bike_name,
    'Hold until': r.hold_until_day ? longDate(r.hold_until_day) : '',
    'Quote number': quoteRef(r.quote_number),
    'Link to your Cycle to Work bike': link,
    'Shop name': shop.name,
    'Certificate amount': r.certificate_pence === null ? '' : pounds(r.certificate_pence),
    'Amount to pay': r.certificate_pence === null ? '' : pounds(r.total_pence - providerPays(r)),
  };
  return queueMessage({ customerId: r.customer_id, key, vars, delayMs: UNDO_MS, loginId });
}

/**
 * The certificate's message: Ready to collect when the bike is ready with it
 * (one message, not two); the for-less wording when the order is kept for more
 * than the certificate; otherwise Certificate received.
 */
export async function queueCertificateMessage(orderId, opts) {
  const r = await prepare('SELECT stage, certificate_pence, total_pence FROM c2w_orders WHERE id = ?').get(orderId);
  if (r.stage === 'ready') return queueC2wMessage(orderId, 'c2w_ready', opts);
  // Below the total only when kept: changing the order to match brings the total within it.
  const less = r.certificate_pence < r.total_pence;
  return queueC2wMessage(orderId, less ? 'c2w_certificate_less' : 'c2w_certificate', opts);
}

/**
 * Undo of Ready to collect: a Ready to collect still waiting for this order's
 * customer is stopped. The message isn't tied to the order, so it is found by
 * its customer; one already sent can't be stopped.
 */
export async function undoReadyMessage(orderId) {
  await prepare(
    `UPDATE customer_messages SET intent_state = 'undone', status = 'undone'
     WHERE intent_state = 'intended' AND template_key = 'c2w_ready'
       AND customer_id = (SELECT customer_id FROM c2w_orders WHERE id = ?)`,
  ).run(orderId);
}

/**
 * "Your hold ends on [date]": for each bike put aside before the certificate whose
 * hold ends within the shop's reminder days (and hasn't ended), once for that
 * date. Releasing the bike or the certificate clears hold_until, so neither is reminded. The order's line records it. Inside runWithShop, not throttled.
 */
export async function queueHoldEndings(shopId, now = new Date()) {
  const s = await prepare('SELECT remind_days FROM c2w_settings LIMIT 1').get();
  if (!s || s.remind_days === null) return 0;
  const tz = (await prepare('SELECT time_zone FROM workshop_settings LIMIT 1').get())?.time_zone || 'Europe/London';
  const today = shopToday(tz, now);
  const due = await prepare(
    `SELECT o.id, to_char(o.hold_until, 'YYYY-MM-DD') AS until FROM c2w_orders o
     WHERE o.stage IN ('quote', 'waiting') AND o.hold_until IS NOT NULL
       AND o.hold_until >= ?::date AND o.hold_until <= ?::date + ?::int
       AND NOT EXISTS (SELECT 1 FROM c2w_order_events e WHERE e.order_id = o.id AND e.kind = 'hold_ending_sent'
                       AND e.detail->>'until' = to_char(o.hold_until, 'YYYY-MM-DD'))
     ORDER BY o.id`,
  ).all(today, today, s.remind_days);
  for (const o of due) {
    await dbExec('BEGIN');
    try {
      const sent = await queueC2wMessage(o.id, 'c2w_hold_ending');
      await addEvent(o.id, 'hold_ending_sent', { name: null }, { detail: { until: o.until, ...(sent.skipped ? { skipped: sent.skipped } : {}) } });
      await dbExec('COMMIT');
    } catch (err) {
      await dbExec('ROLLBACK').catch(() => {});
      console.error(`Messages: the hold-ending message for Cycle to Work order ${o.id} couldn't be queued`, err);
    }
  }
  return due.length;
}

// Once a minute per shop, from the sender's round (like the shop's own messages).
const lastChecked = new Map();
export async function holdEndingRound(shopId, now = new Date()) {
  const last = lastChecked.get(shopId) ?? 0;
  if (now.getTime() - last < 60_000) return 0;
  lastChecked.set(shopId, now.getTime());
  return queueHoldEndings(shopId, now);
}
