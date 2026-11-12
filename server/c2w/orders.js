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

export const QUOTE_PREFIX = 'CW-';
export const quoteRef = (n) => `${QUOTE_PREFIX}${n}`;

// The groups on the list (cw-list), in order.
export const GROUPS = { waiting: ['quote', 'waiting'], certificate: ['certificate'], ready: ['ready'], collected: ['collected'], paid: ['paid'] };
// "Paid · last 30 days" (design, decided while building 3).
export const PAID_SHOWN_DAYS = 30;

// The steps built so far; later pull requests add theirs here.
export const STEPS = {
  applied: { from: ['quote'], to: 'waiting' },
};

export class Refused extends Error {
  constructor(status, body) { super(body.error); this.status = status; this.body = body; }
}
export const WRONG_STAGE = { error: 'This order has moved on. Refresh to see where it is now.', code: 'wrong_stage' };

export function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
// "8 September 2026", as the quote and its email print a date.
export const longDate = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export const shopTimeZone = async () => (await prepare('SELECT time_zone FROM workshop_settings LIMIT 1').get())?.time_zone || 'Europe/London';
export const shopDay = async () => shopToday(await shopTimeZone());

// How many of the bike are free at the site: its frames in stock there, or, for a
// bike with no frame numbers, the site's stock figure (design 4). Holding (pull
// request 5) takes one under a lock and leaves held ones out.
export async function freeHere(productId, siteId) {
  const frames = await prepare("SELECT count(*)::int AS known, count(*) FILTER (WHERE state = 'in_stock' AND site_id = ?)::int AS free FROM stock_frames WHERE product_id = ?").get(siteId, productId);
  if (frames.known > 0) return frames.free;
  return (await prepare('SELECT qty FROM product_stock WHERE site_id = ? AND product_id = ?').get(siteId, productId))?.qty ?? 0;
}

// Dates come back as YYYY-MM-DD text, never as a Date at some time zone's midnight.
const DAY = (col) => `to_char(o.${col}, 'YYYY-MM-DD') AS ${col}_day`;
export const ORDER_SELECT = `SELECT o.*, ${['valid_until', 'hold_until', 'certificate_received_on', 'expected_by', 'paid_on'].map(DAY).join(', ')},
  c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone, p.name AS provider_name, pr.name AS bike_name, st.name AS site_name,
  EXISTS (SELECT 1 FROM purchase_order_items i WHERE i.c2w_order_id = o.id) AS on_order
  FROM c2w_orders o
  JOIN customers c ON c.id = o.customer_id
  JOIN c2w_providers p ON p.id = o.provider_id
  JOIN products pr ON pr.id = o.product_id
  LEFT JOIN sites st ON st.id = o.site_id`;

const iso = (t) => (t ? new Date(t).toISOString() : null);

// Not in stock when quoted: the hold was wanted but there was nothing to hold
// ("Don't hold" is only offered for a bike that's in stock, cw-new). Holding
// (pull request 5) and ordering in (pull request 6) fill in the frame and the order line.
export const notInStock = (r) => r.hold_wanted && !r.hold_until_day && !r.frame_id;

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
    saleId: r.sale_id, collectedAt: iso(r.collected_at), paidOn: r.paid_on_day, closeReason: r.close_reason,
    inStock: !notInStock(r), expectedPence: r.expected_pence, expectedBy: r.expected_by_day, paidPence: r.paid_pence, providerReference: r.provider_reference,
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
  const row = Number.isInteger(orderId) ? await prepare('SELECT * FROM c2w_orders WHERE id = ? FOR UPDATE').get(orderId) : null;
  if (!row) throw new Refused(404, { error: 'Not found' });
  if (!step.from.includes(row.stage)) throw new Refused(409, WRONG_STAGE);
  const fields = { ...(await change(row)), stage: step.to };
  const cols = Object.keys(fields);
  await prepare(`UPDATE c2w_orders SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...Object.values(fields), orderId);
  await addEvent(orderId, stepName, who, { detail, reason });
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
