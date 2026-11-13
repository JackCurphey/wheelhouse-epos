// Cycle to Work orders (openspec/changes/cycle-to-work, design 2, 3 and 7;
// tasks 3.1–3.8). Everything here runs inside the shop's row-level security,
// bound by the staff route.
//
// An order moves through six stages: quote → waiting (applied) → certificate
// → ready → collected → paid, or ends cancelled or closed. Each step is a row
// in STEPS saying which stages it may start from; takeStep locks the order,
// checks, changes it and adds its "What's happened" line, all or nothing.
// "What's happened" (c2w_order_events) is only ever added to.
import { prepare } from '../db.js';
import { shopToday } from '../clock.js';
import { lockStock } from '../lib/stock.js';

export const QUOTE_PREFIX = 'CW-';
export const quoteRef = (n) => `${QUOTE_PREFIX}${n}`;

// The groups on the list (cw-list), in order.
export const GROUPS = { waiting: ['quote', 'waiting'], certificate: ['certificate'], ready: ['ready'], collected: ['collected'], paid: ['paid'] };
// "Paid · last 30 days" (design, decided while building 3).
export const PAID_SHOWN_DAYS = 30;

// The steps built so far; later pull requests add theirs here. A step with no
// `to` keeps the order at its stage.
export const STEPS = {
  applied: { from: ['quote'], to: 'waiting' },
  // From the certificate on the hold is firm until collection (decision 3,
  // docs/decisions/2026-10-02-cycle-to-work-review.md): no end date to move, and
  // nothing to release.
  hold_longer: { from: ['quote', 'waiting'], to: null },
  released: { from: ['quote', 'waiting'], to: null },
  // The certificate (cw-certificate); with the "bike is ready" tick the route
  // moves it on to ready in the same step.
  certificate: { from: ['quote', 'waiting'], to: 'certificate' },
  ready: { from: ['certificate'], to: 'ready' },
  ready_undone: { from: ['ready'], to: 'certificate' },
  // Ordering the bike from the supplier (cw-ordered, cw-order-anyway), and its Undo.
  ordered: { from: ['quote', 'waiting', 'certificate'], to: null },
  order_undone: { from: ['quote', 'waiting', 'certificate'], to: null },
  // Cancel the order (cw-cancel): from any stage before collection.
  cancelled: { from: ['quote', 'waiting', 'certificate', 'ready'], to: 'cancelled' },
};
// The stages an order can still be holding a bike in.
const OPEN = "('quote', 'waiting', 'certificate', 'ready')";

export class Refused extends Error {
  constructor(status, body) { super(body.error); this.status = status; this.body = body; }
}
export const WRONG_STAGE = { error: 'This order has moved on. Refresh to see where it is now.', code: 'wrong_stage' };
export const NOT_HELD = { error: 'This bike isn’t held for the order any more. Refresh to see where it is now.', code: 'not_held' };

export function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
// "8 September 2026", as the quote and its email print a date.
export const longDate = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export const shopTimeZone = async () => (await prepare('SELECT time_zone FROM workshop_settings LIMIT 1').get())?.time_zone || 'Europe/London';
export const shopDay = async () => shopToday(await shopTimeZone());

// How many of the bike are free at the site (design 4): its frames in stock there
// (a held frame is 'held'), or, for a bike with no frame numbers, the site's stock
// figure less the open orders holding it there as a count.
const hasFrames = async (productId) => Boolean(await prepare('SELECT 1 FROM stock_frames WHERE product_id = ? LIMIT 1').get(productId));
export async function heldHere(productId, siteId) {
  return (await prepare(`SELECT count(*)::int AS n FROM c2w_orders WHERE product_id = ? AND site_id = ? AND held_at IS NOT NULL AND stage IN ${OPEN}`).get(productId, siteId)).n;
}
export async function freeHere(productId, siteId) {
  if (await hasFrames(productId)) {
    return (await prepare("SELECT count(*)::int AS n FROM stock_frames WHERE product_id = ? AND site_id = ? AND state = 'in_stock'").get(productId, siteId)).n;
  }
  const qty = (await prepare('SELECT qty FROM product_stock WHERE site_id = ? AND product_id = ?').get(siteId, productId))?.qty ?? 0;
  return Math.max(0, qty - (await heldHere(productId, siteId)));
}

/**
 * Holds one of the bike at the site for the order, in the caller's transaction:
 * the product's stock lock first, so two quotes for the last one queue and only
 * one gets it. A bike with frame numbers takes the frame booked in longest ago
 * (locked FOR UPDATE); one without is a count on the order. Returns { frameId },
 * or null when none is free.
 */
export async function takeHold(orderId, productId, siteId) {
  await lockStock([productId]);
  if (await hasFrames(productId)) {
    const frame = await prepare("SELECT id FROM stock_frames WHERE product_id = ? AND site_id = ? AND state = 'in_stock' ORDER BY received_at, id LIMIT 1 FOR UPDATE").get(productId, siteId);
    if (!frame) return null;
    await prepare("UPDATE stock_frames SET state = 'held', c2w_order_id = ? WHERE id = ? RETURNING id").get(orderId, frame.id);
    return { frameId: frame.id };
  }
  return (await freeHere(productId, siteId)) > 0 ? { frameId: null } : null;
}

// Lets the order's bike go: its frame back in stock, or its count back to free.
// Only a frame still held for this order goes back on sale; one sold some other
// way stays sold.
export async function releaseHold(row) {
  await lockStock([row.product_id]);
  if (row.frame_id) await prepare("UPDATE stock_frames SET state = 'in_stock', c2w_order_id = NULL WHERE id = ? AND c2w_order_id = ? AND state = 'held' RETURNING id").get(row.frame_id, row.id);
}

// Dates come back as YYYY-MM-DD text, never as a Date at some time zone's midnight.
const DAY = (col) => `to_char(o.${col}, 'YYYY-MM-DD') AS ${col}_day`;
// On order: a line naming the order, still to come, on a supplier order that's a draft or
// sent and not yet all in. A cancelled or closed one doesn't count, so the bike can be
// ordered again.
const ON_ORDER = `FROM purchase_order_items i JOIN purchase_orders po ON po.id = i.purchase_order_id
    WHERE i.c2w_order_id = o.id AND po.status IN ('draft', 'ordered', 'partially_received') AND i.qty_received < i.qty_ordered`;
export const ORDER_SELECT = `SELECT o.*, ${['valid_until', 'hold_until', 'certificate_received_on', 'expected_by', 'paid_on'].map(DAY).join(', ')},
  c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone, p.name AS provider_name, pr.name AS bike_name, st.name AS site_name,
  EXISTS (SELECT 1 ${ON_ORDER}) AS on_order,
  (SELECT i.purchase_order_id ${ON_ORDER} ORDER BY i.id DESC LIMIT 1) AS on_order_po,
  (SELECT s.name FROM suppliers s WHERE s.id = (SELECT po.supplier_id ${ON_ORDER} ORDER BY i.id DESC LIMIT 1)) AS on_order_from,
  -- The supplier ordering uses: the product's supplier matched to Settings' by name (restock's nameKey).
  (SELECT s.name FROM suppliers s WHERE btrim(pr.supplier) <> '' AND lower(btrim(s.name)) = lower(btrim(pr.supplier)) ORDER BY s.id LIMIT 1) AS bike_supplier,
  -- cw-certificate-released "and has since been sold": the frame the order last released has gone.
  (SELECT sf.state = 'sold' FROM (SELECT e.detail->>'frameId' AS fid FROM c2w_order_events e
    WHERE e.order_id = o.id AND e.kind = 'released' ORDER BY e.id DESC LIMIT 1) last
    JOIN stock_frames sf ON sf.id::text = last.fid) AS released_sold
  FROM c2w_orders o
  JOIN customers c ON c.id = o.customer_id
  JOIN c2w_providers p ON p.id = o.provider_id
  JOIN products pr ON pr.id = o.product_id
  LEFT JOIN sites st ON st.id = o.site_id`;

const iso = (t) => (t ? new Date(t).toISOString() : null);

// Not in stock when quoted: the hold was wanted but there was nothing to hold
// ("Don't hold" is only offered for a bike that's in stock, cw-new). A bike held
// and then released was in stock. Ordering in (pull request 6) fills in the order line.
// From the certificate on, every order needs its bike: one not held is not in stock.
export const notInStock = (r) => (['certificate', 'ready'].includes(r.stage)
  ? !r.held_at && !r.frame_id
  : r.hold_wanted && !r.held_at && !r.released_at && !r.frame_id);
// Who pays what (cw-order-certificate): the provider pays up to the certificate,
// the customer the rest at collection.
export const providerPays = (r) => (r.certificate_pence === null ? null : Math.min(r.certificate_pence, r.total_pence));

// Ready to order: a bike that wasn't in stock, the shop's rule says it's time,
// and nothing is on order for it yet.
export function readyToOrder(r, rule) {
  if (!notInStock(r) || r.on_order) return false;
  if (rule === 'certificate') return r.stage === 'certificate';
  if (rule === 'applied') return r.stage === 'waiting' || r.stage === 'certificate';
  return false;
}

// What the list's button on a row does next.
export function nextFor(r, rule, today) {
  if (r.stage === 'quote' || r.stage === 'waiting') {
    if (r.hold_until_day && r.hold_until_day < today) return 'choose';
    return readyToOrder(r, rule) ? 'order' : 'certificate';
  }
  if (r.stage === 'certificate') return readyToOrder(r, rule) ? 'order' : 'ready';
  if (r.stage === 'ready') return 'handover';
  if (r.stage === 'collected') return 'paid';
  return null;
}

// Staff without "Can see costs and margin" still see what's expected (decision H3);
// the commission is on the provider, and the owed totals are on the list, for costs only.
export function serializeOrder(r) {
  return {
    id: r.id, stage: r.stage, quoteNumber: r.quote_number, quoteRef: quoteRef(r.quote_number),
    customerId: r.customer_id, customerName: r.customer_name, providerId: r.provider_id, providerName: r.provider_name,
    // The customer's number and email, and the site's name, for the order page (cw-order-held; PR 4).
    customerPhone: r.customer_phone ?? null, customerEmail: r.customer_email ?? null,
    productId: r.product_id, bike: r.bike_name, siteId: r.site_id, siteName: r.site_name ?? null, frameId: r.frame_id,
    onOrder: Boolean(r.on_order),
    quoteGivenAt: iso(r.quote_given_at), quoteRevisedAt: iso(r.quote_revised_at),
    validUntil: r.valid_until_day, holdUntil: r.hold_until_day, holdWanted: r.hold_wanted,
    accessories: r.accessories, totalPence: r.total_pence,
    appliedAt: iso(r.applied_at), applicationReference: r.application_reference,
    certificateNumber: r.certificate_number, certificatePence: r.certificate_pence, certificateReceivedOn: r.certificate_received_on_day,
    differenceChoice: r.difference_choice, providerPaysPence: providerPays(r),
    customerPaysPence: r.certificate_pence === null ? null : r.total_pence - providerPays(r),
    certificateLate: r.certificate_received_on_day !== null && r.certificate_received_on_day > r.valid_until_day,
    saleId: r.sale_id, collectedAt: iso(r.collected_at), paidOn: r.paid_on_day, closeReason: r.close_reason,
    inStock: !notInStock(r), held: Boolean(r.held_at),
    onOrder: Boolean(r.on_order), purchaseOrderId: r.on_order_po ?? null, orderedFrom: r.on_order_from ?? null, supplier: r.bike_supplier ?? null, releasedAt: iso(r.released_at), releasedSold: Boolean(r.released_sold), expectedPence: r.expected_pence, expectedBy: r.expected_by_day, paidPence: r.paid_pence, providerReference: r.provider_reference,
  };
}

export async function addEvent(orderId, kind, who, { reason = null, detail = {} } = {}) {
  // The name goes with the line, because the Owner's sign-in has no staff record.
  await prepare('INSERT INTO c2w_order_events (order_id, kind, employee_id, reason, detail) VALUES (?, ?, ?, ?, ?::jsonb)')
    .run(orderId, kind, who.employeeId ?? null, reason, JSON.stringify({ ...detail, by: who.name ?? null }));
}

export async function eventsOf(orderId) {
  const rows = await prepare(`SELECT e.kind, e.reason, e.detail, e.created_at, emp.name AS employee_name
    FROM c2w_order_events e LEFT JOIN employees emp ON emp.id = e.employee_id
    WHERE e.order_id = ? ORDER BY e.created_at, e.id`).all(orderId);
  return rows.map(({ detail: { by, ...detail }, ...r }) => ({ kind: r.kind, by: r.employee_name ?? by ?? null, at: iso(r.created_at), reason: r.reason, detail }));
}

/**
 * One step on one order: lock it, check its stage allows the step, run
 * `change(row)` (which returns the columns to set), move the stage and add the
 * line. Throws Refused for a missing order or the wrong stage, with nothing changed.
 */
export async function takeStep(orderId, stepName, who, change, { detail = {}, reason = null } = {}) {
  const step = STEPS[stepName];
  const row = Number.isInteger(orderId)
    ? await prepare("SELECT *, to_char(hold_until, 'YYYY-MM-DD') AS hold_until_day FROM c2w_orders WHERE id = ? FOR UPDATE").get(orderId)
    : null;
  if (!row) throw new Refused(404, { error: 'Not found' });
  if (!step.from.includes(row.stage)) throw new Refused(409, WRONG_STAGE);
  // `change` may add to `detail` from the row it was given, and may set a later stage.
  const fields = { ...(step.to ? { stage: step.to } : {}), ...(await change(row)) };
  const cols = Object.keys(fields);
  if (cols.length) await prepare(`UPDATE c2w_orders SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...Object.values(fields), orderId);
  await addEvent(orderId, stepName, who, { detail, reason });
}

/**
 * A bike ordered for the order has been booked in (rs-frame-c2w, rs-booked-c2w), in the
 * delivery's transaction: its frame (or, with no frame numbers, a count) is held for the
 * order, and an order with its certificate in moves to Ready to collect. An order that
 * has moved on, or already has its bike, leaves the bike on sale like any other. The event
 * names the delivery, so Delivery booked in can list what it put aside.
 */
export async function bookedInForOrder(orderId, frameId, siteId, who, deliveryId = null) {
  const row = await prepare('SELECT * FROM c2w_orders WHERE id = ? FOR UPDATE').get(orderId);
  if (!row || !['quote', 'waiting', 'certificate'].includes(row.stage) || row.held_at || row.frame_id) return;
  // Booked in at another shop from the order's: it goes on sale there.
  if (row.site_id !== null && siteId !== null && siteId !== row.site_id) return;
  let held;
  if (frameId) {
    await lockStock([row.product_id]);
    held = await prepare("UPDATE stock_frames SET state = 'held', c2w_order_id = ? WHERE id = ? AND state = 'in_stock' RETURNING id").get(orderId, frameId);
    held = held ? { frameId } : null;
  } else held = await takeHold(orderId, row.product_id, row.site_id ?? siteId);
  if (!held) return;
  const ready = row.stage === 'certificate';
  await prepare(`UPDATE c2w_orders SET frame_id = ?, held_at = now()${ready ? ", stage = 'ready'" : ''} WHERE id = ?`).run(held.frameId, orderId);
  await addEvent(orderId, 'booked_in', who, { detail: { ...(held.frameId ? { frameId: held.frameId } : {}), ...(ready ? { ready: true } : {}), ...(deliveryId ? { deliveryId } : {}) } });
  // Ready with the bike's arrival: the customer is told (design 9).
  if (ready) await (await import('./messages.js')).queueC2wMessage(orderId, 'c2w_ready', { loginId: who.loginId ?? null });
}

// The closing paragraph of the quote (cw-quote, cw-new-not-in-stock; decision H5):
// the hold, or what makes the shop order the bike, then how long it's valid.
const orderSentence = (r, rule) => `${r.bike_name} isn’t in stock. We’ll order it once ${rule === 'applied' ? 'you’ve applied' : 'your certificate reaches us'}, and let you know when it arrives.`;
export function quoteClosing(r, rule) {
  const valid = `This quote is valid until ${longDate(r.valid_until_day)}.`;
  if (r.hold_until_day) return `We’re holding your bike until ${longDate(r.hold_until_day)}. ${valid} Once your certificate reaches us, it’s yours to collect.`;
  if (notInStock(r)) return `${orderSentence(r, rule)} ${valid}`;
  return valid;
}
// The email's middle paragraph (cw-email) says the same with its own last sentence.
export function emailClosing(r, rule) {
  const valid = `This quote is valid until ${longDate(r.valid_until_day)}.`;
  if (notInStock(r)) return `${orderSentence(r, rule)} ${valid}`;
  const tail = 'We’ll let you know as soon as your certificate reaches us.';
  return r.hold_until_day ? `We’re holding your bike until ${longDate(r.hold_until_day)}. ${valid} ${tail}` : `${valid} ${tail}`;
}
export function quoteItems(r) {
  const bikePence = r.total_pence - r.accessories.reduce((sum, a) => sum + a.pricePence, 0);
  return [{ productId: r.product_id, name: r.bike_name, pricePence: bikePence }, ...r.accessories.map((a) => ({ productId: a.productId, name: a.name, pricePence: a.pricePence }))];
}
