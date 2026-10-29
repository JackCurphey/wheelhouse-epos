// Purchase orders: /api/purchase-orders.
// Staff routes: they run under the dispatcher's /api/ branch (server.js), so
// a handler gets (req, res, params, query, afterRelease, shopId) with the
// shop's row-level security already bound, and needs a staff session.
// Moved out of server.js unchanged (split plan §4.1, WP-0.4).
import { prepare, dbExec } from '../db.js';
import { deferShopifyPushes } from '../lib/sales.js';
import { sendJson, notFound, badRequest, readJsonBody, nowIso, ValidationError } from '../lib/http.js';
import { ownerOnly } from '../lib/owner-only.js';
import { currentSession } from '../lib/session.js';

// The same shim server.js uses: each call reads the request's client.
const db = { prepare, exec: dbExec };

// Build an order against a supplier, then book in deliveries against it
// (increasing product stock). Supports partial/split deliveries: each line
// tracks qty_ordered vs qty_received and can be booked in more than once.
// Step one of eventually importing orders straight from a B2B distributor -
// not built here, this is the manual-entry version.
//
// Making, changing, ordering and closing an order is for the Owner until
// roles bring "Can order stock" (receiving decision 4; WP-1.1); everyone can
// read orders and receive against them (openspec/changes/deliveries-orders).
const ORDER_STOCK = "Only the shop's owner can order stock";
// What can be wrong with a delivered item (receiving decision 9; migration 092).
const PROBLEM_KINDS = ['damaged', 'wrong_item', 'missing'];

// The order's total cost in pounds, as unit_cost is stored (NUMERIC(10,2)),
// rounded to the penny so floating-point sums don't show (3 x 1.10).
const totalCost = (items) => Math.round(items.reduce((sum, it) => sum + it.qty_ordered * it.unit_cost * 100, 0)) / 100;

// A closed order (partly delivered, the rest not coming: Jack's answer 1,
// 27 Oct) or a cancelled one (nothing in) has nothing still to come; what
// had been to come is not coming (openspec/changes/close-part-delivered).
const CLOSED = ['closed', 'cancelled'];

function serializePurchaseOrder(row, items) {
  const closed = CLOSED.includes(row.status);
  return {
    id: row.id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name !== undefined ? row.supplier_name : undefined,
    status: row.status,
    reference: row.reference,
    notes: row.notes,
    orderedAt: row.ordered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: items
      ? items.map((it) => ({
          id: it.id,
          productId: it.product_id,
          name: it.product_name,
          sku: it.product_sku,
          qtyOrdered: it.qty_ordered,
          qtyReceived: it.qty_received,
          outstanding: closed ? 0 : outstanding(it),
          notComing: closed ? Math.max(0, outstanding(it)) : 0,
          unitCost: it.unit_cost,
        }))
      : undefined,
    totalCost: items ? totalCost(items) : undefined,
  };
}

const PO_SELECT = `SELECT po.*, s.name AS supplier_name FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id`;

// Each line with qty_set_aside: its damaged and wrong items recorded at
// booking in (receiving decision 9). They go on To return, not back to "to
// come", so they count against the line as booked-in ones do; a replacement
// is a new line or a new order (second review, 26 Oct). Missing ones never
// arrived and stay to come.
async function loadPurchaseOrderItems(id) {
  return db.prepare(
    `SELECT poi.*,
            COALESCE((SELECT SUM(dp.qty) FROM delivery_problems dp
                      WHERE dp.purchase_order_id = poi.purchase_order_id AND dp.purchase_order_item_id = poi.id
                        AND dp.kind IN ('damaged', 'wrong_item')), 0)::int AS qty_set_aside
     FROM purchase_order_items poi WHERE poi.purchase_order_id = ? ORDER BY poi.id`
  ).all(id);
}
const outstanding = (it) => it.qty_ordered - it.qty_received - (it.qty_set_aside ?? 0);



// The most a line can order, and the most a unit cost can be: the
// NUMERIC(10,2) column's largest. Past these the database answered 500
// (review of 26 Oct).
const MAX_QTY = 100000;
const MAX_UNIT_COST = 99999999.99;

async function loadPoLineItems(items) {
  const loaded = [];
  for (const it of items) {
    const productId = Number(it.productId);
    const qty = Math.trunc(Number(it.qty));
    const unitCost = Number(it.unitCost);
    if (!productId || !Number.isFinite(qty) || qty <= 0) {
      throw new ValidationError('Each item needs a valid productId and positive qty');
    }
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      throw new ValidationError('Each item needs a valid unit cost');
    }
    if (qty > MAX_QTY) throw new ValidationError(`A line can order at most ${MAX_QTY}`);
    if (unitCost > MAX_UNIT_COST) throw new ValidationError('A unit cost can be at most £99,999,999.99');
    const product = await db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(productId);
    if (!product) throw new ValidationError(`Product ${productId} not found or inactive`);
    loaded.push({ product, qty, unitCost });
  }
  return loaded;
}

// A problem's kind, how many and note, or the refusal's words.
function readProblem(p) {
  const qty = Number(p.qty);
  if (!PROBLEM_KINDS.includes(p.kind)) return 'A problem is damaged, wrong_item or missing';
  // Up to the most a line can take (review, 26 Oct: past it was a 500).
  if (!Number.isInteger(qty) || qty <= 0 || qty > MAX_QTY) return 'A problem needs how many, a whole number above 0';
  return { kind: p.kind, qty, note: String(p.note ?? '').trim().slice(0, 500) };
}

// BEGIN, run, then COMMIT, or ROLLBACK when it refused or threw.
async function inTransaction(fn) {
  await db.exec('BEGIN');
  try {
    const done = await fn();
    await db.exec(done.refusal ? 'ROLLBACK' : 'COMMIT');
    return done;
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
}

const refuse = (message) => ({ refusal: (res) => badRequest(res, message) });

/**
 * Books a delivery in, inside the caller's transaction (both receive routes).
 * `lines`: { itemId, qty } on an order line, or { productId, qty } not on an
 * order. `problems`: { itemId | productId, kind, qty, note }. With `orderId`
 * (the order route) every line is on that order; otherwise each order line
 * must be on an order still to come from `supplier`.
 *
 * Atomic and counted once: the orders are locked (FOR UPDATE, in id order)
 * before their lines are read and checked, so a second booking waits, then
 * sees the first one's counts. Stock is added in the UPDATE itself, never
 * from a value read earlier, and every product, on an order or not, is
 * updated in product-id order, as a sale locks its products
 * (server/lib/sales.js), so two deliveries, or a delivery and a sale, wait
 * for each other instead of deadlocking. Each stock movement records who
 * booked it in. Returns { refusal } or { booked, orderIds, shopifyPushes }.
 */
async function bookIn({ orderId = null, supplier = null, lines, problems, loginId }) {
  const onOrder = [...lines, ...problems].filter((x) => x.itemId !== undefined);
  // Which orders: the one named, or the ones the lines are on.
  let orderIds;
  if (orderId !== null) orderIds = [orderId];
  else {
    const ids = new Set();
    for (const { itemId } of onOrder) {
      const found = Number.isInteger(itemId) ? await db.prepare('SELECT purchase_order_id FROM purchase_order_items WHERE id = ?').get(itemId) : null;
      if (!found) return refuse(`Purchase order line ${itemId} not found`);
      ids.add(found.purchase_order_id);
    }
    orderIds = [...ids].sort((a, b) => a - b);
  }
  const orders = new Map();
  const itemsById = new Map();
  for (const id of orderIds) {
    const order = await db.prepare('SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE').get(id);
    if (!order) return { refusal: (res) => notFound(res, 'Purchase order not found') };
    if (!['ordered', 'partially_received'].includes(order.status)) return refuse('This purchase order is not awaiting delivery');
    if (orderId === null && order.supplier_id !== supplier?.id) return refuse(supplier ? 'That line is on another supplier’s order' : 'Pick the supplier this order is from.');
    orders.set(id, order);
    for (const it of await loadPurchaseOrderItems(id)) itemsById.set(it.id, it);
  }
  // What each order line takes from what's still to come: booked in, set
  // aside, or missing. Still to come leaves out what earlier bookings set
  // aside, so the total never passes what was ordered.
  const taken = new Map();
  for (const { itemId, qty } of onOrder) {
    if (!itemsById.has(itemId)) return refuse(`Purchase order line ${itemId} not found`);
    taken.set(itemId, (taken.get(itemId) ?? 0) + qty);
  }
  for (const [itemId, n] of taken) {
    const line = itemsById.get(itemId);
    const left = outstanding(line);
    if (n > left) return refuse(`Cannot receive ${n} of "${line.product_name}" - only ${left} outstanding`);
  }
  // A product not on an order must be the shop's, and on sale.
  const items = [];
  for (const x of lines) {
    if (x.itemId !== undefined) { items.push({ ...x, productId: itemsById.get(x.itemId).product_id }); continue; }
    if (!(await activeProduct(x.productId))) return refuse(`Product ${x.productId} not found or inactive`);
    items.push(x);
  }
  for (const x of problems) {
    if (x.itemId === undefined && !(await activeProduct(x.productId))) return refuse(`Product ${x.productId} not found or inactive`);
  }

  const shopifyPushes = [];
  let booked = 0;
  items.sort((x, y) => x.productId - y.productId || (x.itemId ?? 0) - (y.itemId ?? 0));
  for (const { itemId, productId, qty } of items) {
    let note;
    let fromOrder = null;
    if (itemId !== undefined) {
      fromOrder = orders.get(itemsById.get(itemId).purchase_order_id);
      await db.prepare('UPDATE purchase_order_items SET qty_received = qty_received + ? WHERE id = ?').run(qty, itemId);
      note = `Booked in from PO #${fromOrder.id}${fromOrder.reference ? ` (${fromOrder.reference})` : ''}`;
    } else {
      note = supplier ? `Delivery from ${supplier.name}, not on an order` : 'Delivery, not on an order';
    }
    const product = await db.prepare('UPDATE products SET stock_qty = stock_qty + ?, updated_at = ? WHERE id = ? RETURNING *').get(qty, nowIso(), productId);
    await db.prepare(
      'INSERT INTO stock_movements (product_id, change_qty, type, note, purchase_order_id, login_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(product.id, qty, fromOrder ? 'po_receipt' : 'intake', note, fromOrder?.id ?? null, loginId);
    if (product.shopify_inventory_item_id) shopifyPushes.push({ product, newQty: product.stock_qty });
    booked += qty;
  }
  for (const { itemId, productId, kind, qty, note } of problems) {
    const line = itemId !== undefined ? itemsById.get(itemId) : null;
    const order = line ? orders.get(line.purchase_order_id) : null;
    await db.prepare(
      'INSERT INTO delivery_problems (purchase_order_id, purchase_order_item_id, product_id, supplier_id, kind, qty, note) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(order?.id ?? null, line?.id ?? null, line?.product_id ?? productId, order?.supplier_id ?? supplier?.id ?? null, kind, qty, note);
  }
  // Each order: received when nothing is left to come (booked in or set
  // aside); partly delivered once anything is in stock; otherwise, with only
  // problems marked, as it was.
  for (const [id, order] of orders) {
    const fresh = await loadPurchaseOrderItems(id);
    const status = fresh.every((it) => outstanding(it) <= 0) ? 'received'
      : fresh.some((it) => it.qty_received > 0) ? 'partially_received'
      : order.status;
    if (status !== order.status) {
      await db.prepare('UPDATE purchase_orders SET status = ?, updated_at = ? WHERE id = ?').run(status, nowIso(), id);
    }
  }
  return { booked, orderIds, shopifyPushes };
}
const activeProduct = (id) => (Number.isInteger(id) ? db.prepare('SELECT id FROM products WHERE id = ? AND active = 1').get(id) : null);

export function register(route) {
  route('GET', '/api/purchase-orders', async (req, res, params, query) => {
    const status = query.get('status');
    const supplierId = query.get('supplierId');
    let sql = PO_SELECT + ' WHERE 1=1';
    const args = [];
    if (status) {
      sql += ' AND po.status = ?';
      args.push(status);
    }
    if (supplierId) {
      sql += ' AND po.supplier_id = ?';
      args.push(Number(supplierId));
    }
    sql += ' ORDER BY po.id DESC LIMIT 500';
    const rows = await db.prepare(sql).all(...args);
    const withItems = await Promise.all(
      rows.map(async (r) => serializePurchaseOrder(r, await loadPurchaseOrderItems(r.id)))
    );
    sendJson(res, 200, withItems);
  });

  route('GET', '/api/purchase-orders/:id', async (req, res, params) => {
    const id = Number(params.id);
    const row = await db.prepare(PO_SELECT + ' WHERE po.id = ?').get(id);
    if (!row) return notFound(res, 'Purchase order not found');
    const items = await loadPurchaseOrderItems(id);
    sendJson(res, 200, serializePurchaseOrder(row, items));
  });

  route('POST', '/api/purchase-orders', async (req, res) => {
    if (await ownerOnly(req, res, ORDER_STOCK)) return;
    const body = await readJsonBody(req);
    const supplierId = Number(body.supplierId);
    if (!Number.isInteger(supplierId)) return badRequest(res, 'Supplier not found');
    const supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
    if (!supplier) return badRequest(res, 'Supplier not found');
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) return badRequest(res, 'A purchase order must include at least one item');
    const reference = (body.reference || '').trim();
    const notes = (body.notes || '').trim();
    // New order's Mark as ordered: made already ordered in this one
    // transaction, so a failed second request can't leave a draft behind
    // for a retry to duplicate (review of 26 Oct).
    const ordered = body.markOrdered === true;

    let loaded;
    try {
      loaded = await loadPoLineItems(items);
    } catch (err) {
      if (err instanceof ValidationError) return badRequest(res, err.message);
      throw err;
    }

    await db.exec('BEGIN');
    try {
      const info = await db
        .prepare('INSERT INTO purchase_orders (supplier_id, reference, notes, status, ordered_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(supplierId, reference, notes, ordered ? 'ordered' : 'draft', ordered ? nowIso() : null, nowIso());
      const poId = info.lastInsertRowid;
      for (const { product, qty, unitCost } of loaded) {
        await db.prepare(
          `INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, product_sku, qty_ordered, unit_cost)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(poId, product.id, product.name, product.sku, qty, unitCost);
      }
      await db.exec('COMMIT');
      const row = await db.prepare(PO_SELECT + ' WHERE po.id = ?').get(poId);
      sendJson(res, 201, serializePurchaseOrder(row, await loadPurchaseOrderItems(poId)));
    } catch (err) {
      await db.exec('ROLLBACK');
      throw err;
    }
  });

  route('PUT', '/api/purchase-orders/:id', async (req, res, params) => {
    if (await ownerOnly(req, res, ORDER_STOCK)) return;
    const id = Number(params.id);
    const found = await db.prepare('SELECT status FROM purchase_orders WHERE id = ?').get(id);
    if (!found) return notFound(res, 'Purchase order not found');
    if (found.status !== 'draft') return badRequest(res, 'Only a draft purchase order can be edited');
    const body = await readJsonBody(req);

    // The order is read again FOR UPDATE inside the transaction, so a second
    // save waits for this one and starts from what it wrote, and the draft
    // check is made on the order as it is now: one marked as ordered while
    // this save waited is refused (owner-saves-dont-clash). Booking in locks
    // orders the same way before their lines and products, and refuses a
    // draft, so the two can't wait on each other. The checks, their order and
    // their words are unchanged; a refusal rolls back, having written nothing.
    await db.exec('BEGIN');
    try {
      const existing = await db.prepare('SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE').get(id);
      if (!existing) {
        await db.exec('ROLLBACK');
        return notFound(res, 'Purchase order not found');
      }
      if (existing.status !== 'draft') {
        await db.exec('ROLLBACK');
        return badRequest(res, 'Only a draft purchase order can be edited');
      }

      let supplierId = existing.supplier_id;
      if (body.supplierId !== undefined) {
        supplierId = Number(body.supplierId);
        const supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
        if (!supplier) {
          await db.exec('ROLLBACK');
          return badRequest(res, 'Supplier not found');
        }
      }
      const reference = body.reference !== undefined ? String(body.reference).trim() : existing.reference;
      const notes = body.notes !== undefined ? String(body.notes).trim() : existing.notes;
      const items = Array.isArray(body.items) ? body.items : null;

      let loaded = null;
      if (items) {
        if (items.length === 0) {
          await db.exec('ROLLBACK');
          return badRequest(res, 'A purchase order must include at least one item');
        }
        try {
          loaded = await loadPoLineItems(items);
        } catch (err) {
          if (!(err instanceof ValidationError)) throw err;
          await db.exec('ROLLBACK');
          return badRequest(res, err.message);
        }
      }

      await db.prepare(
        'UPDATE purchase_orders SET supplier_id = ?, reference = ?, notes = ?, updated_at = ? WHERE id = ?'
      ).run(supplierId, reference, notes, nowIso(), id);
      if (loaded) {
        await db.prepare('DELETE FROM purchase_order_items WHERE purchase_order_id = ?').run(id);
        for (const { product, qty, unitCost } of loaded) {
          await db.prepare(
            `INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, product_sku, qty_ordered, unit_cost)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).run(id, product.id, product.name, product.sku, qty, unitCost);
        }
      }
      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK').catch(() => {});
      throw err;
    }

    const row = await db.prepare(PO_SELECT + ' WHERE po.id = ?').get(id);
    sendJson(res, 200, serializePurchaseOrder(row, await loadPurchaseOrderItems(id)));
  });

  route('POST', '/api/purchase-orders/:id/mark-ordered', async (req, res, params) => {
    if (await ownerOnly(req, res, ORDER_STOCK)) return;
    const id = Number(params.id);
    const existing = await db.prepare('SELECT id FROM purchase_orders WHERE id = ?').get(id);
    if (!existing) return notFound(res, 'Purchase order not found');
    // The status is checked in the UPDATE itself, so two requests at once
    // can't both pass a check made beforehand (review of 26 Oct).
    const changed = await db
      .prepare(`UPDATE purchase_orders SET status = 'ordered', ordered_at = ?, updated_at = ? WHERE id = ? AND status = 'draft'`)
      .run(nowIso(), nowIso(), id);
    if (changed.changes === 0) return sendJson(res, 409, { error: 'Only a draft purchase order can be marked as ordered' });
    const row = await db.prepare(PO_SELECT + ' WHERE po.id = ?').get(id);
    sendJson(res, 200, serializePurchaseOrder(row, await loadPurchaseOrderItems(id)));
  });

  route('POST', '/api/purchase-orders/:id/cancel', async (req, res, params) => {
    if (await ownerOnly(req, res, ORDER_STOCK)) return;
    const id = Number(params.id);
    const existing = await db.prepare('SELECT id FROM purchase_orders WHERE id = ?').get(id);
    if (!existing) return notFound(res, 'Purchase order not found');
    // Checked in the UPDATE itself, as mark-ordered is, so a receipt landing
    // between a check and the close can't be dropped (review of 26 Oct). A
    // partly delivered order closes: its lines keep what arrived, and the
    // rest is not coming (Jack's answer 1, 27 Oct; openspec/changes/
    // close-part-delivered). A draft or ordered one with nothing in is
    // cancelled, as before. The status is the part that holds under a race:
    // a receipt locks and changes the order's row in its own transaction, so
    // this UPDATE waits for it and then re-checks the WHERE, and works out the
    // CASE, on the new row. The NOT EXISTS on the lines alone would be re-run
    // against the old snapshot and pass (second review, 26 Oct). A receipt
    // that arrives while this close holds the row waits, then reads it closed
    // and is refused (bookIn).
    const changed = await db
      .prepare(
        `UPDATE purchase_orders SET status = CASE WHEN status = 'partially_received' THEN 'closed' ELSE 'cancelled' END, updated_at = ?
         WHERE id = ? AND (status = 'partially_received'
           OR (status IN ('draft', 'ordered')
               AND NOT EXISTS (SELECT 1 FROM purchase_order_items WHERE purchase_order_id = ? AND qty_received > 0)))`
      )
      .run(nowIso(), id, id);
    if (changed.changes === 0) {
      const now = await db.prepare('SELECT status FROM purchase_orders WHERE id = ?').get(id);
      return sendJson(res, 409, {
        error: now?.status === 'cancelled' ? 'This purchase order is already cancelled'
          : now?.status === 'closed' ? 'This purchase order is already closed'
          : now?.status === 'received' ? 'Everything on this purchase order has arrived'
          : 'This purchase order already has items booked in and cannot be cancelled',
      });
    }
    const row = await db.prepare(PO_SELECT + ' WHERE po.id = ?').get(id);
    sendJson(res, 200, serializePurchaseOrder(row, await loadPurchaseOrderItems(id)));
  });

  // Booking a delivery in against one order (openspec/changes/receive-delivery,
  // the contract): open to everyone (receiving decision 4). `items` go into
  // stock and the line's qty_received; `problems` (decision 9: damaged, wrong
  // item or missing) are recorded and go into neither. The old app uses it;
  // Receive a delivery uses /api/deliveries/receive. Both run bookIn above.
  route('POST', '/api/purchase-orders/:id/receive', async (req, res, params, query, afterRelease, shopId) => {
    const id = Number(params.id);
    const body = await readJsonBody(req);
    const receipts = Array.isArray(body.items) ? body.items : [];
    const problemsIn = Array.isArray(body.problems) ? body.problems : [];

    const lines = [];
    for (const r of receipts) {
      const qty = Math.trunc(Number(r.qtyReceived));
      if (!qty || qty <= 0) continue;
      lines.push({ itemId: Number(r.itemId), qty });
    }
    const problems = [];
    for (const p of problemsIn) {
      const problem = readProblem(p);
      if (typeof problem === 'string') return badRequest(res, problem);
      problems.push({ ...problem, itemId: Number(p.itemId) });
    }
    if (lines.length === 0 && problems.length === 0) return badRequest(res, 'No quantities to receive were provided');

    const loginId = (await currentSession(req))?.login.id ?? null;
    const done = await inTransaction(() => bookIn({ orderId: id, lines, problems, loginId }));
    if (done.refusal) return done.refusal(res);
    // Same reasoning as createSale's shopifyPushes: the HTTP calls wait until
    // after COMMIT and after the request releases its pooled connection;
    // a Shopify hiccup is logged and never fails the receipt.
    deferShopifyPushes(afterRelease, shopId, done.shopifyPushes);
    const row = await db.prepare(PO_SELECT + ' WHERE po.id = ?').get(id);
    sendJson(res, 200, serializePurchaseOrder(row, await loadPurchaseOrderItems(id)));
  });

  // To return to [Supplier] (openspec/changes/to-return; rs-hub; receiving
  // decisions 4, 9 and 10): the damaged and wrong items set aside at booking
  // in and not yet sent back, by supplier (the order's, or the one picked
  // when not on an order): the supplier waiting longest first, none last;
  // each supplier's items oldest first. Missing items are still
  // to come, never returned. For people who can order stock: the Owner,
  // until roles.
  // screens: rs-hub
  route('GET', '/api/deliveries/to-return', async (req, res) => {
    if (await ownerOnly(req, res, ORDER_STOCK)) return;
    const rows = await db.prepare(
      `SELECT dp.id, dp.kind, dp.qty, dp.created_at, p.name AS product_name, s.id AS supplier_id, s.name AS supplier_name
         FROM delivery_problems dp JOIN products p ON p.id = dp.product_id
         LEFT JOIN purchase_orders po ON po.id = dp.purchase_order_id
         LEFT JOIN suppliers s ON s.id = COALESCE(po.supplier_id, dp.supplier_id)
        WHERE dp.kind IN ('damaged', 'wrong_item') AND dp.returned_at IS NULL
        ORDER BY s.id IS NULL, min(dp.created_at) OVER (PARTITION BY s.id), s.id, dp.created_at, dp.id`
    ).all();
    const suppliers = [];
    for (const r of rows) {
      const supplierId = r.supplier_id ?? null;
      let group = suppliers.at(-1);
      if (!group || group.supplierId !== supplierId) suppliers.push(group = { supplierId, supplierName: r.supplier_name ?? null, items: [] });
      group.items.push({ id: r.id, productName: r.product_name, kind: r.kind, qty: r.qty, deliveredAt: new Date(r.created_at).toISOString() });
    }
    sendJson(res, 200, { suppliers });
  });

  // Returned: who and when, once. The row is locked while it is still to
  // return, so two presses at once mark it once (the other is 404); the
  // reply is sent after COMMIT. Stock doesn't change: the item was never
  // added to it.
  // screens: rs-hub
  route('POST', '/api/deliveries/to-return/:id/returned', async (req, res, params) => {
    if (await ownerOnly(req, res, ORDER_STOCK)) return;
    const ctx = await currentSession(req);
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) return notFound(res, 'Nothing to return with that id');
    await db.exec('BEGIN');
    let done;
    try {
      const row = await db.prepare(
        "SELECT id FROM delivery_problems WHERE id = ? AND kind IN ('damaged', 'wrong_item') AND returned_at IS NULL FOR UPDATE"
      ).get(id);
      done = row ? await db.prepare('UPDATE delivery_problems SET returned_at = now(), returned_by_login_id = ? WHERE id = ? RETURNING id, returned_at').get(ctx.login.id, id) : null;
      await db.exec(done ? 'COMMIT' : 'ROLLBACK');
    } catch (err) {
      await db.exec('ROLLBACK').catch(() => {});
      throw err;
    }
    if (!done) return notFound(res, 'Nothing to return with that id');
    sendJson(res, 200, { id: done.id, returnedAt: new Date(done.returned_at).toISOString() });
  });

  // Receive a delivery, with or without an order (openspec/changes/
  // receive-without-order, the contract; receiving decisions 2, 3, 4 and 9):
  // open to everyone. The supplier is optional ("pick the supplier if you
  // like"). An item with `itemId` is booked against that line of one of the
  // supplier's orders still to come; one without is added to stock, not on
  // an order. A problem not on an order is damaged or wrong only.
  route('POST', '/api/deliveries/receive', async (req, res, params, query, afterRelease, shopId) => {
    const body = await readJsonBody(req);
    let supplier = null;
    if (body.supplierId !== null && body.supplierId !== undefined) {
      const supplierId = Number(body.supplierId);
      supplier = Number.isInteger(supplierId) ? await db.prepare('SELECT id, name FROM suppliers WHERE id = ?').get(supplierId) : null;
      if (!supplier) return badRequest(res, 'Supplier not found');
    }
    const lines = [];
    for (const it of Array.isArray(body.items) ? body.items : []) {
      const qty = Number(it.qty);
      if (!Number.isInteger(qty) || qty <= 0 || qty > MAX_QTY) return badRequest(res, 'Each item needs how many, a whole number above 0');
      if (it.itemId !== undefined && it.itemId !== null) lines.push({ itemId: Number(it.itemId), qty });
      else lines.push({ productId: Number(it.productId), qty });
    }
    const problems = [];
    for (const p of Array.isArray(body.problems) ? body.problems : []) {
      const problem = readProblem(p);
      if (typeof problem === 'string') return badRequest(res, problem);
      if (p.itemId !== undefined && p.itemId !== null) problems.push({ ...problem, itemId: Number(p.itemId) });
      else if (problem.kind === 'missing') return badRequest(res, 'Missing is only for an item on an order');
      else problems.push({ ...problem, productId: Number(p.productId) });
    }
    if (lines.length === 0 && problems.length === 0) return badRequest(res, 'Nothing to book in');

    const loginId = (await currentSession(req))?.login.id ?? null;
    const done = await inTransaction(() => bookIn({ supplier, lines, problems, loginId }));
    if (done.refusal) return done.refusal(res);
    deferShopifyPushes(afterRelease, shopId, done.shopifyPushes);
    const orders = [];
    for (const id of done.orderIds) {
      const row = await db.prepare(PO_SELECT + ' WHERE po.id = ?').get(id);
      orders.push(serializePurchaseOrder(row, await loadPurchaseOrderItems(id)));
    }
    sendJson(res, 200, { booked: done.booked, orders });
  });
}
