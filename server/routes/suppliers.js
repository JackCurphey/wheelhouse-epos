// Suppliers and their catalogue: /api/suppliers and /api/catalogue-items.
// Staff routes: they run under the dispatcher's /api/ branch (server.js), so
// a handler gets (req, res, params, query, afterRelease, shopId) with the
// shop's row-level security already bound, and needs a staff session.
// Moved out of server.js unchanged (split plan §4.1, WP-0.4).
import { prepare, dbExec } from '../db.js';
import { runSync } from '../suppliers/index.js';
import { sendJson, notFound, badRequest, readJsonBody, nowIso } from '../lib/http.js';
import { serializeProduct } from '../lib/serializers.js';

// The same shim server.js uses: each call reads the request's client.
const db = { prepare, exec: dbExec };

// The bike-shop-distributor equivalent of a stock information feed: a
// supplier's items land in supplier_catalogue_items on sync, and stay in a
// review queue (status='new') until a person explicitly imports or ignores
// each one - never auto-created as a real product.

function serializeSupplier(row) {
  return {
    id: row.id,
    name: row.name,
    adapterType: row.adapter_type,
    config: row.config,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    accountNumber: row.account_number,
    address: row.address,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
  };
}

function serializeCatalogueItem(row) {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    supplierSku: row.supplier_sku,
    barcode: row.barcode,
    name: row.name,
    price: row.price,
    stockQty: row.stock_qty,
    status: row.status,
    productId: row.product_id,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  };
}

const SUPPLIER_ADAPTER_TYPES = ['mock_csv'];

export function register(route) {
  route('GET', '/api/suppliers', async (req, res) => {
    const rows = await db.prepare('SELECT * FROM suppliers ORDER BY name').all();
    sendJson(res, 200, rows.map(serializeSupplier));
  });

  route('POST', '/api/suppliers', async (req, res) => {
    const body = await readJsonBody(req);
    const name = (body.name || '').trim();
    if (!name) return badRequest(res, 'Supplier name is required');
    const adapterType = (body.adapterType || '').trim();
    if (!SUPPLIER_ADAPTER_TYPES.includes(adapterType)) return badRequest(res, 'Unsupported adapter type');
    try {
      const info = await db
        .prepare('INSERT INTO suppliers (name, adapter_type, config, updated_at) VALUES (?, ?, ?, ?)')
        .run(name, adapterType, JSON.stringify(body.config || {}), nowIso());
      const row = await db.prepare('SELECT * FROM suppliers WHERE id = ?').get(info.lastInsertRowid);
      sendJson(res, 201, serializeSupplier(row));
    } catch (err) {
      if (err.code === '23505') return badRequest(res, `A supplier named "${name}" already exists`);
      throw err;
    }
  });

  route('PUT', '/api/suppliers/:id', async (req, res, params) => {
    const id = Number(params.id);
    const existing = await db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    if (!existing) return notFound(res, 'Supplier not found');
    const body = await readJsonBody(req);
    const name = body.name !== undefined ? String(body.name).trim() : existing.name;
    if (!name) return badRequest(res, 'Supplier name is required');
    const contactName = body.contactName !== undefined ? String(body.contactName).trim() : existing.contact_name;
    const email = body.email !== undefined ? String(body.email).trim() : existing.email;
    const phone = body.phone !== undefined ? String(body.phone).trim() : existing.phone;
    const accountNumber = body.accountNumber !== undefined ? String(body.accountNumber).trim() : existing.account_number;
    const address = body.address !== undefined ? String(body.address).trim() : existing.address;

    try {
      await db.prepare(
        `UPDATE suppliers SET name = ?, contact_name = ?, email = ?, phone = ?, account_number = ?, address = ?, updated_at = ?
         WHERE id = ?`
      ).run(name, contactName, email, phone, accountNumber, address, nowIso(), id);
      const row = await db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
      sendJson(res, 200, serializeSupplier(row));
    } catch (err) {
      if (err.code === '23505') return badRequest(res, `A supplier named "${name}" already exists`);
      throw err;
    }
  });

  route('POST', '/api/suppliers/:id/sync', async (req, res, params) => {
    const id = Number(params.id);
    const supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    if (!supplier) return notFound(res, 'Supplier not found');
    const result = await runSync(db, nowIso(), supplier);
    sendJson(res, 200, result);
  });

  route('GET', '/api/catalogue-items', async (req, res, params, query) => {
    const status = query.get('status') || 'new';
    const rows = await db
      .prepare('SELECT * FROM supplier_catalogue_items WHERE status = ? ORDER BY last_seen_at DESC')
      .all(status);
    sendJson(res, 200, rows.map(serializeCatalogueItem));
  });

  route('POST', '/api/catalogue-items/:id/import', async (req, res, params) => {
    const id = Number(params.id);
    const item = await db.prepare('SELECT * FROM supplier_catalogue_items WHERE id = ?').get(id);
    if (!item) return notFound(res, 'Catalogue item not found');
    if (item.status !== 'new') return badRequest(res, 'This item has already been imported or ignored');
    const body = await readJsonBody(req);
    const category = (body.category || 'Uncategorised').trim();
    const sellPrice = Number(body.price);
    if (!Number.isFinite(sellPrice) || sellPrice < 0) return badRequest(res, 'A valid sell price is required');

    const supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').get(item.supplier_id);
    try {
      const info = await db
        .prepare(
          `INSERT INTO products (sku, barcode, name, category, price, cost, stock_qty, supplier, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(item.supplier_sku, item.barcode, item.name, category, sellPrice, item.price, item.stock_qty, supplier.name, nowIso());
      await db
        .prepare(`UPDATE supplier_catalogue_items SET status = 'imported', product_id = ?, updated_at = ? WHERE id = ?`)
        .run(info.lastInsertRowid, nowIso(), id);
      const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
      sendJson(res, 201, serializeProduct(product));
    } catch (err) {
      if (err.code === '23505') return badRequest(res, `SKU or barcode "${item.supplier_sku}" is already in use`);
      throw err;
    }
  });

  route('POST', '/api/catalogue-items/:id/ignore', async (req, res, params) => {
    const id = Number(params.id);
    const item = await db.prepare('SELECT * FROM supplier_catalogue_items WHERE id = ?').get(id);
    if (!item) return notFound(res, 'Catalogue item not found');
    if (item.status !== 'new') return badRequest(res, 'This item has already been imported or ignored');
    await db.prepare(`UPDATE supplier_catalogue_items SET status = 'ignored', updated_at = ? WHERE id = ?`).run(nowIso(), id);
    sendJson(res, 200, { ok: true });
  });
}
