// Products and their stock: /api/products (with a product's photo) and
// /api/categories. Image uploads share readUploadedImage (server/lib/uploads.js).
// Staff routes: they run under the dispatcher's /api/ branch (server.js), so
// a handler gets (req, res, params, query, afterRelease, shopId) with the
// shop's row-level security already bound, and needs a staff session.
// Moved out of server.js unchanged (split plan §4.1, WP-0.4).
import { dbExec, prepare } from '../db.js';
import { badRequest, notFound, nowIso, readJsonBody, sendJson, ValidationError } from '../lib/http.js';
import { readUploadedImage } from '../lib/uploads.js';
import { serializeProduct } from '../lib/serializers.js';
import { currentSession } from '../lib/session.js';
import { syncProductToShopify, unpublishProductFromShopify } from '../shopify.js';
import { deferShopifyPushes } from '../lib/sales.js';

// The same shim server.js uses: each call reads the request's client.
const db = { prepare, exec: dbExec };

// An adjustment's reasons follow its sign (stock decisions 6 and 11, UX
// walk-through 3 L2); migration 093 holds the same list.
const REASONS_DOWN = ['damaged', 'lost_stolen', 'used_workshop', 'faulty_return', 'other'];
const REASONS_UP = ['found', 'other'];
const MAX_CHANGE = 100000;
const MAX_NOTE = 500;

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
    // ILIKE: staff type "brake" and expect "Brake pads". Stock's one search
    // box finds a supplier too (stock decision 2).
    // % and _ are searched for as themselves, not as wildcards (review 3).
    sql += " AND (name ILIKE ? ESCAPE '\\' OR sku ILIKE ? ESCAPE '\\' OR barcode ILIKE ? ESCAPE '\\' OR supplier ILIKE ? ESCAPE '\\')";
    const like = `%${String(search).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    params.push(like, like, like, like);
  }
  sql += ' ORDER BY category, name';
  const rows = await db.prepare(sql).all(...params);
  return rows.map(serializeProduct);
}

// ---------- Products ----------

const MAX_PRODUCT_PHOTO_BYTES = 5 * 1024 * 1024;

// PUT /api/products/:id, inside its transaction: the fields sent merged into
// the row read FOR UPDATE, checked and written. Returns a refusal's message,
// or nothing once written; a refused write leaves the transaction to roll back.
async function saveProduct(id, existing, body) {
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

  if (!name) return 'Product name is required';

  try {
    await db.prepare(
      `UPDATE products SET sku = ?, barcode = ?, name = ?, category = ?, price = ?, cost = ?, low_stock_threshold = ?, supplier = ?, active = ?, show_online = ?, description = ?, photo_url = ?, updated_at = ?
       WHERE id = ?`
    ).run(sku, barcode, name, category, price, cost, lowStockThreshold, supplier, active, showOnline, description, photoUrl, nowIso(), id);
  } catch (err) {
    if (err.code === '23505') {
      return err.constraint && err.constraint.includes('barcode') ? `Barcode "${barcode}" is already in use` : `SKU "${sku}" is already in use`;
    }
    throw err;
  }
  return null;
}

export function register(route) {
  route('GET', '/api/products', async (req, res, params, query) => {
    const products = await listProducts({
      search: query.get('search') || '',
      category: query.get('category') || '',
      activeOnly: query.get('all') !== '1',
    });
    sendJson(res, 200, products);
  });

  // A product's page (st-product; openspec/changes/stock-list): the product
  // and every change to its stock, newest first, with its reason and who
  // (openspec/changes/adjust-stock). Read only. Staff see no
  // cost (stock decision 11); until roles (WP-1.1) only the Owner does. A
  // product taken off sale still opens: its history stands.
  route('GET', '/api/products/:id', async (req, res, params) => {
    const id = Number(params.id);
    if (!Number.isInteger(id)) return notFound(res, 'Product not found');
    const row = await db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!row) return notFound(res, 'Product not found');
    const ctx = await currentSession(req);
    const moves = await db
      // The newest 200: a fast seller's whole history would be thousands of rows (review 2).
      .prepare(
        `SELECT m.id, m.type, m.change_qty, m.note, m.reason, l.name AS who, m.created_at
         FROM stock_movements m LEFT JOIN logins l ON l.id = m.login_id
         WHERE m.product_id = ? ORDER BY m.created_at DESC, m.id DESC LIMIT 200`
      )
      .all(id);
    sendJson(res, 200, {
      ...serializeProduct(row),
      cost: ctx?.login.is_owner ? row.cost : null,
      history: moves.map((m) => ({ id: m.id, type: m.type, change: m.change_qty, reason: m.reason, note: m.note || '', who: m.who, at: m.created_at })),
    });
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

    // Read again FOR UPDATE inside a transaction, so a price and a description
    // saved at once both stay (more-saves-dont-clash). The Shopify sync runs
    // after COMMIT, so the lock is never held while it waits on the network.
    let locked;
    await db.exec('BEGIN');
    try {
      locked = await db.prepare('SELECT * FROM products WHERE id = ? FOR UPDATE').get(id);
      if (!locked) {
        await db.exec('ROLLBACK');
        return notFound(res, 'Product not found');
      }
      const refused = await saveProduct(id, locked, body);
      if (refused) {
        await db.exec('ROLLBACK');
        return badRequest(res, refused);
      }
      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK');
      throw err;
    }
    const row = await db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    await syncProductWithShopifyIfNeeded(locked, row);
    sendJson(res, 200, serializeProduct(row));
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

  // Adjust stock (st-adjust; openspec/changes/adjust-stock): anyone with the
  // Stock page, as long as who is recorded (Jack, 26 Oct,
  // 2026-10-26-day-answers.md section 11; stock decision 6). An adjustment
  // takes a reason that follows the sign, and Other a note (decision 11);
  // every change records who made it. The old app's booking in (type
  // "intake") needs no reason.
  route('POST', '/api/products/:id/stock', async (req, res, params, query, afterRelease, shopId) => {
    const ctx = await currentSession(req);
    const id = Number(params.id);
    const existing = await db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!existing) return notFound(res, 'Product not found');
    const body = await readJsonBody(req);
    // A whole number, not 0, at most 100,000 either way: no rounding, no
    // true as 1, and nothing too big for the column (review, 26 Oct).
    const change = body.change;
    if (typeof change !== 'number' || !Number.isInteger(change) || change === 0 || Math.abs(change) > MAX_CHANGE) {
      return badRequest(res, 'A non-zero whole-number "change" is required');
    }
    // An adjustment, or booking stock in, which only adds (decision 6: stock
    // never goes down without a reason).
    const type = body.type;
    if (type !== 'adjustment' && type !== 'intake') return badRequest(res, 'Say whether this is an adjustment or stock received');
    if (type === 'intake' && change < 0) return badRequest(res, 'Stock received can only add stock; adjust it to take stock away');
    const note = String(body.note || '').trim();
    if (note.length > MAX_NOTE) return badRequest(res, 'Keep the note to 500 characters');
    let reason = null;
    if (type === 'adjustment') {
      reason = body.reason ? String(body.reason) : '';
      if (!reason) return badRequest(res, 'Pick a reason for the adjustment');
      if (!(change < 0 ? REASONS_DOWN : REASONS_UP).includes(reason)) return badRequest(res, 'That reason doesn’t fit this change');
      if (reason === 'other' && !note) return badRequest(res, 'Write a note for Other');
    }

    // One atomic update: two adjustments at once both count, and the
    // below-zero check sees the row as it is when the update runs. Going up
    // is always allowed, so Found works on a product below zero.
    await db.exec('BEGIN');
    let newQty;
    try {
      const updated = await db
        .prepare('UPDATE products SET stock_qty = stock_qty + ?, updated_at = ? WHERE id = ? AND (? > 0 OR stock_qty + ? >= 0) RETURNING stock_qty')
        .get(change, nowIso(), id, change, change);
      if (!updated) {
        await db.exec('ROLLBACK');
        return badRequest(res, 'Stock cannot go below zero');
      }
      newQty = updated.stock_qty;
      await db.prepare('INSERT INTO stock_movements (product_id, change_qty, type, note, reason, login_id) VALUES (?, ?, ?, ?, ?, ?)').run(
        id,
        change,
        type,
        note,
        reason,
        ctx.login.id
      );
      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK');
      throw err;
    }
    if (existing.shopify_inventory_item_id) {
      // After the reply, from a fresh connection; a Shopify hiccup is logged
      // and never fails the adjustment (firePendingShopifyPushes).
      deferShopifyPushes(afterRelease, shopId, [{ product: existing, newQty }]);
    }
    const row = await db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    sendJson(res, 200, serializeProduct(row));
  });

  route('GET', '/api/categories', async (req, res) => {
    const rows = await db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all();
    sendJson(res, 200, rows.map((r) => r.category));
  });

  route('POST', '/api/products/:id/photo', async (req, res, params) => {
    const id = Number(params.id);
    const existing = await db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!existing) return notFound(res, 'Product not found');

    let photoUrl;
    try {
      photoUrl = await readUploadedImage(req, MAX_PRODUCT_PHOTO_BYTES);
    } catch (err) {
      if (err instanceof ValidationError) return badRequest(res, err.message);
      throw err;
    }

    await db.prepare('UPDATE products SET photo_url = ?, updated_at = ? WHERE id = ?').run(photoUrl, nowIso(), id);
    const row = await db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    sendJson(res, 200, serializeProduct(row));
  });
}
