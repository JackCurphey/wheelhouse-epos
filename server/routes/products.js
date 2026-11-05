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
import { canSeeCosts } from '../lib/can-see-costs.js';
import { syncProductToShopify, unpublishProductFromShopify } from '../shopify.js';
import { deferShopifyPushes } from '../lib/sales.js';
import { lockStock, moveStock } from '../lib/stock.js';
import { CHECK_IN_FIRST, whoIsBooking } from './purchase-orders.js';
import { MAX_PRICE_PENCE, penceToPounds, priceTooBig, wholePence } from '../lib/pence.js';

// The same shim server.js uses: each call reads the request's client.
const db = { prepare, exec: dbExec };

// An adjustment's reasons follow its sign (stock decisions 6 and 11, UX
// walk-through 3 L2); migration 093 holds the same list.
const REASONS_DOWN = ['damaged', 'lost_stolen', 'used_workshop', 'faulty_return', 'other'];
const REASONS_UP = ['found', 'other'];
const MAX_CHANGE = 100000;
const MAX_NOTE = 500;
const SAVE_LOCK_WAIT = '2s';

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


async function listProducts({ search, category, activeOnly }, costs) {
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
  return rows.map((row) => serializeProduct(row, costs));
}

// ---------- Products ----------

const MAX_PRODUCT_PHOTO_BYTES = 5 * 1024 * 1024;

// A cost as sent, or null when none was: nothing, null, a blank box and anything
// that isn't a number are no cost, never £0. Only a figure, 0 included, is one
// (openspec/changes/product-costs-hidden).
function sentCost(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// What was sent as a price and cost, as pounds exact to store: a figure in pence
// first (openspec/changes/products-in-pence, design 3), otherwise a cost as the old
// form sends it. `price` is undefined when no pence were sent, leaving the old
// `price` to its caller; `cost` is null when none was given; `refused` is a
// refusal's message. Someone who can't see costs has any cost ignored, not refused.
function sentMoney(body, costs) {
  if (body.pricePence !== undefined && !(wholePence(body.pricePence) && body.pricePence <= MAX_PRICE_PENCE)) {
    return { refused: 'A price must be a whole number of pence, up to £21,474,836.47' };
  }
  if (body.pricePence === undefined && body.price !== undefined && priceTooBig(body.price)) {
    return { refused: 'A price can be at most £21,474,836.47' };
  }
  const costPence = costs ? body.costPence : undefined;
  const noCostPence = costPence === undefined || costPence === null || costPence === '';
  if (!noCostPence && !wholePence(costPence)) {
    return { refused: 'A cost must be a whole number of pence, up to £99,999,999.99' };
  }
  return {
    price: body.pricePence !== undefined ? penceToPounds(body.pricePence) : undefined,
    cost: noCostPence ? (costs ? sentCost(body.cost) : null) : penceToPounds(costPence),
  };
}

// PUT /api/products/:id, inside its transaction: the fields sent merged into
// the row read FOR UPDATE, checked and written. Returns a refusal's message,
// or nothing once written; a refused write leaves the transaction to roll back.
// `costs`: canSeeCosts(req). Someone who can't see the cost can't change it,
// and a save with no cost leaves it as it is.
async function saveProduct(id, existing, body, costs) {
  const name = body.name !== undefined ? String(body.name).trim() : existing.name;
  const sku = body.sku !== undefined ? String(body.sku).trim() || null : existing.sku;
  const barcode = body.barcode !== undefined ? String(body.barcode).trim() || null : existing.barcode;
  const category = body.category !== undefined ? String(body.category).trim() || 'Uncategorised' : existing.category;
  const money = sentMoney(body, costs);
  if (money.refused) return money.refused;
  const price = money.price ?? (body.price !== undefined ? Number(body.price) || 0 : existing.price);
  const cost = money.cost ?? existing.cost;
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
    }, await canSeeCosts(req));
    sendJson(res, 200, products);
  });

  // A product's page (st-product; openspec/changes/stock-list): the product
  // and every change to its stock, newest first, with its reason and who
  // (openspec/changes/adjust-stock). Read only. Staff see no
  // cost (stock decision 11; canSeeCosts). A
  // product taken off sale still opens: its history stands.
  route('GET', '/api/products/:id', async (req, res, params) => {
    const id = Number(params.id);
    if (!Number.isInteger(id)) return notFound(res, 'Product not found');
    const row = await db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!row) return notFound(res, 'Product not found');
    const moves = await db
      // The newest 200: a fast seller's whole history would be thousands of rows (review 2).
      .prepare(
        `SELECT m.id, m.type, m.change_qty, m.note, m.reason, COALESCE(m.who_name, l.name) AS who, m.created_at
         FROM stock_movements m LEFT JOIN logins l ON l.id = m.login_id
         WHERE m.product_id = ? ORDER BY m.created_at DESC, m.id DESC LIMIT 200`
      )
      .all(id);
    sendJson(res, 200, {
      ...serializeProduct(row, await canSeeCosts(req)),
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
    // Someone who can't see costs adds a product with none recorded.
    const costs = await canSeeCosts(req);
    const money = sentMoney(body, costs);
    if (money.refused) return badRequest(res, money.refused);
    const price = money.price ?? (Number(body.price) || 0);
    const cost = money.cost ?? 0;
    const stockQty = Number.isFinite(Number(body.stockQty)) ? Math.trunc(Number(body.stockQty)) : 0;
    const lowStockThreshold = Number.isFinite(Number(body.lowStockThreshold))
      ? Math.trunc(Number(body.lowStockThreshold))
      : 3;
    const supplier = (body.supplier || '').trim();
    const showOnline = Boolean(body.showOnline);
    const description = (body.description || '').trim();
    const photoUrl = body.photoUrl || null;

    // Starting stock needs someone to name; a product with none doesn't.
    const who = stockQty !== 0 ? await whoIsBooking(req) : null;
    if (stockQty !== 0 && !who) return sendJson(res, 409, CHECK_IN_FIRST);

    try {
      await db.exec('BEGIN');
      let info;
      try {
        info = await db
          .prepare(
            `INSERT INTO products (sku, barcode, name, category, price, cost, low_stock_threshold, supplier, show_online, description, photo_url, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(sku, barcode, name, category, price, cost, lowStockThreshold, supplier, showOnline, description, photoUrl, nowIso());
        if (stockQty !== 0) await moveStock([{ productId: info.lastInsertRowid, change: stockQty, type: 'intake', note: 'Initial stock' }], who);
        await db.exec('COMMIT');
      } catch (err) {
        await db.exec('ROLLBACK').catch(() => {});
        throw err;
      }
      const row = await db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
      await syncProductWithShopifyIfNeeded({ show_online: false, active: false }, row);
      sendJson(res, 201, serializeProduct(row, costs));
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
    const costs = await canSeeCosts(req);

    // Read again FOR UPDATE inside a transaction, so a price and a description
    // saved at once both stay (more-saves-dont-clash). The Shopify sync runs
    // after COMMIT, so the lock is never held while it waits on the network. With
    // a limit: a product held by something stuck answers busy, rather than holding
    // a connection until the server has none left (products-in-pence, design 4).
    let locked;
    await db.exec('BEGIN');
    try {
      await db.prepare(`SET LOCAL lock_timeout = '${SAVE_LOCK_WAIT}'`).run();
      locked = await db.prepare('SELECT * FROM products WHERE id = ? FOR UPDATE').get(id);
      if (!locked) {
        await db.exec('ROLLBACK');
        return notFound(res, 'Product not found');
      }
      const refused = await saveProduct(id, locked, body, costs);
      if (refused) {
        await db.exec('ROLLBACK');
        return badRequest(res, refused);
      }
      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK').catch(() => {});
      if (err.code === '55P03') return sendJson(res, 503, { error: 'Wheelhouse is busy with this product just now. Try again in a moment.', code: 'busy' });
      throw err;
    }
    const row = await db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    await syncProductWithShopifyIfNeeded(locked, row);
    sendJson(res, 200, serializeProduct(row, await canSeeCosts(req)));
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
    const who = await whoIsBooking(req);
    if (!who) return sendJson(res, 409, CHECK_IN_FIRST);
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

    // Under the product's lock: two adjustments at once both count, the below-zero
    // check sees the row as it is, and the cost can't change under the value.
    await db.exec('BEGIN');
    let pushes;
    try {
      await lockStock([id]);
      // An adjustment keeps its value at cost, in whole pence, and goes to
      // the Owner's Today when that is more than the amount set in Settings ›
      // Stockroom, decided now (openspec/changes/stock-warnings-on-today
      // design 1 to 4; stock control decision 6). Up or down; none set, none.
      // A negative cost (the product form saves one) counts at its size, so
      // the value is never below nothing (review, 29 Oct; design 11).
      let valuePence = null;
      let toSee = false;
      if (type === 'adjustment') {
        const { cost_pence: costPence, over } = await db.prepare(
          'SELECT abs(p.cost_pence) AS cost_pence, s.stock_adjust_today_over_pence AS over FROM products p, shops s WHERE p.id = ? AND s.id = ?'
        ).get(id, shopId);
        valuePence = Math.abs(change) * costPence;
        toSee = over !== null && valuePence > over;
      }
      const moved = await moveStock([{ productId: id, change, type, note, reason, valuePence, toSee }], who, { neverBelowZero: true });
      if (moved.refused) {
        await db.exec('ROLLBACK');
        return badRequest(res, 'Stock cannot go below zero');
      }
      pushes = moved.pushes;
      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK').catch(() => {});
      throw err;
    }
    // After the reply, from a fresh connection; a Shopify hiccup is logged
    // and never fails the adjustment (firePendingShopifyPushes).
    if (pushes.length) deferShopifyPushes(afterRelease, shopId, pushes);
    const row = await db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    sendJson(res, 200, serializeProduct(row, await canSeeCosts(req)));
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
    sendJson(res, 200, serializeProduct(row, await canSeeCosts(req)));
  });
}
