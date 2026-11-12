// Products and their stock: /api/products (with a product's photo) and
// /api/categories. Image uploads share readUploadedImage (server/lib/uploads.js).
// Staff routes: they run under the dispatcher's /api/ branch (server.js), so
// a handler gets (req, res, params, query, afterRelease, shopId) with the
// shop's row-level security already bound, and needs a staff session.
// Moved out of server.js unchanged (split plan §4.1, WP-0.4).
import { dbExec, prepare } from '../db.js';
import { badRequest, notFound, nowIso, readJsonBody, sendJson, ValidationError } from '../lib/http.js';
import { readUploadedImage, uploadedImageBody } from '../lib/uploads.js';
import { serializeProduct } from '../lib/serializers.js';
import { canSeeCosts } from '../lib/can-see-costs.js';
import { syncProductToShopify, unpublishProductFromShopify } from '../shopify.js';
import { deferShopifyPushes } from '../lib/sales.js';
import { categoryFor, tidyCategory } from '../lib/categories.js';
import { categoryShowsOnline } from '../online-orders/showing.js';
import { notProductEditor } from '../lib/product-editor.js';
import { detailsOf, saveAnswers } from '../lib/product-details.js';
import { limitLockWait, lockStock, moveStock, oldestSite } from '../lib/stock.js';
import { CHECK_IN_FIRST, siteHere, whoIsBooking } from './purchase-orders.js';
import { MAX_PRICE_PENCE, PRICE_IN_POUNDS, penceToPounds, poundsOf, wholePence } from '../lib/pence.js';
import { newestFirst, priceChangesOf, recordPriceChanges } from '../lib/price-changes.js';
import { bikeKinds, isBike } from '../lib/bikes.js';
import { productWarranty } from '../lib/warranties.js';

// The same shim server.js uses: each call reads the request's client.
const db = { prepare, exec: dbExec };

// An adjustment's reasons follow its sign (stock decisions 6 and 11, UX
// walk-through 3 L2); migration 093 holds the same list.
const REASONS_DOWN = ['damaged', 'lost_stolen', 'used_workshop', 'faulty_return', 'other'];
const REASONS_UP = ['found', 'other'];
const MAX_CHANGE = 100000;
const MAX_NOTE = 500;
export const SAVE_LOCK_WAIT = '2s';

// A product is only fit to be live on Shopify when it's BOTH marked to show
// online AND active - `show_online` alone isn't enough, since a deactivated
// product (DELETE /api/products/:id's soft-delete, or PUT with active:false)
// has already disappeared from the Wheelhouse website's own listing (which
// filters by active = 1) and shouldn't stay purchasable on Shopify in the
// meantime. `previousProductRow` and `updatedProductRow` just need
// `show_online`/`active` fields - callers pass the row as loaded before and
// after the change (a synthetic "nothing was live yet" stand-in for a
// brand-new product).
export async function syncProductWithShopifyIfNeeded(previousProductRow, updatedProductRow) {
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
  const kinds = await bikeKinds();
  return rows.map((row) => serializeProduct(row, costs, kinds));
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
export function sentMoney(body, costs) {
  if (body.pricePence !== undefined && !(wholePence(body.pricePence) && body.pricePence <= MAX_PRICE_PENCE)) {
    return { refused: 'A price must be a whole number of pence, up to £21,474,836.47' };
  }
  const pounds = body.pricePence === undefined && body.price !== undefined ? poundsOf(body.price) : undefined;
  if (pounds === null) return { refused: PRICE_IN_POUNDS };
  const costPence = costs ? body.costPence : undefined;
  const noCostPence = costPence === undefined || costPence === null || costPence === '';
  if (!noCostPence && !wholePence(costPence)) {
    return { refused: 'A cost must be a whole number of pence, up to £99,999,999.99' };
  }
  return {
    price: body.pricePence !== undefined ? penceToPounds(body.pricePence) : pounds,
    cost: noCostPence ? (costs ? sentCost(body.cost) : null) : penceToPounds(costPence),
  };
}

// PUT /api/products/:id, inside its transaction: the fields sent merged into
// the row read FOR UPDATE, checked and written. Returns a refusal's message,
// or nothing once written; a refused write leaves the transaction to roll back.
// `costs`: canSeeCosts(req). Someone who can't see the cost can't change it,
// and a save with no cost leaves it as it is.
// A brand as typed (finish-customers, design 6): trimmed, empty is none, too long undefined.
const BRAND_TOO_LONG = 'A brand can be up to 60 characters';
function brandOf(sent) {
  const brand = typeof sent === 'string' ? sent.trim() : '';
  if (brand.length > 60) return undefined;
  return brand || null;
}

async function saveProduct(id, existing, body, costs) {
  const name = body.name !== undefined ? String(body.name).trim() : existing.name;
  const sku = body.sku !== undefined ? String(body.sku).trim() || null : existing.sku;
  const barcode = body.barcode !== undefined ? String(body.barcode).trim() || null : existing.barcode;
  // A category sent is found or made (category-tree); one not sent stays as it is. A size of
  // a product with sizes keeps that product's: it changes there, for every size (the review).
  if (existing.group_id !== null && body.category !== undefined && tidyCategory(body.category) !== existing.category) {
    const group = await db.prepare('SELECT name FROM product_groups WHERE id = ?').get(existing.group_id);
    return `${existing.name} is a size of ${group.name}. Change the category on ${group.name}, and every size follows.`;
  }
  const category = body.category !== undefined ? await categoryFor(body.category) : existing.category;
  const money = sentMoney(body, costs);
  if (money.refused) return money.refused;
  const price = money.price ?? (body.price !== undefined ? Number(body.price) || 0 : existing.price);
  const cost = money.cost ?? existing.cost;
  const lowStockThreshold =
    body.lowStockThreshold !== undefined ? Math.trunc(Number(body.lowStockThreshold)) || 0 : existing.low_stock_threshold;
  const supplier = body.supplier !== undefined ? String(body.supplier).trim() : existing.supplier;
  const brand = body.brand !== undefined ? brandOf(body.brand) : existing.brand;
  if (brand === undefined) return BRAND_TOO_LONG;
  const active = body.active !== undefined ? (body.active ? 1 : 0) : existing.active;
  const showOnline = body.showOnline !== undefined ? Boolean(body.showOnline) : existing.show_online;
  const description = body.description !== undefined ? String(body.description).trim() : existing.description;
  const photoUrl = body.photoUrl !== undefined ? (body.photoUrl || null) : existing.photo_url;

  if (!name) return 'Product name is required';

  try {
    await db.prepare(
      `UPDATE products SET sku = ?, barcode = ?, name = ?, category = ?, price = ?, cost = ?, low_stock_threshold = ?, supplier = ?, brand = ?, active = ?, show_online = ?, description = ?, photo_url = ?, updated_at = ?
       WHERE id = ?`
    ).run(sku, barcode, name, category, price, cost, lowStockThreshold, supplier, brand, active, showOnline, description, photoUrl, nowIso(), id);
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
        `SELECT m.id, m.type, m.change_qty, m.note, m.reason, COALESCE(m.who_name, l.name) AS who, m.created_at,
                m.delivery_id, COALESCE(d.supplier_name, sp.name) AS supplier,
                (SELECT count(*)::int FROM stock_frames f WHERE f.stock_movement_id = m.id) AS frames
         FROM stock_movements m LEFT JOIN logins l ON l.id = m.login_id
         LEFT JOIN deliveries d ON d.id = m.delivery_id LEFT JOIN suppliers sp ON sp.id = d.supplier_id
         WHERE m.product_id = ? ORDER BY m.created_at DESC, m.id DESC LIMIT 200`
      )
      .all(id);
    // Stock at each shop, oldest first, and which is this computer's (tr-sites; stock
    // decision 8). No row is none. For everyone: the 3 Oct later change to decision 3.
    const shops = await db.prepare(
      `SELECT s.id, s.name, COALESCE(ps.qty, 0) AS qty FROM sites s
         LEFT JOIN product_stock ps ON ps.site_id = s.id AND ps.product_id = ? ORDER BY s.id`
    ).all(id);
    const here = (await siteHere(req)) ?? await oldestSite();
    const costs = await canSeeCosts(req);
    // A bike's frames: in stock first, then held, then sold, newest first in each (st-product-bike;
    // openspec/changes/frame-numbers, design 4).
    const kinds = await bikeKinds();
    const frames = isBike(row.category, kinds) ? (await db.prepare(
      `SELECT f.id, f.frame_number, f.state, f.received_at, f.delivery_id, COALESCE(d.supplier_name, sp.name) AS supplier
         FROM stock_frames f LEFT JOIN deliveries d ON d.id = f.delivery_id LEFT JOIN suppliers sp ON sp.id = d.supplier_id
        WHERE f.product_id = ?
        ORDER BY CASE f.state WHEN 'in_stock' THEN 0 WHEN 'held' THEN 1 ELSE 2 END, f.received_at DESC, f.id DESC LIMIT 500`
    ).all(id)).map((f) => ({ id: f.id, frameNumber: f.frame_number, state: f.state, bookedInAt: f.received_at, deliveryId: f.delivery_id, supplierName: f.supplier ?? null })) : undefined;
    sendJson(res, 200, {
      ...serializeProduct(row, costs, kinds),
      frames,
      // The warranty it gets: its own lines or its listed brand's (finish-customers, design 6).
      warranty: await productWarranty(row, kinds),
      stockAtShops: shops.map((s) => ({ id: s.id, name: s.name, qty: s.qty, here: s.id === here })),
      // Its category's details and those passed down, each with its answer (st-product's Details · [Category]).
      details: await detailsOf(row),
      // Its price and cost changes among them, for the Owner only (product-page-sizes, design 1).
      history: newestFirst([
        // A received line says its delivery, by the name the delivery kept, and how many frames came in on it.
        ...moves.map((m) => ({ id: m.id, type: m.type, change: m.change_qty, reason: m.reason, note: m.note || '', who: m.who, at: m.created_at,
          delivery: m.delivery_id === null ? null : { id: m.delivery_id, supplierName: m.supplier ?? null }, frames: m.frames })),
        ...await priceChangesOf([id], costs),
      ]),
    });
  });

  route('POST', '/api/products', async (req, res) => {
    if (await notProductEditor(req, res)) return;
    const body = await readJsonBody(req);
    const name = (body.name || '').trim();
    if (!name) return badRequest(res, 'Product name is required');
    const sku = (body.sku || '').trim() || null;
    const barcode = (body.barcode || '').trim() || null;
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
    const brand = brandOf(body.brand);
    if (brand === undefined) return badRequest(res, BRAND_TOO_LONG);
    // Sent, or as its category (website-buy-online: new products follow their category).
    const sentShowOnline = typeof body.showOnline === 'boolean' ? body.showOnline : undefined;
    const description = (body.description || '').trim();
    const photoUrl = body.photoUrl || null;

    // Starting stock needs someone to name; a product with none doesn't.
    const who = stockQty !== 0 ? await whoIsBooking(req) : null;
    if (stockQty !== 0 && !who) return sendJson(res, 409, CHECK_IN_FIRST);

    try {
      await db.exec('BEGIN');
      let info;
      try {
        // Its category's path found or made (category-tree), with a limit on waiting.
        await limitLockWait();
        const category = await categoryFor(body.category);
        const showOnline = sentShowOnline ?? await categoryShowsOnline(category);
        info = await db
          .prepare(
            `INSERT INTO products (sku, barcode, name, category, price, cost, low_stock_threshold, supplier, brand, show_online, description, photo_url, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(sku, barcode, name, category, price, cost, lowStockThreshold, supplier, brand, showOnline, description, photoUrl, nowIso());
        if (stockQty !== 0) await moveStock([{ productId: info.lastInsertRowid, change: stockQty, type: 'intake', note: 'Initial stock' }], who);
        await db.exec('COMMIT');
      } catch (err) {
        await db.exec('ROLLBACK').catch(() => {});
        throw err;
      }
      const row = await db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
      await syncProductWithShopifyIfNeeded({ show_online: false, active: false }, row);
      sendJson(res, 201, serializeProduct(row, costs, await bikeKinds()));
    } catch (err) {
      if (err.code === '23505') {
        return badRequest(res, err.constraint && err.constraint.includes('barcode') ? `Barcode "${barcode}" is already in use` : `SKU "${sku}" is already in use`);
      }
      throw err;
    }
  });

  route('PUT', '/api/products/:id', async (req, res, params) => {
    if (await notProductEditor(req, res)) return;
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
      // A price or cost that changed goes into its history, with who (product-page-sizes, design 1).
      // Only a save sent one can change either.
      if (['price', 'pricePence', 'cost', 'costPence'].some((k) => body[k] !== undefined)) {
        const written = await db.prepare('SELECT * FROM products WHERE id = ?').get(id);
        await recordPriceChanges(locked, written, await whoIsBooking(req));
      }
      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK').catch(() => {});
      if (err.code === '55P03') return sendJson(res, 503, { error: 'Wheelhouse is busy with this product just now. Try again in a moment.', code: 'busy' });
      throw err;
    }
    const row = await db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    await syncProductWithShopifyIfNeeded(locked, row);
    sendJson(res, 200, serializeProduct(row, await canSeeCosts(req), await bikeKinds()));
  });

  route('DELETE', '/api/products/:id', async (req, res, params) => {
    if (await notProductEditor(req, res)) return;
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
      const moved = await moveStock([{ productId: id, change, type, note, reason, valuePence, toSee }], who, { neverBelowZero: 'here' });
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
    sendJson(res, 200, serializeProduct(row, await canSeeCosts(req), await bikeKinds()));
  });

  // A product's answers to its details (rs-add-product, st-product's Details · Edit;
  // openspec/changes/product-editing). The Owner only, as any change to a product. Under the
  // product's lock, with the save's limit on waiting; reply after COMMIT.
  route('PUT', '/api/products/:id/details', async (req, res, params) => {
    if (await notProductEditor(req, res)) return;
    const id = Number(params.id);
    if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) return notFound(res, 'Product not found');
    const body = (await readJsonBody(req)) ?? {};
    if (!Array.isArray(body.answers) || body.answers.length > 100) return badRequest(res, 'Send the answers as a list');
    await db.exec('BEGIN');
    try {
      await db.prepare(`SET LOCAL lock_timeout = '${SAVE_LOCK_WAIT}'`).run();
      const product = await db.prepare('SELECT id, category FROM products WHERE id = ? FOR UPDATE').get(id);
      if (!product) {
        await db.exec('ROLLBACK');
        return notFound(res, 'Product not found');
      }
      const refused = await saveAnswers(product, body.answers);
      if (refused) {
        await db.exec('ROLLBACK');
        return badRequest(res, refused);
      }
      await db.exec('COMMIT');
      sendJson(res, 200, { details: await detailsOf(product) });
    } catch (err) {
      await db.exec('ROLLBACK').catch(() => {});
      throw err;
    }
  });

  route('GET', '/api/categories', async (req, res) => {
    const rows = await db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all();
    sendJson(res, 200, rows.map((r) => r.category));
  });

  route('POST', '/api/products/:id/photo', async (req, res, params) => {
    if (await notProductEditor(req, res)) return;
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
    sendJson(res, 200, serializeProduct(row, await canSeeCosts(req), await bikeKinds()));
  }, uploadedImageBody(MAX_PRODUCT_PHOTO_BYTES));
}
