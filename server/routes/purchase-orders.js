// Purchase orders: /api/purchase-orders.
// Staff routes: they run under the dispatcher's /api/ branch (server.js), so
// a handler gets (req, res, params, query, afterRelease, shopId) with the
// shop's row-level security already bound, and needs a staff session.
// Moved out of server.js unchanged (split plan §4.1, WP-0.4).
import { prepare, dbExec } from '../db.js';
import { deferShopifyPushes } from '../lib/sales.js';
import { sendJson, notFound, badRequest, readJsonBody, nowIso, ValidationError } from '../lib/http.js';
import { ownerOnly } from '../lib/owner-only.js';

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
// What can be wrong with a delivered item (receiving decision 9; migration 090).
const PROBLEM_KINDS = ['damaged', 'wrong_item', 'missing'];

// The order's total cost in pounds, as unit_cost is stored (NUMERIC(10,2)),
// rounded to the penny so floating-point sums don't show (3 x 1.10).
const totalCost = (items) => Math.round(items.reduce((sum, it) => sum + it.qty_ordered * it.unit_cost * 100, 0)) / 100;

function serializePurchaseOrder(row, items) {
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
          outstanding: it.qty_ordered - it.qty_received,
          unitCost: it.unit_cost,
        }))
      : undefined,
    totalCost: items ? totalCost(items) : undefined,
  };
}

const PO_SELECT = `SELECT po.*, s.name AS supplier_name FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id`;

async function loadPurchaseOrderItems(id) {
  return db.prepare('SELECT * FROM purchase_order_items WHERE purchase_order_id = ? ORDER BY id').all(id);
}



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
    const product = await db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(productId);
    if (!product) throw new ValidationError(`Product ${productId} not found or inactive`);
    loaded.push({ product, qty, unitCost });
  }
  return loaded;
}

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
        .prepare('INSERT INTO purchase_orders (supplier_id, reference, notes, updated_at) VALUES (?, ?, ?, ?)')
        .run(supplierId, reference, notes, nowIso());
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
    const existing = await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id);
    if (!existing) return notFound(res, 'Purchase order not found');
    if (existing.status !== 'draft') return badRequest(res, 'Only a draft purchase order can be edited');
    const body = await readJsonBody(req);

    let supplierId = existing.supplier_id;
    if (body.supplierId !== undefined) {
      supplierId = Number(body.supplierId);
      const supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
      if (!supplier) return badRequest(res, 'Supplier not found');
    }
    const reference = body.reference !== undefined ? String(body.reference).trim() : existing.reference;
    const notes = body.notes !== undefined ? String(body.notes).trim() : existing.notes;
    const items = Array.isArray(body.items) ? body.items : null;

    let loaded = null;
    if (items) {
      if (items.length === 0) return badRequest(res, 'A purchase order must include at least one item');
      try {
        loaded = await loadPoLineItems(items);
      } catch (err) {
        if (err instanceof ValidationError) return badRequest(res, err.message);
        throw err;
      }
    }

    await db.exec('BEGIN');
    try {
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
      await db.exec('ROLLBACK');
      throw err;
    }

    const row = await db.prepare(PO_SELECT + ' WHERE po.id = ?').get(id);
    sendJson(res, 200, serializePurchaseOrder(row, await loadPurchaseOrderItems(id)));
  });

  route('POST', '/api/purchase-orders/:id/mark-ordered', async (req, res, params) => {
    if (await ownerOnly(req, res, ORDER_STOCK)) return;
    const id = Number(params.id);
    const existing = await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id);
    if (!existing) return notFound(res, 'Purchase order not found');
    if (existing.status !== 'draft') return badRequest(res, 'Only a draft purchase order can be marked as ordered');
    await db.prepare(`UPDATE purchase_orders SET status = 'ordered', ordered_at = ?, updated_at = ? WHERE id = ?`).run(
      nowIso(),
      nowIso(),
      id
    );
    const row = await db.prepare(PO_SELECT + ' WHERE po.id = ?').get(id);
    sendJson(res, 200, serializePurchaseOrder(row, await loadPurchaseOrderItems(id)));
  });

  route('POST', '/api/purchase-orders/:id/cancel', async (req, res, params) => {
    if (await ownerOnly(req, res, ORDER_STOCK)) return;
    const id = Number(params.id);
    const existing = await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id);
    if (!existing) return notFound(res, 'Purchase order not found');
    if (!['draft', 'ordered'].includes(existing.status)) return badRequest(res, `This purchase order is already ${existing.status}`);
    const items = await loadPurchaseOrderItems(id);
    if (items.some((it) => it.qty_received > 0)) {
      return badRequest(res, 'This purchase order already has items booked in and cannot be cancelled');
    }
    await db.prepare(`UPDATE purchase_orders SET status = 'cancelled', updated_at = ? WHERE id = ?`).run(nowIso(), id);
    const row = await db.prepare(PO_SELECT + ' WHERE po.id = ?').get(id);
    sendJson(res, 200, serializePurchaseOrder(row, items));
  });

  // Booking a delivery in (openspec/changes/receive-delivery, the contract):
  // open to everyone (receiving decision 4). `items` go into stock and the
  // line's qty_received; `problems` (decision 9: damaged, wrong item or
  // missing) are recorded and go into neither, so they stay to come.
  // Atomic and counted once: the order is locked before its lines are read
  // and checked, so a second booking of the same order waits, then sees the
  // first one's counts; stock is added in the UPDATE itself, never from a
  // value read earlier, so bookings of one product on two orders both land.
  route('POST', '/api/purchase-orders/:id/receive', async (req, res, params, query, afterRelease, shopId) => {
    const id = Number(params.id);
    const body = await readJsonBody(req);
    const receipts = Array.isArray(body.items) ? body.items : [];
    const problemsIn = Array.isArray(body.problems) ? body.problems : [];

    const asked = [];
    for (const r of receipts) {
      const qtyReceived = Math.trunc(Number(r.qtyReceived));
      if (!qtyReceived || qtyReceived <= 0) continue;
      asked.push({ itemId: Number(r.itemId), qtyReceived });
    }
    const problems = [];
    for (const p of problemsIn) {
      const qty = Number(p.qty);
      if (!PROBLEM_KINDS.includes(p.kind)) return badRequest(res, 'A problem is damaged, wrong_item or missing');
      if (!Number.isInteger(qty) || qty <= 0) return badRequest(res, 'A problem needs how many, a whole number above 0');
      problems.push({ itemId: Number(p.itemId), kind: p.kind, qty, note: String(p.note ?? '').trim().slice(0, 500) });
    }
    if (asked.length === 0 && problems.length === 0) return badRequest(res, 'No quantities to receive were provided');

    // Same reasoning as createSale's shopifyPushes: the HTTP calls wait until
    // after COMMIT and after the request releases its pooled connection, so
    // they hold neither this receipt's row locks nor a connection for the
    // duration of a retried Shopify request.
    const shopifyPushes = [];
    let refusal = null;

    await db.exec('BEGIN');
    try {
      const existing = await db.prepare('SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE').get(id);
      if (!existing) refusal = () => notFound(res, 'Purchase order not found');
      else if (!['ordered', 'partially_received'].includes(existing.status)) {
        refusal = () => badRequest(res, 'This purchase order is not awaiting delivery');
      } else {
        const itemsById = new Map((await loadPurchaseOrderItems(id)).map((it) => [it.id, it]));
        // What each line takes from what's still to come: booked in, set
        // aside, or missing.
        const taken = new Map();
        for (const { itemId, qtyReceived, qty } of [...asked, ...problems]) {
          const line = itemsById.get(itemId);
          if (!line) { refusal = () => badRequest(res, `Purchase order line ${itemId} not found`); break; }
          taken.set(itemId, (taken.get(itemId) ?? 0) + (qtyReceived ?? qty));
        }
        for (const [itemId, n] of refusal ? [] : taken) {
          const line = itemsById.get(itemId);
          const outstanding = line.qty_ordered - line.qty_received;
          if (n > outstanding) {
            refusal = () => badRequest(res, `Cannot receive ${n} of "${line.product_name}" - only ${outstanding} outstanding`);
            break;
          }
        }
        if (!refusal) {
          for (const { itemId, qtyReceived } of asked) {
            const line = itemsById.get(itemId);
            await db.prepare('UPDATE purchase_order_items SET qty_received = qty_received + ? WHERE id = ?').run(qtyReceived, line.id);
            const product = await db.prepare('UPDATE products SET stock_qty = stock_qty + ?, updated_at = ? WHERE id = ? RETURNING *').get(
              qtyReceived,
              nowIso(),
              line.product_id
            );
            await db.prepare(
              `INSERT INTO stock_movements (product_id, change_qty, type, note, purchase_order_id) VALUES (?, ?, 'po_receipt', ?, ?)`
            ).run(product.id, qtyReceived, `Booked in from PO #${id}${existing.reference ? ` (${existing.reference})` : ''}`, id);
            if (product.shopify_inventory_item_id) {
              shopifyPushes.push({ product, newQty: product.stock_qty });
            }
          }
          for (const { itemId, kind, qty, note } of problems) {
            await db.prepare(
              'INSERT INTO delivery_problems (purchase_order_id, purchase_order_item_id, product_id, kind, qty, note) VALUES (?, ?, ?, ?, ?, ?)'
            ).run(id, itemId, itemsById.get(itemId).product_id, kind, qty, note);
          }
          if (asked.length > 0) {
            const freshItems = await loadPurchaseOrderItems(id);
            const allReceived = freshItems.every((it) => it.qty_received >= it.qty_ordered);
            const newStatus = allReceived ? 'received' : 'partially_received';
            await db.prepare('UPDATE purchase_orders SET status = ?, updated_at = ? WHERE id = ?').run(newStatus, nowIso(), id);
          }
        }
      }
      await db.exec(refusal ? 'ROLLBACK' : 'COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK');
      throw err;
    }
    if (refusal) return refusal();

    // After the reply, from a fresh connection; a Shopify hiccup is logged and
    // never fails the receipt (firePendingShopifyPushes).
    deferShopifyPushes(afterRelease, shopId, shopifyPushes);

    const row = await db.prepare(PO_SELECT + ' WHERE po.id = ?').get(id);
    sendJson(res, 200, serializePurchaseOrder(row, await loadPurchaseOrderItems(id)));
  });
}
