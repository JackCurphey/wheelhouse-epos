// The Cycle to Work messages (decision 2026-10-02-cycle-to-work-review point 6,
// six from Jack's 12 Nov answer; openspec/changes/cycle-to-work design 9): queued like every automatic message,
// sent the customer's chosen way after the Undo wait, and not at all when the shop
// has switched that message off. Inside the shop's runWithShop, on the request's
// own connection, so a step that is rolled back sends nothing.
import { prepare, dbExec } from '../db.js';
import { queueMessage, UNDO_MS } from '../messaging/engine.js';
import { messageLink } from '../workshop/job-messages.js';
import { shopToday, currentMoment } from '../clock.js';
import { ORDER_SELECT, longDate, quoteRef, providerPays, addEvent } from './orders.js';
import { c2wLinkPath } from './customer-view.js';
import { isHttpsRequest } from '../proxy-trust.js';
import { pounds } from '../lib/customer-money.js';

// The link's start: the app's public address, or the request's own host (as the
// workshop's messages do). A message queued with no request (booked in, the
// hold-ending round) needs APP_PUBLIC_URL once sending is real.
const baseFor = (req) => process.env.APP_PUBLIC_URL || (req ? `${isHttpsRequest(req) ? 'https' : 'http'}://${req.headers.host}` : null);

/**
 * Queues one Cycle to Work message for an order, filled in from the order as it
 * is now. `req` gives the link's host when there's no APP_PUBLIC_URL. Returns
 * queueMessage's answer ({ id } or { skipped }).
 */
export async function queueC2wMessage(orderId, key, { req = null, loginId = null, attachments = [] } = {}) {
  const r = await prepare(`${ORDER_SELECT} WHERE o.id = ?`).get(orderId);
  if (!r) return { skipped: 'no_order' };
  const shop = await prepare("SELECT name, slug, phone FROM shops WHERE id = current_setting('app.current_shop_id')::int").get();
  // One size of a bike with sizes is named with its size, as drawn ("[Bike] · [Size]", cw-texts-*).
  const size = (await prepare('SELECT size FROM products WHERE id = ?').get(r.product_id))?.size;
  const base = baseFor(req);
  // A new put-aside gives the new date: one still in its minute gives way to it
  // (Hold longer pressed twice sends one message, not two).
  if (key === 'c2w_put_aside') await stopWaiting(r.customer_id, 'c2w_put_aside');
  // "Your order is cancelled" is drawn with the shop's phone instead of a link
  // (cw-texts-cancelled), so it can't go without one.
  const cancelled = key.startsWith('c2w_cancelled');
  const phone = (shop.phone ?? '').trim();
  if (cancelled && !phone) {
    console.error(`Messages: the shop has no phone number, so Cycle to Work order ${orderId}'s ${key} message wasn't sent`);
    return { skipped: 'no_phone' };
  }
  const link = cancelled ? null : await messageLink(async () => (base ? `${base}${c2wLinkPath(shop.slug, r.customer_code)}` : null));
  // Never a message without its link, and never a booking-in stopped for one.
  if (!cancelled && link === null) {
    console.error(`Messages: no APP_PUBLIC_URL, so Cycle to Work order ${orderId}'s ${key} message wasn't sent`);
    return { skipped: 'no_link' };
  }
  const vars = {
    'Customer’s first name': (r.customer_name ?? '').trim().split(/\s+/)[0],
    Bike: size ? `${r.bike_name} · ${size}` : r.bike_name,
    'Hold until': r.hold_until_day ? longDate(r.hold_until_day) : '',
    'Quote number': quoteRef(r.quote_number),
    ...(cancelled ? { 'Shop phone': phone } : { 'Link to your Cycle to Work bike': link }),
    'Shop name': shop.name,
    'Certificate amount': r.certificate_pence === null ? '' : pounds(r.certificate_pence),
    'Amount to pay': r.certificate_pence === null ? '' : pounds(r.total_pence - providerPays(r)),
  };
  const queued = await queueMessage({ customerId: r.customer_id, key, vars, delayMs: UNDO_MS, loginId, attachments });
  // Put aside already gives the end date: a hold no longer than the reminder days
  // gets no "Your hold ends" for it as well, so the two never go back to back.
  if (key === 'c2w_put_aside' && queued.id && r.hold_until_day) await toldTheEnd(orderId, r.hold_until_day);
  return queued;
}

/**
 * Released: "Your bike is no longer put aside", unless "Your bike is put aside"
 * is still in its minute. Then that one is stopped and nothing is sent, so the
 * customer isn't told a put-aside ended that she never heard of.
 */
export async function queueReleasedMessage(orderId, opts) {
  const r = await prepare('SELECT customer_id FROM c2w_orders WHERE id = ?').get(orderId);
  const waiting = await prepare(
    "SELECT 1 FROM customer_messages WHERE intent_state = 'intended' AND template_key = 'c2w_put_aside' AND customer_id = ? LIMIT 1",
  ).get(r.customer_id);
  if (waiting) {
    await stopWaiting(r.customer_id, 'c2w_put_aside');
    return { skipped: 'put_aside_waiting' };
  }
  return queueC2wMessage(orderId, 'c2w_released', opts);
}

// The customer's Cycle to Work messages of one kind still waiting are stopped.
// Messages aren't tied to an order, so this is by customer (decided while
// building, 12 Nov, PR 9c item 6).
async function stopWaiting(customerId, key) {
  await prepare(
    `UPDATE customer_messages SET intent_state = 'undone', status = 'undone'
     WHERE intent_state = 'intended' AND template_key = ? AND customer_id = ?`,
  ).run(key, customerId);
}

// Marks the hold's end date as reminded when it falls within the reminder days.
async function toldTheEnd(orderId, until) {
  const s = await prepare('SELECT remind_days FROM c2w_settings LIMIT 1').get();
  if (!s || s.remind_days === null) return;
  const tz = (await prepare('SELECT time_zone FROM workshop_settings LIMIT 1').get())?.time_zone || 'Europe/London';
  const today = shopToday(tz, currentMoment());
  const start = new Date(`${until}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - s.remind_days);
  if (start.toISOString().slice(0, 10) > today) return;
  await addEvent(orderId, 'hold_ending_sent', { name: null }, { detail: { until, skipped: 'put_aside' } });
}

/**
 * Checked as each message comes due (the sender's DUE_CHECKS): Put aside and
 * Your hold ends go only while the customer still has a bike held for an order
 * before its certificate, so a release in the message's minute stops it. By
 * customer, as the message isn't tied to an order. No longer put aside goes
 * only while a released bike is still let go.
 */
export async function c2wStillNeeded(m) {
  // No longer put aside: not once the bike is held again (the certificate or the
  // bike's arrival in the same minute), as the next message says so.
  if (m.template_key === 'c2w_released') {
    return Boolean(await prepare(
      `SELECT 1 FROM c2w_orders o WHERE o.customer_id = ? AND o.stage IN ('quote', 'waiting')
         AND o.released_at IS NOT NULL AND o.held_at IS NULL LIMIT 1`,
    ).get(m.customer_id));
  }
  const held = m.template_key === 'c2w_hold_ending' ? 'o.hold_until IS NOT NULL' : 'o.held_at IS NOT NULL';
  return Boolean(await prepare(
    `SELECT 1 FROM c2w_orders o WHERE o.customer_id = ? AND o.stage IN ('quote', 'waiting') AND ${held} LIMIT 1`,
  ).get(m.customer_id));
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
export async function undoReadyMessage(orderId, key = 'c2w_ready') {
  await prepare(
    `UPDATE customer_messages SET intent_state = 'undone', status = 'undone'
     WHERE intent_state = 'intended' AND template_key = ?
       AND customer_id = (SELECT customer_id FROM c2w_orders WHERE id = ?)`,
  ).run(key, orderId);
}

/**
 * Cancelling an order stops its Ready to collect and Certificate received
 * messages still waiting to go. They are found by customer, so while the
 * customer has another open order they are left alone: the message may be that
 * order's (review, 13 Nov).
 */
export async function stopMessagesForCancel(orderId) {
  await prepare(
    `UPDATE customer_messages SET intent_state = 'undone', status = 'undone'
     WHERE intent_state = 'intended' AND template_key IN ('c2w_ready', 'c2w_certificate', 'c2w_certificate_less')
       AND customer_id = (SELECT customer_id FROM c2w_orders WHERE id = ?)
       AND NOT EXISTS (SELECT 1 FROM c2w_orders other WHERE other.customer_id = customer_messages.customer_id
         AND other.id <> ? AND other.stage IN ('quote', 'waiting', 'certificate', 'ready'))`,
  ).run(orderId, orderId);
}

/**
 * "Your hold ends on [date]": for each bike put aside before the certificate whose
 * hold ends within the shop's reminder days (and hasn't ended), once for that
 * date. Releasing the bike or the certificate clears hold_until, so neither is reminded. The order's line records it. Inside runWithShop, not throttled.
 */
export async function queueHoldEndings(now = new Date()) {
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
  return queueHoldEndings(now);
}
