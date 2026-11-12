// The six online order messages (openspec/changes/website-buy-online design 9;
// decision 9 M5 and H4), following server/c2w/messages.js: queued like every
// automatic message and not at all when the shop has switched that message
// off. They go by email to the order's address, not the customer's chosen way,
// as an order may have no customer (design, decided while planning 18). Inside
// the shop's runWithShop, on the request's own connection, so a step that is
// rolled back sends nothing.
//
// Each queued message is noted on the order (an online_order_events 'message'
// line), as customer_messages has no order column: that is how the order finds
// an email that didn't arrive (orderEmailProblem).
import { prepare } from '../db.js';
import { queueMessage, UNDO_MS } from '../messaging/engine.js';
import { formatOpeningHours } from '../messaging/templates.js';
import { messageLink } from '../workshop/job-messages.js';
import { openingHoursFor } from '../capacity.js';
import { toCapacitySettings } from '../workshop/jobs.js';
import { longDate } from '../c2w/orders.js';
import { isHttpsRequest } from '../proxy-trust.js';
import { orderReference } from './numbers.js';

export const ORDER_KEYS = ['order_confirmation', 'order_ready', 'order_still_waiting', 'order_item_not_supplied', 'order_cancelled', 'order_not_ready'];

/**
 * Order ready to collect's wait, with Undo on the staff's toast ("Ready. The
 * email goes to [Customer] in [n] seconds", on-orders-ready; decision 9 H4:
 * "a few seconds"). The number is chosen at build time: 10 (decided while
 * building, Jack can overrule).
 */
export const READY_WAIT_SECONDS = 10;

// How long each waits: the confirmation at once, as the customer has just
// paid; the ready email its few seconds; the reminder at once, as its round
// already waited the days; the rest the usual Undo time of a staff step.
const WAIT_MS = {
  order_confirmation: 0,
  order_ready: READY_WAIT_SECONDS * 1000,
  order_still_waiting: 0,
};

// The customer's order page (design 8). Its screen comes with pull request 13;
// the address follows the website's own (/store/<shop>/), decided while building.
export const orderLinkPath = (shopSlug, code) => `/store/${shopSlug}/orders/${code}`;

// The link's start, as Cycle to Work's messages: the app's public address, or
// the request's own host.
const baseFor = (req) => process.env.APP_PUBLIC_URL || (req ? `${isHttpsRequest(req) ? 'https' : 'http'}://${req.headers.host}` : null);

/**
 * Queues one order message for an order, filled in from the order as it is
 * now. `vars` adds the step's own tap-ins (Item, Reason, Amount refunded).
 * `req` gives the link's host when there's no APP_PUBLIC_URL. Returns
 * queueMessage's answer ({ id } or { skipped }).
 */
export async function queueOrderMessage(orderId, key, { req = null, loginId = null, vars = {} } = {}) {
  if (!ORDER_KEYS.includes(key)) throw new Error(`${key} is not an online order message`);
  const order = await prepare(
    `SELECT id, customer_id, name, email, number, order_code, to_char(keep_until, 'YYYY-MM-DD') AS keep_until
     FROM online_orders WHERE id = ?`,
  ).get(orderId);
  if (!order) return { skipped: 'no_order' };
  const shop = await prepare("SELECT name, slug, address, phone FROM shops WHERE id = current_setting('app.current_shop_id')::int").get();
  const settings = await prepare('SELECT * FROM workshop_settings LIMIT 1').get();
  const base = baseFor(req);
  const link = await messageLink(async () => (base ? `${base}${orderLinkPath(shop.slug, order.order_code)}` : null));
  // Never a message without its link.
  if (link === null) {
    console.error(`Messages: no APP_PUBLIC_URL, so online order ${orderId}'s ${key} message wasn't sent`);
    return { skipped: 'no_link' };
  }
  const queued = await queueMessage({
    customerId: order.customer_id,
    email: order.email ?? '',
    key,
    delayMs: WAIT_MS[key] ?? UNDO_MS,
    loginId,
    vars: {
      'Customer’s first name': (order.name ?? '').trim().split(/\s+/)[0],
      'Order number': order.number === null ? '' : orderReference(order.number),
      'Shop name': shop.name,
      'Link to your order': link,
      // With no phone in Shop details, "the shop", as Work added within your limit says.
      'Shop phone': shop.phone || 'the shop',
      'Shop address': shop.address || '',
      'Opening hours': settings ? formatOpeningHours(openingHoursFor(toCapacitySettings(settings))) : '',
      'Keep until': order.keep_until ? longDate(order.keep_until) : '',
      ...vars,
    },
  });
  if (queued.id) {
    await prepare("INSERT INTO online_order_events (order_id, kind, employee_id, detail) VALUES (?, 'message', NULL, ?)")
      .run(orderId, JSON.stringify({ key, messageId: queued.id }));
    if (key === 'order_ready') await prepare('UPDATE online_orders SET ready_message_id = ? WHERE id = ?').run(queued.id, orderId);
  }
  return queued;
}

/**
 * Undo of Mark ready: the order's ready email is stopped while it still
 * waits. One already sent can't be stopped.
 */
export async function undoOrderReady(orderId) {
  await prepare(
    `UPDATE customer_messages SET intent_state = 'undone', status = 'undone'
     WHERE intent_state = 'intended' AND id = (SELECT ready_message_id FROM online_orders WHERE id = ?)`,
  ).run(orderId);
}

/**
 * The order's latest email that couldn't reach the customer, for the row's
 * "Email didn’t arrive · [phone]" (on-orders): { failed: its key, phone }, or
 * null when none failed.
 */
export async function orderEmailProblem(orderId) {
  const row = await prepare(
    `SELECT m.template_key, o.phone FROM online_order_events e
     JOIN online_orders o ON o.id = e.order_id
     JOIN customer_messages m ON m.id = (e.detail->>'messageId')::int
     WHERE e.order_id = ? AND e.kind = 'message' AND m.intent_state = 'failed'
     ORDER BY m.id DESC LIMIT 1`,
  ).get(orderId);
  return row ? { failed: row.template_key, phone: row.phone } : null;
}
