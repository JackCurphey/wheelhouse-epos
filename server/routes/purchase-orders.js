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
    // Checked in the UPDATE itself, as mark-ordered is: only a draft or an
    // ordered order, with nothing booked in, so a receipt landing between a
    // check and the cancel can't be dropped (review of 26 Oct). The status is
    // the part that holds under a race: a receipt changes the order's row in
    // its own transaction, so this UPDATE waits for it and then re-checks the
    // status on the new row. The NOT EXISTS on the lines alone would be re-run
    // against the old snapshot and pass (second review, 26 Oct).
    const changed = await db
      .prepare(
        `UPDATE purchase_orders SET status = 'cancelled', updated_at = ?
         WHERE id = ? AND status IN ('draft', 'ordered')
           AND NOT EXISTS (SELECT 1 FROM purchase_order_items WHERE purchase_order_id = ? AND qty_received > 0)`
      )
      .run(nowIso(), id, id);
    if (changed.changes === 0) {
      const now = await db.prepare('SELECT status FROM purchase_orders WHERE id = ?').get(id);
      return sendJson(res, 409, {
        error: now?.status === 'cancelled'
          ? 'This purchase order is already cancelled'
          : 'This purchase order already has items booked in and cannot be cancelled',
      });
    }
    const row = await db.prepare(PO_SELECT + ' WHERE po.id = ?').get(id);
    sendJson(res, 200, serializePurchaseOrder(row, await loadPurchaseOrderItems(id)));
  });

  route('POST', '/api/purchase-orders/:id/receive', async (req, res, params, query, afterRelease, shopId) => {
    const id = Number(params.id);
    const existing = await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id);
    if (!existing) return notFound(res, 'Purchase order not found');
    if (!['ordered', 'partially_received'].includes(existing.status)) {
      return badRequest(res, 'This purchase order is not awaiting delivery');
    }
    const body = await readJsonBody(req);
    const receipts = Array.isArray(body.items) ? body.items : [];
    const existingItems = await loadPurchaseOrderItems(id);
    const itemsById = new Map(existingItems.map((it) => [it.id, it]));

    const toApply = [];
    for (const r of receipts) {
      const itemId = Number(r.itemId);
      const qtyReceived = Math.trunc(Number(r.qtyReceived));
      if (!qtyReceived || qtyReceived <= 0) continue;
      const line = itemsById.get(itemId);
      if (!line) return badRequest(res, `Purchase order line ${itemId} not found`);
      const outstanding = line.qty_ordered - line.qty_received;
      if (qtyReceived > outstanding) {
        return badRequest(res, `Cannot receive ${qtyReceived} of "${line.product_name}" - only ${outstanding} outstanding`);
      }
      toApply.push({ line, qtyReceived });
    }
    if (toApply.length === 0) return badRequest(res, 'No quantities to receive were provided');

    // Same reasoning as createSale's shopifyPushes: the HTTP calls wait until
    // after COMMIT and after the request releases its pooled connection, so
    // they hold neither this receipt's row locks nor a connection for the
    // duration of a retried Shopify request.
    const shopifyPushes = [];

    await db.exec('BEGIN');
    try {
      for (const { line, qtyReceived } of toApply) {
        await db.prepare('UPDATE purchase_order_items SET qty_received = qty_received + ? WHERE id = ?').run(
          qtyReceived,
          line.id
        );
        const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(line.product_id);
        const newQty = product.stock_qty + qtyReceived;
        await db.prepare('UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ?').run(
          newQty,
          nowIso(),
          product.id
        );
        await db.prepare(
          `INSERT INTO stock_movements (product_id, change_qty, type, note, purchase_order_id) VALUES (?, ?, 'po_receipt', ?, ?)`
        ).run(product.id, qtyReceived, `Booked in from PO #${id}${existing.reference ? ` (${existing.reference})` : ''}`, id);
        if (product.shopify_inventory_item_id) {
          shopifyPushes.push({ product, newQty });
        }
      }
      const freshItems = await loadPurchaseOrderItems(id);
      const allReceived = freshItems.every((it) => it.qty_received >= it.qty_ordered);
      const newStatus = allReceived ? 'received' : 'partially_received';
      await db.prepare('UPDATE purchase_orders SET status = ?, updated_at = ? WHERE id = ?').run(newStatus, nowIso(), id);
      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK');
      throw err;
    }

    // After the reply, from a fresh connection; a Shopify hiccup is logged and
    // never fails the receipt (firePendingShopifyPushes).
    deferShopifyPushes(afterRelease, shopId, shopifyPushes);

    const row = await db.prepare(PO_SELECT + ' WHERE po.id = ?').get(id);
    sendJson(res, 200, serializePurchaseOrder(row, await loadPurchaseOrderItems(id)));
  });
}
