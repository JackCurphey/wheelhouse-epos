// Products and their stock: /api/products and /api/categories (the product photo route stays with the image uploads).
// Staff routes: they run under the dispatcher's /api/ branch (server.js), so
// a handler gets (req, res, params, query, afterRelease, shopId) with the
// shop's row-level security already bound, and needs a staff session.
// Moved out of server.js unchanged (split plan §4.1, WP-0.4).
import { dbExec, prepare } from '../db.js';
import { badRequest, notFound, nowIso, readJsonBody, sendJson } from '../lib/http.js';
import { serializeProduct } from '../lib/serializers.js';
import { pushInventoryLevel, syncProductToShopify, unpublishProductFromShopify } from '../shopify.js';

// The same shim server.js uses: each call reads the request's client.
const db = { prepare, exec: dbExec };

// A product is only fit to be live on Shopify when it's BOTH marked to show
// online AND active - `show_online` alone isn't enough, since a deactivated
// product (DELETE /api/products/:id's soft-delete, or PUT with active:false)
// has already disappeared from the Wheelhouse website's own listing (which
// filters by active = 1) and shouldn't stay purchasable on Shopify in the
// meantime. `previousProductRow` and `updatedProductRow` just need
// `show_online`/`active` fields - callers pass the row as loaded before and
// after the change (a synthetic "nothing was live yet" stand-in for a
// brand-new product).
async function syncProductWithShopifyIfNeeded(previousProductRow, updatedProductRow) {
  const isLive = (row) => !!row.show_online && !!row.active;
  try {
    if (isLive(updatedProductRow)) {
      await syncProductToShopify(updatedProductRow);
    } else if (isLive(previousProductRow)) {
      await unpublishProductFromShopify(updatedProductRow);
    }
  } catch (err) {
    console.error('Shopify product sync failed', err);
  }
}


async function listProducts({ search, category, activeOnly }) {
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];
  if (activeOnly) {
    sql += ' AND active = 1';
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (search) {
    // ILIKE: staff type "brake" and expect "Brake pads".
    sql += ' AND (name ILIKE ? OR sku ILIKE ? OR barcode ILIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  sql += ' ORDER BY category, name';
  const rows = await db.prepare(sql).all(...params);
  return rows.map(serializeProduct);
}

// ---------- Products ----------

export function register(route) {
  route('GET', '/api/products', async (req, res, params, query) => {
    const products = await listProducts({
      search: query.get('search') || '',
      category: query.get('category') || '',
      activeOnly: query.get('all') !== '1',
    });
    sendJson(res, 200, products);
  });

  route('POST', '/api/products', async (req, res) => {
    const body = await readJsonBody(req);
    const name = (body.name || '').trim();
    if (!name) return badRequest(res, 'Product name is required');
    const sku = (body.sku || '').trim() || null;
    const barcode = (body.barcode || '').trim() || null;
    const category = (body.category || 'Uncategorised').trim();
    const price = Number(body.price) || 0;
    const cost = Number(body.cost) || 0;
    const stockQty = Number.isFinite(Number(body.stockQty)) ? Math.trunc(Number(body.stockQty)) : 0;
    const lowStockThreshold = Number.isFinite(Number(body.lowStockThreshold))
      ? Math.trunc(Number(body.lowStockThreshold))
      : 3;
    const supplier = (body.supplier || '').trim();
    const showOnline = Boolean(body.showOnline);
    const description = (body.description || '').trim();
    const photoUrl = body.photoUrl || null;

    try {
      const info = await db
        .prepare(
          `INSERT INTO products (sku, barcode, name, category, price, cost, stock_qty, low_stock_threshold, supplier, show_online, description, photo_url, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(sku, barcode, name, category, price, cost, stockQty, lowStockThreshold, supplier, showOnline, description, photoUrl, nowIso());
      if (stockQty !== 0) {
        await db.prepare(
          `INSERT INTO stock_movements (product_id, change_qty, type, note) VALUES (?, ?, 'intake', 'Initial stock')`
        ).run(info.lastInsertRowid, stockQty);
      }
      const row = await db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
      await syncProductWithShopifyIfNeeded({ show_online: false, active: false }, row);
      sendJson(res, 201, serializeProduct(row));
    } catch (err) {
      if (err.code === '23505') {
        return badRequest(res, err.constraint && err.constraint.includes('barcode') ? `Barcode "${barcode}" is already in use` : `SKU "${sku}" is already in use`);
      }
      throw err;
    }
  });

  route('PUT', '/api/products/:id', async (req, res, params) => {
    const id = Number(params.id);
    const existing = await db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!existing) return notFound(res, 'Product not found');
    const body = await readJsonBody(req);

    const name = body.name !== undefined ? String(body.name).trim() : existing.name;
    const sku = body.sku !== undefined ? String(body.sku).trim() || null : existing.sku;
    const barcode = body.barcode !== undefined ? String(body.barcode).trim() || null : existing.barcode;
    const category = body.category !== undefined ? String(body.category).trim() || 'Uncategorised' : existing.category;
    const price = body.price !== undefined ? Number(body.price) || 0 : existing.price;
    const cost = body.cost !== undefined ? Number(body.cost) || 0 : existing.cost;
    const lowStockThreshold =
      body.lowStockThreshold !== undefined ? Math.trunc(Number(body.lowStockThreshold)) || 0 : existing.low_stock_threshold;
    const supplier = body.supplier !== undefined ? String(body.supplier).trim() : existing.supplier;
    const active = body.active !== undefined ? (body.active ? 1 : 0) : existing.active;
    const showOnline = body.showOnline !== undefined ? Boolean(body.showOnline) : existing.show_online;
    const description = body.description !== undefined ? String(body.description).trim() : existing.description;
    const photoUrl = body.photoUrl !== undefined ? (body.photoUrl || null) : existing.photo_url;

    if (!name) return badRequest(res, 'Product name is required');

    try {
      await db.prepare(
        `UPDATE products SET sku = ?, barcode = ?, name = ?, category = ?, price = ?, cost = ?, low_stock_threshold = ?, supplier = ?, active = ?, show_online = ?, description = ?, photo_url = ?, updated_at = ?
         WHERE id = ?`
      ).run(sku, barcode, name, category, price, cost, lowStockThreshold, supplier, active, showOnline, description, photoUrl, nowIso(), id);
      const row = await db.prepare('SELECT * FROM products WHERE id = ?').get(id);
      await syncProductWithShopifyIfNeeded(existing, row);
      sendJson(res, 200, serializeProduct(row));
    } catch (err) {
      if (err.code === '23505') {
        return badRequest(res, err.constraint && err.constraint.includes('barcode') ? `Barcode "${barcode}" is already in use` : `SKU "${sku}" is already in use`);
      }
      throw err;
    }
  });

  route('DELETE', '/api/products/:id', async (req, res, params) => {
    const id = Number(params.id);
    const existing = await db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!existing) return notFound(res, 'Product not found');
    await db.prepare('UPDATE products SET active = 0, updated_at = ? WHERE id = ?').run(nowIso(), id);
    const row = await db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    // This soft-delete never goes through PUT /api/products/:id, so it needs
    // its own call - without it, a deactivated product that still has
    // show_online: true would stay live and purchasable on Shopify
    // indefinitely even though it has already disappeared from the Wheelhouse
    // website's own listing.
    await syncProductWithShopifyIfNeeded(existing, row);
    sendJson(res, 200, { ok: true });
  });

  route('POST', '/api/products/:id/stock', async (req, res, params) => {
    const id = Number(params.id);
    const existing = await db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!existing) return notFound(res, 'Product not found');
    const body = await readJsonBody(req);
    const change = Math.trunc(Number(body.change));
    if (!Number.isFinite(change) || change === 0) return badRequest(res, 'A non-zero whole-number "change" is required');
    const type = body.type === 'adjustment' ? 'adjustment' : 'intake';
    const note = (body.note || '').trim();

    const newQty = existing.stock_qty + change;
    if (newQty < 0) return badRequest(res, 'Stock cannot go below zero');

    await db.prepare('UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ?').run(newQty, nowIso(), id);
    await db.prepare('INSERT INTO stock_movements (product_id, change_qty, type, note) VALUES (?, ?, ?, ?)').run(
      id,
      change,
      type,
      note
    );
    if (existing.shopify_inventory_item_id) {
      // Never let a Shopify hiccup fail a real stock adjustment - log and move on.
      await pushInventoryLevel(existing, newQty).catch((err) => console.error('Shopify inventory push failed', err));
    }
    const row = await db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    sendJson(res, 200, serializeProduct(row));
  });

  route('GET', '/api/categories', async (req, res) => {
    const rows = await db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all();
    sendJson(res, 200, rows.map((r) => r.category));
  });
}
