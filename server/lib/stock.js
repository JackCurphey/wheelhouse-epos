// The one place stock changes (openspec/changes/stock-movements-say-who; stock
// control decision 6; Release 2 rule 3). Every change writes products.stock_qty and
// its history line in the caller's transaction: who, why, which shop and what caused
// it. tests/stock-movements-one-place.test.js fails if stock is written anywhere else.
import { prepare } from '../db.js';
import { nowIso } from './http.js';

// How long stock waits for a product someone else holds, then gives up and answers
// busy (server.js), rather than holding a connection until the server has none left.
export const STOCK_LOCK_WAIT = '2s';

// The same limit for what a stock change locks before its products (an order, a
// count, a request key), so nothing ahead of them can wait without one.
export const limitLockWait = (wait = STOCK_LOCK_WAIT) => prepare(`SET LOCAL lock_timeout = '${wait}'`).run();

// Takes the products in id order, the one order everything uses, so two changes queue
// rather than deadlock. NO KEY UPDATE, not UPDATE: a foreign-key check on a product (a
// line saved at the same moment) takes KEY SHARE, which FOR UPDATE would wait on. In
// the caller's transaction, holding until it ends. `wait`: how long, or false to keep
// the wait the caller has already set. Returns the rows as they are now.
export async function lockStock(productIds, { wait = STOCK_LOCK_WAIT } = {}) {
  const ids = [...new Set(productIds)];
  if (ids.length === 0) return [];
  if (wait) await limitLockWait(wait);
  return prepare('SELECT id, name, stock_qty FROM products WHERE id = ANY(?::int[]) ORDER BY id FOR NO KEY UPDATE').all(ids);
}

/**
 * Changes stock and writes each change's history line, in the caller's transaction.
 *
 * `moves`, each: { productId, change, type, note, reason, valuePence, toSee, and what
 * caused it: purchaseOrderId, deliveryId, stockTakeId, tillSaleId, saleId, shopifyRefundId }.
 * `who`: { loginId, employeeId, name, siteId }: the sign-in, the person (who may be
 * someone checked in under it), and the shop; a shop not given is the business's
 * oldest, if it has one yet. Background work with nobody behind it sends none.
 * `neverBelowZero`: a change taking a product under zero refuses the whole call, and
 * going up is always allowed, so Found works on a product below zero.
 * `held`: what lockStock returned, when the caller already holds these, to save locking twice.
 *
 * Returns { refused, missing, products, pushes, lineOf }: `refused`, the product that
 * would go below zero, with nothing written (the caller rolls back and says so);
 * `missing`, ids no longer held, which get no line; `products`, id to the row after;
 * `pushes`, what to send Shopify after COMMIT; `lineOf`, id to its newest line's id.
 */
export async function moveStock(moves, who = {}, { neverBelowZero = false, wait, held: alreadyHeld } = {}) {
  const result = { refused: null, missing: [], products: new Map(), pushes: [], lineOf: new Map() };
  if (moves.length === 0) return result;
  const held = new Map((alreadyHeld ?? await lockStock(moves.map((m) => m.productId), { wait })).map((p) => [p.id, p]));

  // Several lines can be on one product, and one statement can only change it once.
  const totals = new Map();
  for (const m of moves) if (held.has(m.productId)) totals.set(m.productId, (totals.get(m.productId) ?? 0) + m.change);
  if (neverBelowZero) {
    for (const [id, change] of totals) {
      if (change < 0 && held.get(id).stock_qty + change < 0) return { ...result, refused: held.get(id) };
    }
  }
  result.missing = [...new Set(moves.map((m) => m.productId))].filter((id) => !held.has(id));
  const stocked = moves.filter((m) => held.has(m.productId));
  if (stocked.length === 0) return result;

  const ids = [...totals.keys()].sort((a, b) => a - b);
  const updated = await prepare(
    `UPDATE products p SET stock_qty = p.stock_qty + v.d, updated_at = ?
       FROM unnest(?::int[], ?::int[]) AS v(id, d) WHERE p.id = v.id RETURNING p.*`
  ).all(nowIso(), ids, ids.map((id) => totals.get(id)));
  for (const product of updated) {
    result.products.set(product.id, product);
    if (product.shopify_inventory_item_id) result.pushes.push({ product, newQty: product.stock_qty });
  }

  const siteId = who.siteId ?? (await prepare('SELECT id FROM sites ORDER BY id LIMIT 1').get())?.id ?? null;
  const column = (read) => stocked.map((m) => read(m) ?? null);
  const lines = await prepare(
    `INSERT INTO stock_movements (product_id, change_qty, type, note, reason, value_pence, to_see, login_id, employee_id, who_name, site_id,
                                  purchase_order_id, delivery_id, stock_take_id, till_sale_id, sale_id, shopify_refund_id)
     SELECT v.* FROM unnest(?::int[], ?::int[], ?::text[], ?::text[], ?::text[], ?::bigint[], ?::boolean[], ?::int[], ?::int[], ?::text[], ?::int[],
                            ?::int[], ?::int[], ?::int[], ?::int[], ?::int[], ?::text[])
       AS v RETURNING id, product_id`
  ).all(
    column((m) => m.productId), column((m) => m.change), column((m) => m.type), column((m) => m.note ?? ''), column((m) => m.reason),
    column((m) => m.valuePence), column((m) => m.toSee ?? false), stocked.map(() => who.loginId ?? null), stocked.map(() => who.employeeId ?? null),
    stocked.map(() => who.name ?? null), stocked.map(() => siteId),
    column((m) => m.purchaseOrderId), column((m) => m.deliveryId), column((m) => m.stockTakeId), column((m) => m.tillSaleId), column((m) => m.saleId), column((m) => m.shopifyRefundId)
  );
  for (const line of lines) result.lineOf.set(line.product_id, line.id);
  return result;
}
