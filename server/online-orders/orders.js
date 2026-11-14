// screens: on-orders, on-orders-ready, on-orders-sold-at-till, on-order-staff, on-not-ready, on-hand-over
// The staff's online orders (openspec/changes/website-buy-online, design 5, 7
// and 10; tasks 6.1–6.7): the list in three groups, Mark ready and its Undo,
// Not ready after all and Hand over. Paying (group 5) made the order and took
// the stock off; nothing here takes money or moves stock. Run inside
// runWithShop; the steps inside the caller's transaction.
import { prepare } from '../db.js';
import { currentMoment } from '../clock.js';
import { addDays, Refused, shopDay, shopTimeZone, WRONG_STAGE } from '../c2w/orders.js';
import { orderReference } from './numbers.js';
import { orderEmailProblem } from './messages.js';

export { Refused, WRONG_STAGE };
export const NOT_ON_SHELF = { error: 'Sold at the till. Open the order to sort it.', code: 'not_on_shelf' };
// Undo once the ready email has gone: the customer already has it.
export const TOO_LATE = { error: 'The ready email has gone. Use “Not ready after all” instead.', code: 'too_late' };
export const OPEN_STAGES = ['to_get_ready', 'ready'];
const COLLECTED_SHOWN_MS = 7 * 24 * 3600_000;

export const GROUPS = [
  { key: 'to_get_ready', title: 'To get ready', hint: 'Mark ready when everything’s on the shelf for collection — the customer is told straight away.' },
  { key: 'ready', title: 'Ready to collect', hint: 'Hand over opens the till’s hand-over for that order — it’s already paid.' },
  { key: 'collected', title: 'Collected', hint: 'The last 7 days. Older orders are on each customer’s page.' },
];

const iso = (t) => (t ? new Date(t).toISOString() : null);
const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export async function orderSettings() {
  const row = await prepare('SELECT remind_days, keep_days, shelf_name FROM online_order_settings').get();
  return { remindDays: row?.remind_days ?? 3, keepDays: row?.keep_days ?? 7, shelfName: row?.shelf_name ?? null };
}

/**
 * Lines sold at the till anyway (design 5, "Not on the shelf any more"): where
 * a shop's figure for a product is below 0, open orders there wait for more
 * than is on the shelf, as paying took them off. Orders still to get ready
 * are short first (a ready order's items are already on the collection
 * shelf), the newest first, until the shortfall is covered. Returns the
 * set of line ids. Lines already refunded (group 7) wait for nothing.
 */
export async function linesNotOnShelf() {
  const rows = await prepare(
    `SELECT l.id, l.qty, l.product_id, o.site_id, ps.qty AS stock
     FROM online_order_lines l
     JOIN online_orders o ON o.id = l.order_id
     JOIN product_stock ps ON ps.site_id = o.site_id AND ps.product_id = l.product_id
     WHERE o.stage IN ('to_get_ready', 'ready') AND l.refunded_at IS NULL AND ps.qty < 0
     ORDER BY o.site_id, l.product_id, (o.stage = 'ready'), o.paid_at DESC, o.id DESC, l.id DESC`,
  ).all();
  const short = new Set();
  const covered = new Map();
  for (const r of rows) {
    const key = `${r.site_id}:${r.product_id}`;
    const done = covered.get(key) ?? 0;
    if (done >= -r.stock) continue;
    short.add(r.id);
    covered.set(key, done + r.qty);
  }
  return short;
}

/**
 * The orders staff see: paid and open, or collected in the last 7 days. With
 * `siteId` (a till's or workshop computer's own shop), only that shop's.
 * `ids` narrows it to those orders, whatever their stage, for one order's page;
 * `full` adds the email, how it was paid and the shelf, which only that page shows.
 */
export async function listOrders({ siteId = null, ids = null, full = false } = {}) {
  const tz = await shopTimeZone();
  const today = await shopDay();
  const settings = await orderSettings();
  const since = new Date(currentMoment().getTime() - COLLECTED_SHOWN_MS).toISOString();
  const where = ids
    ? ['o.id = ANY(?::int[])']
    : ["(o.stage IN ('to_get_ready', 'ready') OR (o.stage = 'collected' AND o.collected_at >= ?))"];
  const params = [tz, ids ?? since];
  if (siteId) { where.push('o.site_id = ?'); params.push(siteId); }
  const orders = await prepare(
    `SELECT o.id, o.number, o.stage, o.name, o.phone, o.email, o.credit_pence, o.card_pence, o.total_pence, o.site_id, o.paid_at, o.ready_at, o.collected_at,
            to_char(o.keep_until, 'YYYY-MM-DD') AS keep_until,
            to_char(o.ready_at AT TIME ZONE ?, 'YYYY-MM-DD') AS ready_day, s.name AS site_name
     FROM online_orders o LEFT JOIN sites s ON s.id = o.site_id
     WHERE o.paid_at IS NOT NULL AND ${where.join(' AND ')}
     ORDER BY o.paid_at, o.id`,
  ).all(...params);
  if (!orders.length) return [];
  const orderIds = orders.map((o) => o.id);
  const lines = await prepare(
    `SELECT l.id, l.order_id, l.product_id, l.qty, l.refunded_at, p.name
     FROM online_order_lines l LEFT JOIN products p ON p.id = l.product_id
     WHERE l.order_id = ANY(?::int[]) ORDER BY l.id`,
  ).all(orderIds);
  const collectors = new Map((await prepare(
    `SELECT DISTINCT ON (order_id) order_id, detail->>'by' AS by FROM online_order_events
     WHERE order_id = ANY(?::int[]) AND kind = 'collected' ORDER BY order_id, id DESC`,
  ).all(orderIds)).map((r) => [r.order_id, r.by]));
  const short = await linesNotOnShelf();
  const out = [];
  for (const o of orders) {
    const items = lines.filter((l) => l.order_id === o.id).map((l) => {
      const notOnShelf = short.has(l.id);
      return { productId: l.product_id, name: l.name, qty: l.qty, where: whereItIs(o.stage, l, notOnShelf, settings.shelfName), notOnShelf };
    });
    const late = o.stage === 'ready' && o.ready_day && daysBetween(o.ready_day, today) >= settings.remindDays;
    out.push({
      id: o.id,
      number: o.number,
      reference: orderReference(o.number),
      stage: o.stage,
      customer: o.name,
      phone: o.phone,
      siteId: o.site_id,
      how: `Collect · ${o.site_name ?? ''}`.trim(),
      paidAt: iso(o.paid_at),
      readyAt: iso(o.ready_at),
      keepUntil: o.keep_until,
      notCollectedDays: late ? daysBetween(o.ready_day, today) : null,
      collectedAt: iso(o.collected_at),
      collectedBy: collectors.get(o.id) ?? null,
      emailProblem: o.stage === 'ready' ? await orderEmailProblem(o.id) : null,
      markReadyOff: o.stage === 'to_get_ready' && items.some((i) => i.notOnShelf) ? NOT_ON_SHELF.error : null,
      items,
      ...(full ? {
        email: o.email,
        paid: { creditPence: o.credit_pence, cardPence: o.card_pence, totalPence: o.total_pence },
        shelfName: settings.shelfName,
      } : {}),
    });
  }
  return out;
}

function whereItIs(stage, line, notOnShelf, shelfName) {
  if (line.refunded_at) return 'Couldn’t supply · refunded';
  if (notOnShelf) return 'Not on the shelf any more';
  if (stage === 'to_get_ready') return 'On the shelf';
  // With no shelf named in Settings yet, the group's own words.
  if (stage === 'ready') return shelfName ? `Waiting at ${shelfName}` : 'Ready to collect';
  return null;
}

export async function groupedOrders(options) {
  const rows = await listOrders(options);
  return GROUPS.map((g) => ({ ...g, orders: rows.filter((r) => r.stage === g.key) }));
}

export async function toGetReadyCount({ siteId = null } = {}) {
  const row = siteId
    ? await prepare("SELECT count(*)::int AS n FROM online_orders WHERE stage = 'to_get_ready' AND site_id = ?").get(siteId)
    : await prepare("SELECT count(*)::int AS n FROM online_orders WHERE stage = 'to_get_ready'").get();
  return row.n;
}

export async function oneOrder(id) {
  const [row] = await listOrders({ ids: [id], full: true });
  return row ?? null;
}

// The name goes with the line, because the Owner's sign-in has no staff record.
async function addEvent(orderId, kind, who, detail = {}) {
  await prepare('INSERT INTO online_order_events (order_id, kind, employee_id, detail) VALUES (?, ?, ?, ?::jsonb)')
    .run(orderId, kind, who.employeeId ?? null, JSON.stringify({ ...detail, by: who.name ?? null }));
}

const STEPS = {
  ready: { from: ['to_get_ready'], to: 'ready' },
  ready_undone: { from: ['ready'], to: 'to_get_ready' },
  not_ready: { from: ['ready'], to: 'to_get_ready' },
  collected: { from: ['ready'], to: 'collected' },
};

/**
 * One step on an order, holding its row: refused (409 wrong_stage) from any
 * stage the step doesn't start from. Hand over sent again for an order it
 * already collected answers with the order as it is, so a retried press
 * collects it once (spec, "Pressed twice"). Returns false when nothing changed.
 */
export async function takeStep(orderId, stepName, who, detail = {}) {
  const step = STEPS[stepName];
  const row = Number.isInteger(orderId)
    ? await prepare('SELECT id, stage, ready_message_id FROM online_orders WHERE id = ? AND paid_at IS NOT NULL FOR UPDATE').get(orderId)
    : null;
  if (!row) throw new Refused(404, { error: 'Not found' });
  if (stepName === 'collected' && row.stage === 'collected') return false;
  if (!step.from.includes(row.stage)) throw new Refused(409, WRONG_STAGE);
  if (stepName === 'ready_undone' && row.ready_message_id) {
    const message = await prepare('SELECT intent_state FROM customer_messages WHERE id = ?').get(row.ready_message_id);
    if (message && message.intent_state !== 'intended') throw new Refused(409, TOO_LATE);
  }
  let fields;
  if (stepName === 'ready') {
    const short = await linesNotOnShelf();
    const lines = await prepare('SELECT id FROM online_order_lines WHERE order_id = ?').all(orderId);
    if (lines.some((l) => short.has(l.id))) throw new Refused(409, NOT_ON_SHELF);
    const { keepDays } = await orderSettings();
    fields = { ready_at: currentMoment().toISOString(), keep_until: addDays(await shopDay(), keepDays) };
  } else if (stepName === 'collected') {
    fields = { collected_at: currentMoment().toISOString(), collected_by: who.employeeId ?? null };
  } else {
    fields = { ready_at: null, keep_until: null, reminded_at: null };
  }
  const all = { stage: step.to, ...fields };
  const cols = Object.keys(all);
  await prepare(`UPDATE online_orders SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = now() WHERE id = ?`)
    .run(...Object.values(all), orderId);
  await addEvent(orderId, stepName, who, detail);
  return true;
}

/**
 * The till's stock lookup (task 6.6): per product, the open online orders'
 * lines waiting for it, with the order number, until handed over. With
 * `siteId`, that shop's orders only. Map of product id → [{ orderId, reference, qty }].
 */
export async function forOnlineOrders(productIds, siteId = null) {
  if (!productIds.length) return new Map();
  const params = [productIds];
  let atSite = '';
  if (siteId) { atSite = ' AND o.site_id = ?'; params.push(siteId); }
  const rows = await prepare(
    `SELECT l.product_id, o.id AS order_id, o.number, sum(l.qty)::int AS qty
     FROM online_order_lines l JOIN online_orders o ON o.id = l.order_id
     WHERE l.product_id = ANY(?::int[]) AND l.refunded_at IS NULL AND o.stage IN ('to_get_ready', 'ready')${atSite}
     GROUP BY l.product_id, o.id, o.number ORDER BY o.id`,
  ).all(...params);
  const out = new Map();
  for (const r of rows) {
    if (!out.has(r.product_id)) out.set(r.product_id, []);
    out.get(r.product_id).push({ orderId: r.order_id, reference: orderReference(r.number), qty: r.qty });
  }
  return out;
}
