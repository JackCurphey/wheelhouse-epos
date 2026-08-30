// Bike Shop EPOS - local server, PostgreSQL-backed.
import './load-env.js';
import { createServer } from 'node:http';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { prepare, dbExec, runWithShop, pool } from './db.js';
import { runMigrations } from './migrations/run-migrations.js';
import { runSync } from './suppliers/index.js';
import { sendSms } from './sms.js';
import {
  AuthError,
  createShop,
  createEmployeeLogin,
  listLogins,
  setLoginActive,
  verifyLogin,
  createSession,
  getSessionContext,
  destroySession,
  serializeLogin,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from './auth.js';
import {
  CustomerAuthError,
  signupCustomer,
  verifyCustomerLogin,
  createCustomerSession,
  getCustomerSessionContext,
  destroyCustomerSession,
  serializeCustomerLogin,
  CUSTOMER_SESSION_COOKIE,
  CUSTOMER_SESSION_MAX_AGE_SECONDS,
} from './customer-auth.js';
import {
  getOrCreateStorefrontSettings,
  updateStorefrontSettings,
  serializeStorefrontSettings,
  parseStorefrontSlugCandidate,
  resolveStorefrontShop,
  getStorefrontInfo,
  listStorefrontProducts,
} from './storefront.js';
import { getShopifyConnection, saveShopifyConnection, serializeShopifyConnection, registerShopifyWebhooks, syncProductToShopify, unpublishProductFromShopify } from './shopify.js';

async function syncProductWithShopifyIfNeeded(previousShowOnline, updatedProductRow) {
  try {
    if (updatedProductRow.show_online) {
      await syncProductToShopify(updatedProductRow);
    } else if (previousShowOnline && !updatedProductRow.show_online) {
      await unpublishProductFromShopify(updatedProductRow);
    }
  } catch (err) {
    console.error('Shopify product sync failed', err);
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORTAL_DIR = path.join(__dirname, '..', 'public-portal');
const STOREFRONT_DIR = path.join(__dirname, '..', 'public-storefront');
const DEMO_FILE = path.join(__dirname, '..', 'public-demo', 'sdbdemo.html');
// Attachment bytes live here as flat files named by a random per-file token
// (see workshop_job_attachments.storage_key) - never the customer's original
// filename, so there's nothing to sanitize or path-traverse with. The token
// alone never grants access; every read goes through the download route,
// which checks the owning job through the normal RLS-scoped `db`. Backed by
// a named Docker volume (docker-compose.yml) so uploads survive a rebuild
// the same way Postgres's data does.
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

// Every request that touches shop data runs inside `runWithShop(shopId, ...)`
// (see the request handler at the bottom of this file), which checks out a
// dedicated Postgres client for the request and sets the RLS session
// variable on it. `db` below is just `prepare`/`exec` from db.js under their
// old node:sqlite-shaped names, so the ~70 route handlers in this file keep
// using the plain `db.prepare(...)` calls they always have - each one reads
// whichever client is current for the request via AsyncLocalStorage
// internally, and RLS transparently scopes every query to that request's
// shop, so no call site here needs a shop_id filter added by hand.
const db = { prepare, exec: dbExec };

function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

// Secure is conditional on how this request actually arrived rather than
// always-on, since the app is also used directly over plain http://localhost
// - a browser silently refuses to store a Secure cookie set over http, which
// would break local/dev use. Behind the Cloudflare Tunnel, the original
// public request was https even though it reaches this process over plain
// http locally, which is exactly what x-forwarded-proto communicates.
function isHttpsRequest(req) {
  return req.headers['x-forwarded-proto'] === 'https';
}

function setSessionCookie(req, res, token) {
  const secure = isHttpsRequest(req) ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

// In-memory per-IP rate limiting for login/signup - proportionate for a
// single-process app behind one tunnel, and only needed now that the app is
// reachable from the open internet rather than just localhost. cf-connecting-ip
// is Cloudflare's authoritative client IP (the tunnel strips anything a
// client tries to spoof in that header before it reaches this process).
function clientIp(req) {
  return (
    req.headers['cf-connecting-ip'] ||
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

function makeRateLimiter(max, windowMs) {
  const hits = new Map(); // key -> { count, resetAt }
  return {
    check(key) {
      const now = Date.now();
      const entry = hits.get(key);
      if (!entry || entry.resetAt < now) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if (entry.count >= max) return false;
      entry.count++;
      return true;
    },
    reset(key) {
      hits.delete(key);
    },
  };
}

const loginLimiter = makeRateLimiter(10, 15 * 60 * 1000); // 10 attempts / 15 min / IP
const signupLimiter = makeRateLimiter(5, 60 * 60 * 1000); // 5 new shops / hour / IP

async function currentSession(req) {
  const { [SESSION_COOKIE]: token } = parseCookies(req);
  return getSessionContext(token);
}

function serializeSession({ login, shop }) {
  return {
    id: login.id,
    name: login.name,
    email: login.email,
    isOwner: !!login.is_owner,
    shopName: shop.name,
    shopSlug: shop.slug,
  };
}

// ---------- Customer portal auth helpers ----------
// Parallel to the staff ones above but on their own cookie name, so a
// customer session and a staff session can coexist in the same browser
// without either one clobbering the other.

function setCustomerSessionCookie(req, res, token) {
  const secure = isHttpsRequest(req) ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${CUSTOMER_SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${CUSTOMER_SESSION_MAX_AGE_SECONDS}${secure}`
  );
}

function clearCustomerSessionCookie(res) {
  res.setHeader('Set-Cookie', `${CUSTOMER_SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

async function currentCustomerSession(req) {
  const { [CUSTOMER_SESSION_COOKIE]: token } = parseCookies(req);
  return getCustomerSessionContext(token);
}

const portalLoginLimiter = makeRateLimiter(10, 15 * 60 * 1000);
const portalSignupLimiter = makeRateLimiter(5, 60 * 60 * 1000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function notFound(res, msg = 'Not found') {
  sendJson(res, 404, { error: msg });
}

function badRequest(res, msg = 'Bad request') {
  sendJson(res, 400, { error: msg });
}

async function readJsonBody(req, maxBytes = 2_000_000) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > maxBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function nowIso() {
  return new Date().toISOString();
}

// ---------- Product helpers ----------

function serializeProduct(row) {
  return {
    id: row.id,
    sku: row.sku,
    barcode: row.barcode,
    name: row.name,
    category: row.category,
    price: row.price,
    cost: row.cost,
    stockQty: row.stock_qty,
    lowStockThreshold: row.low_stock_threshold,
    supplier: row.supplier,
    active: !!row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    showOnline: !!row.show_online,
    description: row.description || '',
    photoUrl: row.photo_url || null,
  };
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
    sql += ' AND (name LIKE ? OR sku LIKE ? OR barcode LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  sql += ' ORDER BY category, name';
  const rows = await db.prepare(sql).all(...params);
  return rows.map(serializeProduct);
}

// ---------- Route handlers ----------

const routes = [];
function route(method, pattern, handler) {
  // pattern like '/api/products/:id'
  const paramNames = [];
  const regex = new RegExp(
    '^' +
      pattern
        .split('/')
        .map((seg) => {
          if (seg.startsWith(':')) {
            paramNames.push(seg.slice(1));
            return '([^/]+)';
          }
          return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        })
        .join('/') +
      '$'
  );
  routes.push({ method, regex, paramNames, handler });
}

// ---------- Auth ----------
// Unlike every other route in this file, everything under /api/auth/ doesn't
// run inside runWithShop (see the request handler at the bottom) - it only
// ever touches the shop/login registry (auth.js), never a specific shop's
// data, and each handler resolves its own session via currentSession().

// Closed by default (no SIGNUP_CODE set): the app is reachable from the open
// internet now, and without this, anyone who finds the URL could create a
// shop account. Set SIGNUP_CODE in the environment and share it privately
// with whoever you actually want to be able to sign up.
route('POST', '/api/auth/signup', async (req, res) => {
  const ip = clientIp(req);
  if (!signupLimiter.check(ip)) return sendJson(res, 429, { error: 'Too many accounts created from this network - please try again later.' });
  const body = await readJsonBody(req);
  if (!process.env.SIGNUP_CODE || body.signupCode !== process.env.SIGNUP_CODE) {
    return sendJson(res, 403, { error: process.env.SIGNUP_CODE ? 'Invalid invite code' : 'Signups are currently closed' });
  }
  let created;
  try {
    created = await createShop({ shopName: body.shopName, ownerName: body.ownerName, email: body.email, password: body.password });
  } catch (err) {
    if (err instanceof AuthError) return badRequest(res, err.message);
    throw err;
  }
  const token = await createSession(created.login.id);
  setSessionCookie(req, res, token);
  sendJson(res, 201, serializeSession(await getSessionContext(token)));
});

route('POST', '/api/auth/login', async (req, res) => {
  const ip = clientIp(req);
  if (!loginLimiter.check(ip)) return sendJson(res, 429, { error: 'Too many login attempts - please wait a few minutes and try again.' });
  const body = await readJsonBody(req);
  let login;
  try {
    login = await verifyLogin(body.email, body.password);
  } catch (err) {
    if (err instanceof AuthError) return sendJson(res, 401, { error: err.message });
    throw err;
  }
  loginLimiter.reset(ip);
  const token = await createSession(login.id);
  setSessionCookie(req, res, token);
  sendJson(res, 200, serializeSession(await getSessionContext(token)));
});

route('POST', '/api/auth/logout', async (req, res) => {
  const { [SESSION_COOKIE]: token } = parseCookies(req);
  await destroySession(token);
  clearSessionCookie(res);
  sendJson(res, 200, { ok: true });
});

route('GET', '/api/auth/me', async (req, res) => {
  const ctx = await currentSession(req);
  if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
  sendJson(res, 200, serializeSession(ctx));
});

// ---------- Auth: employee logins (owner-only to add/deactivate) ----------

route('GET', '/api/auth/team', async (req, res) => {
  const ctx = await currentSession(req);
  if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
  sendJson(res, 200, await listLogins(ctx.shop.id));
});

route('POST', '/api/auth/team', async (req, res) => {
  const ctx = await currentSession(req);
  if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
  if (!ctx.login.is_owner) return sendJson(res, 403, { error: 'Only the owner can add employee logins' });
  const body = await readJsonBody(req);
  try {
    const login = await createEmployeeLogin({ shopId: ctx.shop.id, name: body.name, email: body.email, password: body.password });
    sendJson(res, 201, serializeLogin(login));
  } catch (err) {
    if (err instanceof AuthError) return badRequest(res, err.message);
    throw err;
  }
});

route('PUT', '/api/auth/team/:id', async (req, res, params) => {
  const ctx = await currentSession(req);
  if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
  if (!ctx.login.is_owner) return sendJson(res, 403, { error: 'Only the owner can manage employee logins' });
  const body = await readJsonBody(req);
  try {
    const login = await setLoginActive(ctx.shop.id, Number(params.id), !!body.active);
    sendJson(res, 200, login);
  } catch (err) {
    if (err instanceof AuthError) return badRequest(res, err.message);
    throw err;
  }
});

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
    await syncProductWithShopifyIfNeeded(false, row);
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
    await syncProductWithShopifyIfNeeded(existing.show_online, row);
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
  const row = await db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  sendJson(res, 200, serializeProduct(row));
});

route('GET', '/api/categories', async (req, res) => {
  const rows = await db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all();
  sendJson(res, 200, rows.map((r) => r.category));
});

// ---------- Suppliers & catalogue sync ----------
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

// ---------- Purchase orders ----------
// Build an order against a supplier, then book in deliveries against it
// (increasing product stock). Supports partial/split deliveries: each line
// tracks qty_ordered vs qty_received and can be booked in more than once.
// Step one of eventually importing orders straight from a B2B distributor -
// not built here, this is the manual-entry version.

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
  };
}

const PO_SELECT = `SELECT po.*, s.name AS supplier_name FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id`;

async function loadPurchaseOrderItems(id) {
  return db.prepare('SELECT * FROM purchase_order_items WHERE purchase_order_id = ? ORDER BY id').all(id);
}

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

route('POST', '/api/purchase-orders', async (req, res) => {
  const body = await readJsonBody(req);
  const supplierId = Number(body.supplierId);
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

route('POST', '/api/purchase-orders/:id/receive', async (req, res, params) => {
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

  await db.exec('BEGIN');
  try {
    for (const { line, qtyReceived } of toApply) {
      await db.prepare('UPDATE purchase_order_items SET qty_received = qty_received + ? WHERE id = ?').run(
        qtyReceived,
        line.id
      );
      const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(line.product_id);
      await db.prepare('UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ?').run(
        product.stock_qty + qtyReceived,
        nowIso(),
        product.id
      );
      await db.prepare(
        `INSERT INTO stock_movements (product_id, change_qty, type, note, purchase_order_id) VALUES (?, ?, 'po_receipt', ?, ?)`
      ).run(product.id, qtyReceived, `Booked in from PO #${id}${existing.reference ? ` (${existing.reference})` : ''}`, id);
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

  const row = await db.prepare(PO_SELECT + ' WHERE po.id = ?').get(id);
  sendJson(res, 200, serializePurchaseOrder(row, await loadPurchaseOrderItems(id)));
});

// ---------- Customers ----------

function serializeCustomerGroup(row) {
  return { id: row.id, name: row.name, discountPercent: row.discount_percent };
}

function resolveDiscountPercent(raw, existing) {
  if (raw === undefined) return existing !== undefined ? existing : 0;
  const pct = Number(raw);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return null;
  return pct;
}

async function groupsForCustomer(customerId) {
  const rows = await db
    .prepare(
      `SELECT g.* FROM customer_groups g
       JOIN customer_group_members m ON m.group_id = g.id
       WHERE m.customer_id = ? ORDER BY g.name`
    )
    .all(customerId);
  return rows.map(serializeCustomerGroup);
}

// Loads every customer->group membership in one query rather than one query
// per customer, then hands listCustomers() a lookup it can attach per row.
async function groupsByCustomerId() {
  const rows = await db
    .prepare(
      `SELECT m.customer_id, g.* FROM customer_group_members m
       JOIN customer_groups g ON g.id = m.group_id`
    )
    .all();
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.customer_id)) map.set(r.customer_id, []);
    map.get(r.customer_id).push(serializeCustomerGroup(r));
  }
  return map;
}

// Replaces a customer's full group membership list - simplest correct way
// to apply an edit from the customer form, which always submits the
// complete set of ticked groups rather than individual add/remove deltas.
async function setCustomerGroups(customerId, groupIds) {
  await db.prepare('DELETE FROM customer_group_members WHERE customer_id = ?').run(customerId);
  if (!groupIds.length) return;
  const insert = db.prepare(
    'INSERT INTO customer_group_members (customer_id, group_id) VALUES (?, ?) ON CONFLICT (shop_id, customer_id, group_id) DO NOTHING'
  );
  for (const groupId of groupIds) await insert.run(customerId, groupId);
}

// Validates a raw groupIds array against real, existing groups. Returns null
// (rather than throwing) for an absent field so callers can tell "not
// supplied - leave unchanged" apart from "supplied as an empty list".
async function resolveGroupIds(rawGroupIds) {
  if (rawGroupIds === undefined) return null;
  if (!Array.isArray(rawGroupIds)) return { error: 'groupIds must be an array' };
  const ids = [...new Set(rawGroupIds.map(Number))];
  for (const id of ids) {
    if (!(await db.prepare('SELECT id FROM customer_groups WHERE id = ?').get(id))) {
      return { error: `Group ${id} not found` };
    }
  }
  return { ids };
}

function serializeCustomer(row, groups) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    active: !!row.active,
    groups: groups || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listCustomers({ search, activeOnly }) {
  let sql = 'SELECT * FROM customers WHERE 1=1';
  const params = [];
  if (activeOnly) {
    sql += ' AND active = 1';
  }
  if (search) {
    sql += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  sql += ' ORDER BY name';
  const rows = await db.prepare(sql).all(...params);
  const groupMap = await groupsByCustomerId();
  return rows.map((row) => serializeCustomer(row, groupMap.get(row.id) || []));
}

// ---------- Customer groups ----------

route('GET', '/api/customer-groups', async (req, res) => {
  const rows = await db.prepare('SELECT * FROM customer_groups ORDER BY name').all();
  sendJson(res, 200, rows.map(serializeCustomerGroup));
});

route('POST', '/api/customer-groups', async (req, res) => {
  const body = await readJsonBody(req);
  const name = (body.name || '').trim();
  if (!name) return badRequest(res, 'Group name is required');
  const discountPercent = resolveDiscountPercent(body.discountPercent, 0);
  if (discountPercent === null) return badRequest(res, 'Discount must be a number between 0 and 100');
  try {
    const info = await db.prepare('INSERT INTO customer_groups (name, discount_percent) VALUES (?, ?)').run(name, discountPercent);
    const row = await db.prepare('SELECT * FROM customer_groups WHERE id = ?').get(info.lastInsertRowid);
    sendJson(res, 201, serializeCustomerGroup(row));
  } catch (err) {
    if (err.code === '23505') return badRequest(res, `A group called "${name}" already exists`);
    throw err;
  }
});

route('PUT', '/api/customer-groups/:id', async (req, res, params) => {
  const id = Number(params.id);
  const existing = await db.prepare('SELECT * FROM customer_groups WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Group not found');
  const body = await readJsonBody(req);
  const name = (body.name || '').trim();
  if (!name) return badRequest(res, 'Group name is required');
  const discountPercent = resolveDiscountPercent(body.discountPercent, existing.discount_percent);
  if (discountPercent === null) return badRequest(res, 'Discount must be a number between 0 and 100');
  try {
    await db.prepare(
      "UPDATE customer_groups SET name = ?, discount_percent = ?, updated_at = now() WHERE id = ?"
    ).run(name, discountPercent, id);
    const row = await db.prepare('SELECT * FROM customer_groups WHERE id = ?').get(id);
    sendJson(res, 200, serializeCustomerGroup(row));
  } catch (err) {
    if (err.code === '23505') return badRequest(res, `A group called "${name}" already exists`);
    throw err;
  }
});

route('DELETE', '/api/customer-groups/:id', async (req, res, params) => {
  const id = Number(params.id);
  const existing = await db.prepare('SELECT * FROM customer_groups WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Group not found');
  await db.prepare('DELETE FROM customer_group_members WHERE group_id = ?').run(id);
  await db.prepare('DELETE FROM customer_groups WHERE id = ?').run(id);
  sendJson(res, 200, { ok: true });
});

route('GET', '/api/customers', async (req, res, params, query) => {
  const customers = await listCustomers({
    search: query.get('search') || '',
    activeOnly: query.get('all') !== '1',
  });
  sendJson(res, 200, customers);
});

route('GET', '/api/customers/:id', async (req, res, params) => {
  const id = Number(params.id);
  const row = await db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!row) return notFound(res, 'Customer not found');
  sendJson(res, 200, serializeCustomer(row, await groupsForCustomer(row.id)));
});

route('GET', '/api/customers/:id/sales', async (req, res, params) => {
  const id = Number(params.id);
  const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!customer) return notFound(res, 'Customer not found');
  const rows = await db.prepare(SALE_SELECT + ' WHERE s.customer_id = ? ORDER BY s.id DESC LIMIT 500').all(id);
  sendJson(res, 200, rows.map((r) => serializeSale(r)));
});

route('POST', '/api/customers', async (req, res) => {
  const body = await readJsonBody(req);
  const name = (body.name || '').trim();
  if (!name) return badRequest(res, 'Customer name is required');
  const email = (body.email || '').trim();
  const phone = (body.phone || '').trim();
  const notes = (body.notes || '').trim();

  const groups = await resolveGroupIds(body.groupIds);
  if (groups && groups.error) return badRequest(res, groups.error);

  const info = await db
    .prepare('INSERT INTO customers (name, email, phone, notes, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(name, email, phone, notes, nowIso());
  if (groups) await setCustomerGroups(info.lastInsertRowid, groups.ids);
  const row = await db.prepare('SELECT * FROM customers WHERE id = ?').get(info.lastInsertRowid);
  sendJson(res, 201, serializeCustomer(row, await groupsForCustomer(row.id)));
});

route('PUT', '/api/customers/:id', async (req, res, params) => {
  const id = Number(params.id);
  const existing = await db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Customer not found');
  const body = await readJsonBody(req);

  const name = body.name !== undefined ? String(body.name).trim() : existing.name;
  const email = body.email !== undefined ? String(body.email).trim() : existing.email;
  const phone = body.phone !== undefined ? String(body.phone).trim() : existing.phone;
  const notes = body.notes !== undefined ? String(body.notes).trim() : existing.notes;
  const active = body.active !== undefined ? (body.active ? 1 : 0) : existing.active;

  if (!name) return badRequest(res, 'Customer name is required');

  const groups = await resolveGroupIds(body.groupIds);
  if (groups && groups.error) return badRequest(res, groups.error);

  await db.prepare(
    'UPDATE customers SET name = ?, email = ?, phone = ?, notes = ?, active = ?, updated_at = ? WHERE id = ?'
  ).run(name, email, phone, notes, active, nowIso(), id);
  if (groups) await setCustomerGroups(id, groups.ids);
  const row = await db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  sendJson(res, 200, serializeCustomer(row, await groupsForCustomer(row.id)));
});

route('DELETE', '/api/customers/:id', async (req, res, params) => {
  const id = Number(params.id);
  const existing = await db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Customer not found');
  await db.prepare('UPDATE customers SET active = 0, updated_at = ? WHERE id = ?').run(nowIso(), id);
  sendJson(res, 200, { ok: true });
});

// ---------- Customer bikes ----------

function serializeBike(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    make: row.make,
    model: row.model,
    colour: row.colour,
    serialNumber: row.serial_number,
    notes: row.notes,
    active: !!row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

route('GET', '/api/customers/:id/bikes', async (req, res, params, query) => {
  const customerId = Number(params.id);
  const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!customer) return notFound(res, 'Customer not found');
  let sql = 'SELECT * FROM customer_bikes WHERE customer_id = ?';
  const args = [customerId];
  if (query.get('all') !== '1') sql += ' AND active = 1';
  sql += ' ORDER BY make, model';
  const rows = await db.prepare(sql).all(...args);
  sendJson(res, 200, rows.map(serializeBike));
});

route('POST', '/api/customers/:id/bikes', async (req, res, params) => {
  const customerId = Number(params.id);
  const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!customer) return notFound(res, 'Customer not found');
  const body = await readJsonBody(req);
  const make = (body.make || '').trim();
  const model = (body.model || '').trim();
  if (!make && !model) return badRequest(res, 'Make or model is required');
  const colour = (body.colour || '').trim();
  const serialNumber = (body.serialNumber || '').trim();
  const notes = (body.notes || '').trim();

  const info = await db
    .prepare(
      `INSERT INTO customer_bikes (customer_id, make, model, colour, serial_number, notes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(customerId, make, model, colour, serialNumber, notes, nowIso());
  const row = await db.prepare('SELECT * FROM customer_bikes WHERE id = ?').get(info.lastInsertRowid);
  sendJson(res, 201, serializeBike(row));
});

route('PUT', '/api/bikes/:id', async (req, res, params) => {
  const id = Number(params.id);
  const existing = await db.prepare('SELECT * FROM customer_bikes WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Bike not found');
  const body = await readJsonBody(req);

  const make = body.make !== undefined ? String(body.make).trim() : existing.make;
  const model = body.model !== undefined ? String(body.model).trim() : existing.model;
  if (!make && !model) return badRequest(res, 'Make or model is required');
  const colour = body.colour !== undefined ? String(body.colour).trim() : existing.colour;
  const serialNumber = body.serialNumber !== undefined ? String(body.serialNumber).trim() : existing.serial_number;
  const notes = body.notes !== undefined ? String(body.notes).trim() : existing.notes;
  const active = body.active !== undefined ? (body.active ? 1 : 0) : existing.active;

  await db.prepare(
    `UPDATE customer_bikes SET make = ?, model = ?, colour = ?, serial_number = ?, notes = ?, active = ?, updated_at = ?
     WHERE id = ?`
  ).run(make, model, colour, serialNumber, notes, active, nowIso(), id);
  const row = await db.prepare('SELECT * FROM customer_bikes WHERE id = ?').get(id);
  sendJson(res, 200, serializeBike(row));
});

route('DELETE', '/api/bikes/:id', async (req, res, params) => {
  const id = Number(params.id);
  const existing = await db.prepare('SELECT * FROM customer_bikes WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Bike not found');
  await db.prepare('UPDATE customer_bikes SET active = 0, updated_at = ? WHERE id = ?').run(nowIso(), id);
  sendJson(res, 200, { ok: true });
});

route('GET', '/api/bikes/:id/jobs', async (req, res, params) => {
  const id = Number(params.id);
  const bike = await db.prepare('SELECT * FROM customer_bikes WHERE id = ?').get(id);
  if (!bike) return notFound(res, 'Bike not found');
  const rows = await db
    .prepare('SELECT * FROM workshop_jobs WHERE bike_id = ? ORDER BY job_date DESC, start_time DESC')
    .all(id);
  sendJson(res, 200, rows.map(serializeWorkshopJob));
});

// ---------- Customer messages (SMS) ----------
// One-off texts sent to a customer via Twilio (see sms.js). A failed send
// still gets a history row (status: 'failed') rather than being dropped, so
// staff can see what was actually attempted.

function serializeCustomerMessage(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    direction: row.direction,
    body: row.body,
    status: row.status,
    error: row.error,
    sentByName: row.sent_by_name,
    createdAt: row.created_at,
  };
}

const MESSAGE_SELECT = `SELECT m.*, l.name AS sent_by_name FROM customer_messages m LEFT JOIN logins l ON l.id = m.sent_by_login_id`;

route('GET', '/api/customers/:id/texts', async (req, res, params) => {
  const customerId = Number(params.id);
  const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!customer) return notFound(res, 'Customer not found');
  const rows = await db.prepare(MESSAGE_SELECT + ' WHERE m.customer_id = ? ORDER BY m.id DESC').all(customerId);
  sendJson(res, 200, rows.map(serializeCustomerMessage));
});

route('POST', '/api/customers/:id/texts', async (req, res, params) => {
  const ctx = await currentSession(req);
  if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
  const customerId = Number(params.id);
  const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!customer) return notFound(res, 'Customer not found');
  if (!customer.phone) return badRequest(res, 'This customer has no phone number on file');
  const body = await readJsonBody(req);
  const text = String(body.body || '').trim();
  if (!text) return badRequest(res, 'Message text is required');
  if (text.length > 1600) return badRequest(res, 'Message is too long');

  const result = await sendSms(customer.phone, text);
  const info = await db
    .prepare(
      `INSERT INTO customer_messages (customer_id, body, status, error, provider_sid, sent_by_login_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(customerId, text, result.ok ? 'sent' : 'failed', result.ok ? null : result.error, result.ok ? result.sid : null, ctx.login.id);
  const row = await db.prepare(MESSAGE_SELECT + ' WHERE m.id = ?').get(info.lastInsertRowid);
  // Always 201: the request itself succeeded (an attempt was made and
  // recorded) even when the send didn't - the frontend reads row.status to
  // show the outcome, rather than this route throwing on a Twilio failure.
  sendJson(res, 201, serializeCustomerMessage(row));
});

// ---------- Sales ----------

function serializeSale(row, items, payments) {
  return {
    id: row.id,
    createdAt: row.created_at,
    customerId: row.customer_id,
    customerName: row.customer_name !== undefined ? row.customer_name : undefined,
    cashierId: row.cashier_id,
    cashierName: row.cashier_name !== undefined ? row.cashier_name : undefined,
    subtotal: row.subtotal,
    discount: row.discount,
    groupDiscountAmount: row.group_discount_amount,
    groupDiscountName: row.group_discount_name,
    total: row.total,
    paymentMethod: row.payment_method,
    cashAmount: row.cash_amount,
    cardAmount: row.card_amount,
    cashTendered: row.cash_tendered,
    extraPayments: payments ? payments.map((p) => ({ tenderType: p.tender_type, amount: p.amount })) : undefined,
    note: row.note,
    items: items
      ? items.map((it) => ({
          id: it.id,
          productId: it.product_id,
          name: it.name,
          sku: it.sku,
          unitPrice: it.unit_price,
          qty: it.qty,
          lineTotal: it.line_total,
        }))
      : undefined,
  };
}

const SALE_SELECT = `SELECT s.*, c.name AS customer_name, ca.name AS cashier_name FROM sales s LEFT JOIN customers c ON c.id = s.customer_id LEFT JOIN employees ca ON ca.id = s.cashier_id`;

route('GET', '/api/sales', async (req, res, params, query) => {
  const dateFilter = query.get('date'); // 'today' or 'YYYY-MM-DD'
  const customerId = query.get('customerId');
  const cashierId = query.get('cashierId');
  let sql = SALE_SELECT + ' WHERE 1=1';
  const args = [];
  let dateStr = null;
  if (dateFilter === 'today') dateStr = new Date().toISOString().slice(0, 10);
  else if (dateFilter) dateStr = dateFilter;
  if (dateStr) {
    sql += " AND s.created_at >= ?::date AND s.created_at < ?::date + interval '1 day'";
    args.push(dateStr, dateStr);
  }
  if (customerId) {
    sql += ' AND s.customer_id = ?';
    args.push(Number(customerId));
  }
  if (cashierId) {
    sql += ' AND s.cashier_id = ?';
    args.push(Number(cashierId));
  }
  sql += ' ORDER BY s.id DESC LIMIT 500';
  const rows = await db.prepare(sql).all(...args);
  sendJson(
    res,
    200,
    rows.map((r) => serializeSale(r))
  );
});

route('GET', '/api/sales/:id', async (req, res, params) => {
  const id = Number(params.id);
  const sale = await db.prepare(SALE_SELECT + ' WHERE s.id = ?').get(id);
  if (!sale) return notFound(res, 'Sale not found');
  const items = await db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id);
  const payments = await db.prepare('SELECT * FROM sale_payments WHERE sale_id = ?').all(id);
  sendJson(res, 200, serializeSale(sale, items, payments));
});

class ValidationError extends Error {}

async function resolveCashierId(rawId) {
  if (rawId === undefined || rawId === null || rawId === '') return { ok: true, cashierId: null };
  const cashierId = Number(rawId);
  const cashier = await db.prepare('SELECT * FROM employees WHERE id = ? AND active = 1 AND is_cashier = 1').get(cashierId);
  if (!cashier) return { ok: false };
  return { ok: true, cashierId };
}

// Computed server-side (never trusts a client-sent amount) from whichever of
// the customer's groups carries the highest discount_percent, so a sale's
// group discount can't be tampered with via the API. Applies to the same net
// subtotal (after any per-line price overrides) that the flat discount does.
async function resolveGroupDiscount(customerId, subtotal) {
  if (!customerId) return { amount: 0, name: '' };
  const top = await db
    .prepare(
      `SELECT g.name, g.discount_percent FROM customer_groups g
       JOIN customer_group_members m ON m.group_id = g.id
       WHERE m.customer_id = ? AND g.discount_percent > 0
       ORDER BY g.discount_percent DESC, g.name ASC LIMIT 1`
    )
    .get(customerId);
  if (!top) return { amount: 0, name: '' };
  const amount = Math.round(subtotal * (top.discount_percent / 100) * 100) / 100;
  return { amount, name: `${top.name} (${top.discount_percent}%)` };
}

// Validates items against live stock, inserts the sale + sale_items, and
// deducts stock. Shared by direct checkout and quote/order -> sale conversion.
async function createSale({ customerId, cashierId, items, discount, cashAmount, cardAmount, cashTendered, payments, note }) {
  const loaded = [];
  for (const it of items) {
    const productId = Number(it.productId);
    const qty = Math.trunc(Number(it.qty));
    if (!productId || !Number.isFinite(qty) || qty <= 0) {
      throw new ValidationError('Each item needs a valid productId and positive qty');
    }
    const product = await db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(productId);
    if (!product) throw new ValidationError(`Product ${productId} not found or inactive`);
    if (product.stock_qty < qty) {
      throw new ValidationError(`Not enough stock for "${product.name}" (have ${product.stock_qty}, need ${qty})`);
    }
    let unitPrice = product.price;
    if (it.unitPrice !== undefined && it.unitPrice !== null && it.unitPrice !== '') {
      const overridden = Number(it.unitPrice);
      if (!Number.isFinite(overridden) || overridden < 0) {
        throw new ValidationError(`Invalid price for "${product.name}"`);
      }
      unitPrice = overridden;
    }
    loaded.push({ product, qty, unitPrice });
  }

  const subtotal = loaded.reduce((sum, { qty, unitPrice }) => sum + unitPrice * qty, 0);
  const groupDiscount = await resolveGroupDiscount(customerId, subtotal);
  const total = Math.max(0, subtotal - discount - groupDiscount.amount);

  const cash = Math.max(0, Number(cashAmount) || 0);
  const card = Math.max(0, Number(cardAmount) || 0);
  const extraPayments = (Array.isArray(payments) ? payments : [])
    .map((p) => ({ tenderType: String(p.tenderType || '').trim(), amount: Math.max(0, Number(p.amount) || 0) }))
    .filter((p) => p.tenderType && p.amount > 0);
  const extraTotal = extraPayments.reduce((sum, p) => sum + p.amount, 0);
  if (Math.abs(cash + card + extraTotal - total) > 0.01) {
    throw new ValidationError('Payment amounts must add up to the total');
  }
  const methodsUsed = [];
  if (cash > 0) methodsUsed.push('Cash');
  if (card > 0) methodsUsed.push('Card');
  for (const p of extraPayments) methodsUsed.push(p.tenderType);
  const paymentMethod = methodsUsed.length > 1 ? 'Split' : methodsUsed[0] || 'Cash';

  await db.exec('BEGIN');
  try {
    const saleInfo = await db
      .prepare(
        `INSERT INTO sales (customer_id, cashier_id, subtotal, discount, total, payment_method, cash_amount, card_amount, cash_tendered, note, group_discount_amount, group_discount_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(customerId, cashierId, subtotal, discount, total, paymentMethod, cash, card, cashTendered, note, groupDiscount.amount, groupDiscount.name);
    const saleId = saleInfo.lastInsertRowid;

    for (const p of extraPayments) {
      await db.prepare('INSERT INTO sale_payments (sale_id, tender_type, amount) VALUES (?, ?, ?)').run(
        saleId,
        p.tenderType,
        p.amount
      );
    }

    for (const { product, qty, unitPrice } of loaded) {
      const lineTotal = unitPrice * qty;
      await db.prepare(
        `INSERT INTO sale_items (sale_id, product_id, name, sku, unit_price, qty, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(saleId, product.id, product.name, product.sku, unitPrice, qty, lineTotal);

      const newQty = product.stock_qty - qty;
      await db.prepare('UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ?').run(newQty, nowIso(), product.id);
      await db.prepare(
        `INSERT INTO stock_movements (product_id, change_qty, type, note) VALUES (?, ?, 'sale', ?)`
      ).run(product.id, -qty, `Sale #${saleId}`);
    }
    await db.exec('COMMIT');
    return saleId;
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
}

route('POST', '/api/sales', async (req, res) => {
  const body = await readJsonBody(req);
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return badRequest(res, 'Sale must include at least one item');
  const cashAmount = Math.max(0, Number(body.cashAmount) || 0);
  const cardAmount = Math.max(0, Number(body.cardAmount) || 0);
  const payments = Array.isArray(body.payments) ? body.payments : [];
  const discount = Math.max(0, Number(body.discount) || 0);
  const cashTendered = body.cashTendered !== undefined && body.cashTendered !== null && body.cashTendered !== ''
    ? Number(body.cashTendered)
    : null;
  const note = (body.note || '').trim();

  let customerId = null;
  if (body.customerId !== undefined && body.customerId !== null && body.customerId !== '') {
    customerId = Number(body.customerId);
    const customer = await db.prepare('SELECT * FROM customers WHERE id = ? AND active = 1').get(customerId);
    if (!customer) return badRequest(res, 'Customer not found or inactive');
  }

  const cashierResolved = await resolveCashierId(body.cashierId);
  if (!cashierResolved.ok) return badRequest(res, 'Cashier not found or inactive');
  if (cashierResolved.cashierId === null) return badRequest(res, 'Select a cashier before completing the sale');

  let saleId;
  try {
    saleId = await createSale({ customerId, cashierId: cashierResolved.cashierId, items, discount, cashAmount, cardAmount, cashTendered, payments, note });
  } catch (err) {
    if (err instanceof ValidationError) return badRequest(res, err.message);
    throw err;
  }

  const sale = await db.prepare(SALE_SELECT + ' WHERE s.id = ?').get(saleId);
  const savedItems = await db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
  const savedPayments = await db.prepare('SELECT * FROM sale_payments WHERE sale_id = ?').all(saleId);
  sendJson(res, 201, serializeSale(sale, savedItems, savedPayments));
});

// ---------- Quotes & orders (sale documents) ----------
// Both share one shape: a not-yet-completed set of items for a customer that
// can later be turned into a real sale via the /convert endpoint. "Quotes"
// are a price estimate the customer hasn't committed to; "orders" are items
// (often out of stock) the customer has committed to but not paid/collected
// yet. Neither affects stock until converted.

function serializeSaleDocument(row, items) {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    title: row.title || '',
    customerId: row.customer_id,
    customerName: row.customer_name !== undefined ? row.customer_name : undefined,
    cashierId: row.cashier_id,
    cashierName: row.cashier_name !== undefined ? row.cashier_name : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    subtotal: row.subtotal,
    discount: row.discount,
    total: row.total,
    note: row.note,
    convertedSaleId: row.converted_sale_id,
    workshopJobId: row.workshop_job_id,
    items: items
      ? items.map((it) => ({
          id: it.id,
          productId: it.product_id,
          name: it.name,
          sku: it.sku,
          unitPrice: it.unit_price,
          qty: it.qty,
          lineTotal: it.line_total,
        }))
      : undefined,
  };
}

const DOC_SELECT = `SELECT d.*, c.name AS customer_name, ca.name AS cashier_name FROM sale_documents d LEFT JOIN customers c ON c.id = d.customer_id LEFT JOIN employees ca ON ca.id = d.cashier_id`;
const DOC_KINDS = ['quote', 'order'];

route('GET', '/api/sale-documents', async (req, res, params, query) => {
  const kind = query.get('kind');
  if (!DOC_KINDS.includes(kind)) return badRequest(res, 'A valid "kind" query param (quote or order) is required');
  const status = query.get('status');
  let sql = DOC_SELECT + ' WHERE d.kind = ?';
  const args = [kind];
  if (status) {
    sql += ' AND d.status = ?';
    args.push(status);
  }
  sql += ' ORDER BY d.id DESC LIMIT 500';
  const rows = await db.prepare(sql).all(...args);
  sendJson(res, 200, rows.map((r) => serializeSaleDocument(r)));
});

route('GET', '/api/sale-documents/:id', async (req, res, params) => {
  const id = Number(params.id);
  const row = await db.prepare(DOC_SELECT + ' WHERE d.id = ?').get(id);
  if (!row) return notFound(res, 'Not found');
  const items = await db.prepare('SELECT * FROM sale_document_items WHERE document_id = ?').all(id);
  sendJson(res, 200, serializeSaleDocument(row, items));
});

route('POST', '/api/sale-documents', async (req, res) => {
  const body = await readJsonBody(req);
  const kind = body.kind;
  if (!DOC_KINDS.includes(kind)) return badRequest(res, 'kind must be "quote" or "order"');
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return badRequest(res, `A ${kind} must include at least one item`);
  const discount = Math.max(0, Number(body.discount) || 0);
  const note = (body.note || '').trim();
  const title = (body.title || '').trim();

  let customerId = null;
  if (body.customerId !== undefined && body.customerId !== null && body.customerId !== '') {
    customerId = Number(body.customerId);
    const customer = await db.prepare('SELECT * FROM customers WHERE id = ? AND active = 1').get(customerId);
    if (!customer) return badRequest(res, 'Customer not found or inactive');
  }

  const cashierResolved = await resolveCashierId(body.cashierId);
  if (!cashierResolved.ok) return badRequest(res, 'Cashier not found or inactive');

  // Snapshot product name/sku/price only - no stock check, since a quote or
  // order can reference items that are currently out of stock.
  const loaded = [];
  for (const it of items) {
    const productId = Number(it.productId);
    const qty = Math.trunc(Number(it.qty));
    if (!productId || !Number.isFinite(qty) || qty <= 0) {
      return badRequest(res, 'Each item needs a valid productId and positive qty');
    }
    const product = await db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(productId);
    if (!product) return badRequest(res, `Product ${productId} not found or inactive`);
    let unitPrice = product.price;
    if (it.unitPrice !== undefined && it.unitPrice !== null && it.unitPrice !== '') {
      const overridden = Number(it.unitPrice);
      if (!Number.isFinite(overridden) || overridden < 0) {
        return badRequest(res, `Invalid price for "${product.name}"`);
      }
      unitPrice = overridden;
    }
    loaded.push({ product, qty, unitPrice });
  }

  const subtotal = loaded.reduce((sum, { qty, unitPrice }) => sum + unitPrice * qty, 0);
  const total = Math.max(0, subtotal - discount);

  await db.exec('BEGIN');
  try {
    const info = await db
      .prepare(
        `INSERT INTO sale_documents (kind, customer_id, cashier_id, subtotal, discount, total, note, title, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(kind, customerId, cashierResolved.cashierId, subtotal, discount, total, note, title, nowIso());
    const docId = info.lastInsertRowid;
    for (const { product, qty, unitPrice } of loaded) {
      const lineTotal = unitPrice * qty;
      await db.prepare(
        `INSERT INTO sale_document_items (document_id, product_id, name, sku, unit_price, qty, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(docId, product.id, product.name, product.sku, unitPrice, qty, lineTotal);
    }
    await db.exec('COMMIT');
    const row = await db.prepare(DOC_SELECT + ' WHERE d.id = ?').get(docId);
    const savedItems = await db.prepare('SELECT * FROM sale_document_items WHERE document_id = ?').all(docId);
    sendJson(res, 201, serializeSaleDocument(row, savedItems));
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
});

route('PUT', '/api/sale-documents/:id', async (req, res, params) => {
  const id = Number(params.id);
  const existing = await db.prepare('SELECT * FROM sale_documents WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Not found');
  if (existing.status !== 'open') return badRequest(res, `This ${existing.kind} is already ${existing.status}`);
  const body = await readJsonBody(req);
  const status = body.status !== undefined ? String(body.status) : existing.status;
  if (!['open', 'cancelled'].includes(status)) return badRequest(res, 'Invalid status');

  const title = body.title !== undefined ? String(body.title).trim() : existing.title;
  const note = body.note !== undefined ? String(body.note).trim() : existing.note;

  let customerId = existing.customer_id;
  if (body.customerId !== undefined) {
    if (body.customerId === null || body.customerId === '') {
      customerId = null;
    } else {
      customerId = Number(body.customerId);
      const customer = await db.prepare('SELECT * FROM customers WHERE id = ? AND active = 1').get(customerId);
      if (!customer) return badRequest(res, 'Customer not found or inactive');
    }
  }

  let workshopJobId = existing.workshop_job_id;
  if (body.workshopJobId !== undefined) {
    if (body.workshopJobId === null) {
      workshopJobId = null;
    } else {
      const jobId = Number(body.workshopJobId);
      const job = await db.prepare('SELECT id FROM workshop_jobs WHERE id = ?').get(jobId);
      if (!job) return badRequest(res, 'Workshop job not found');
      workshopJobId = jobId;
    }
  }

  await db.prepare(
    'UPDATE sale_documents SET status = ?, title = ?, customer_id = ?, note = ?, workshop_job_id = ?, updated_at = ? WHERE id = ?'
  ).run(status, title, customerId, note, workshopJobId, nowIso(), id);
  const row = await db.prepare(DOC_SELECT + ' WHERE d.id = ?').get(id);
  const items = await db.prepare('SELECT * FROM sale_document_items WHERE document_id = ?').all(id);
  sendJson(res, 200, serializeSaleDocument(row, items));
});

// Replaces the full item list on an existing quote/order (e.g. adding parts
// to the placeholder order behind a workshop job). Items snapshot product
// name/sku/price like creation does - no stock check, same reasoning as
// POST /api/sale-documents.
route('PUT', '/api/sale-documents/:id/items', async (req, res, params) => {
  const id = Number(params.id);
  const existing = await db.prepare('SELECT * FROM sale_documents WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Not found');
  if (existing.status !== 'open') return badRequest(res, `This ${existing.kind} is already ${existing.status}`);
  const body = await readJsonBody(req);
  const items = Array.isArray(body.items) ? body.items : [];
  const discount = Math.max(0, Number(body.discount) || 0);

  const loaded = [];
  for (const it of items) {
    const productId = Number(it.productId);
    const qty = Math.trunc(Number(it.qty));
    if (!productId || !Number.isFinite(qty) || qty <= 0) {
      return badRequest(res, 'Each item needs a valid productId and positive qty');
    }
    const product = await db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(productId);
    if (!product) return badRequest(res, `Product ${productId} not found or inactive`);
    let unitPrice = product.price;
    if (it.unitPrice !== undefined && it.unitPrice !== null && it.unitPrice !== '') {
      const overridden = Number(it.unitPrice);
      if (!Number.isFinite(overridden) || overridden < 0) {
        return badRequest(res, `Invalid price for "${product.name}"`);
      }
      unitPrice = overridden;
    }
    loaded.push({ product, qty, unitPrice });
  }

  const subtotal = loaded.reduce((sum, { qty, unitPrice }) => sum + unitPrice * qty, 0);
  const total = Math.max(0, subtotal - discount);

  await db.exec('BEGIN');
  try {
    await db.prepare('DELETE FROM sale_document_items WHERE document_id = ?').run(id);
    for (const { product, qty, unitPrice } of loaded) {
      const lineTotal = unitPrice * qty;
      await db.prepare(
        `INSERT INTO sale_document_items (document_id, product_id, name, sku, unit_price, qty, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(id, product.id, product.name, product.sku, unitPrice, qty, lineTotal);
    }
    await db.prepare('UPDATE sale_documents SET subtotal = ?, discount = ?, total = ?, updated_at = ? WHERE id = ?').run(
      subtotal,
      discount,
      total,
      nowIso(),
      id
    );
    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }

  const row = await db.prepare(DOC_SELECT + ' WHERE d.id = ?').get(id);
  const savedItems = await db.prepare('SELECT * FROM sale_document_items WHERE document_id = ?').all(id);
  sendJson(res, 200, serializeSaleDocument(row, savedItems));
});

route('POST', '/api/sale-documents/:id/convert', async (req, res, params) => {
  const id = Number(params.id);
  const doc = await db.prepare('SELECT * FROM sale_documents WHERE id = ?').get(id);
  if (!doc) return notFound(res, 'Not found');
  if (doc.status !== 'open') return badRequest(res, `This ${doc.kind} is already ${doc.status}`);

  const body = await readJsonBody(req);
  const cashAmount = Math.max(0, Number(body.cashAmount) || 0);
  const cardAmount = Math.max(0, Number(body.cardAmount) || 0);
  const payments = Array.isArray(body.payments) ? body.payments : [];
  const cashTendered =
    body.cashTendered !== undefined && body.cashTendered !== null && body.cashTendered !== ''
      ? Number(body.cashTendered)
      : null;

  const cashierResolved = await resolveCashierId(body.cashierId);
  if (!cashierResolved.ok) return badRequest(res, 'Cashier not found or inactive');
  if (cashierResolved.cashierId === null) return badRequest(res, 'Select a cashier before completing the sale');

  const items = await db.prepare('SELECT * FROM sale_document_items WHERE document_id = ?').all(id);
  const saleItems = items.map((it) => ({ productId: it.product_id, qty: it.qty, unitPrice: it.unit_price }));

  let saleId;
  try {
    saleId = await createSale({
      customerId: doc.customer_id,
      cashierId: cashierResolved.cashierId,
      items: saleItems,
      discount: doc.discount,
      cashAmount,
      cardAmount,
      cashTendered,
      payments,
      note: `Converted from ${doc.kind} #${doc.id}`,
    });
  } catch (err) {
    if (err instanceof ValidationError) return badRequest(res, err.message);
    throw err;
  }

  await db.prepare('UPDATE sale_documents SET status = ?, converted_sale_id = ?, updated_at = ? WHERE id = ?').run(
    'converted',
    saleId,
    nowIso(),
    id
  );
  // An order tied to a workshop job (the "Show in workshop diary" link) is
  // the customer paying for and collecting that job - being tendered off is
  // the real-world signal the job itself is done, so it auto-completes here
  // rather than needing a separate manual step in the diary.
  if (doc.workshop_job_id) {
    await db.prepare(`UPDATE workshop_jobs SET status = 'complete', updated_at = ? WHERE id = ?`).run(nowIso(), doc.workshop_job_id);
  }

  const sale = await db.prepare(SALE_SELECT + ' WHERE s.id = ?').get(saleId);
  const savedItems = await db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
  const savedPayments = await db.prepare('SELECT * FROM sale_payments WHERE sale_id = ?').all(saleId);
  sendJson(res, 201, serializeSale(sale, savedItems, savedPayments));
});

// ---------- Workshop jobs ----------

function serializeWorkshopJob(row) {
  return {
    id: row.id,
    title: row.title,
    customerId: row.customer_id,
    customerName: row.customer_name !== undefined ? row.customer_name : undefined,
    bikeId: row.bike_id,
    bikeLabel: row.bike_label !== undefined ? row.bike_label : undefined,
    mechanicId: row.mechanic_id,
    mechanicName: row.mechanic_name !== undefined ? row.mechanic_name : undefined,
    jobDate: row.job_date,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    notes: row.notes,
    orderId: row.order_id,
    orderStatus: row.order_status,
    orderTotal: row.order_total,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// 'pending' is a customer-submitted booking (see /api/portal/*) awaiting a
// mechanic's manual review before it counts as scheduled - it still occupies
// its diary slot like any other status, so a second booking can't silently
// double it up, but staff have to explicitly approve it first.
const JOB_STATUSES = ['pending', 'scheduled', 'waiting_parts', 'on_hold', 'complete'];

function resolveJobStatus(raw, existing) {
  if (raw === undefined) return existing || 'scheduled';
  if (!JOB_STATUSES.includes(raw)) return null;
  return raw;
}

const WORKSHOP_JOB_SELECT = `SELECT w.*, c.name AS customer_name, trim(b.make || ' ' || b.model) AS bike_label, mech.name AS mechanic_name, d.id AS order_id, d.status AS order_status, d.total AS order_total
  FROM workshop_jobs w
  LEFT JOIN customers c ON c.id = w.customer_id
  LEFT JOIN customer_bikes b ON b.id = w.bike_id
  LEFT JOIN employees mech ON mech.id = w.mechanic_id
  LEFT JOIN sale_documents d ON d.workshop_job_id = w.id`;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

async function resolveJobCustomerId(rawId, existingId) {
  if (rawId === undefined) return { ok: true, customerId: existingId };
  if (rawId === null || rawId === '') return { ok: true, customerId: null };
  const customerId = Number(rawId);
  const customer = await db.prepare('SELECT * FROM customers WHERE id = ? AND active = 1').get(customerId);
  if (!customer) return { ok: false };
  return { ok: true, customerId };
}

// A bike belongs to exactly one customer, so a job can only be linked to a
// bike when it's also linked to that same bike's owner. When bikeId isn't
// explicitly provided (e.g. a drag/resize that only moves the time), the
// existing link is kept unless it no longer matches the resolved customer,
// in which case it's silently dropped rather than rejecting the request.
async function resolveJobBikeId(rawId, existingId, resolvedCustomerId) {
  if (rawId === undefined) {
    if (!existingId) return { ok: true, bikeId: null };
    const bike = await db.prepare('SELECT * FROM customer_bikes WHERE id = ?').get(existingId);
    if (!bike || !resolvedCustomerId || bike.customer_id !== resolvedCustomerId) {
      return { ok: true, bikeId: null };
    }
    return { ok: true, bikeId: existingId };
  }
  if (rawId === null || rawId === '') return { ok: true, bikeId: null };
  const bikeId = Number(rawId);
  const bike = await db.prepare('SELECT * FROM customer_bikes WHERE id = ? AND active = 1').get(bikeId);
  if (!bike) return { ok: false, error: 'Bike not found or inactive' };
  if (!resolvedCustomerId || bike.customer_id !== resolvedCustomerId) {
    return { ok: false, error: "That bike doesn't belong to the selected customer" };
  }
  return { ok: true, bikeId };
}

async function resolveJobMechanicId(rawId, existingId) {
  if (rawId === undefined) return { ok: true, mechanicId: existingId };
  if (rawId === null || rawId === '') return { ok: true, mechanicId: null };
  const mechanicId = Number(rawId);
  const mechanic = await db.prepare('SELECT * FROM employees WHERE id = ? AND active = 1 AND is_mechanic = 1').get(mechanicId);
  if (!mechanic) return { ok: false };
  return { ok: true, mechanicId };
}

function addMinutesToTime(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = Math.max(0, Math.min(23 * 60 + 59, h * 60 + m + minutes));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// Merges overlapping/adjacent [start,end) minute intervals before summing
// them, so two jobs that overlap (or just touch) don't get their shared
// time counted twice - that would understate how much of the day is
// actually still free.
function mergedMinutes(intervals) {
  if (!intervals.length) return 0;
  const sorted = intervals.slice().sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [curStart, curEnd] = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const [s, e] = sorted[i];
    if (s <= curEnd) {
      curEnd = Math.max(curEnd, e);
    } else {
      total += curEnd - curStart;
      [curStart, curEnd] = [s, e];
    }
  }
  total += curEnd - curStart;
  return total;
}

// How many minutes of a mechanic's working day (clamped to opening/closing
// time) are still free, given every job already on the books for that
// date - the basis for both the portal's "this day is full" display and
// the authoritative reject-on-booking check below.
async function mechanicFreeMinutes(mechanicId, jobDate, openingTime, closingTime) {
  const openMin = timeToMinutes(openingTime);
  const closeMin = timeToMinutes(closingTime);
  const rows = await db
    .prepare(
      `SELECT start_time, end_time FROM workshop_jobs
       WHERE mechanic_id = ? AND job_date = ? AND start_time IS NOT NULL AND start_time != ''`
    )
    .all(mechanicId, jobDate);
  const intervals = rows.map((r) => [
    Math.max(openMin, timeToMinutes(r.start_time)),
    Math.min(closeMin, timeToMinutes(r.end_time)),
  ]);
  const busy = mergedMinutes(intervals);
  return Math.max(0, closeMin - openMin - busy);
}

// A job with a start time always gets an end time - defaulting to +1 hour
// keeps every scheduled job a draggable/resizable block on the diary grid.
function resolveJobTimes(startTime, endTimeInput) {
  if (!startTime) return { startTime: '', endTime: '' };
  if (!TIME_RE.test(startTime)) return { error: 'Start time must be in HH:MM format' };
  let endTime = endTimeInput;
  if (!endTime) endTime = addMinutesToTime(startTime, 60);
  if (!TIME_RE.test(endTime)) return { error: 'End time must be in HH:MM format' };
  if (endTime <= startTime) return { error: 'End time must be after start time' };
  return { startTime, endTime };
}

route('GET', '/api/workshop-jobs', async (req, res, params, query) => {
  const start = query.get('start');
  const end = query.get('end');
  let sql = WORKSHOP_JOB_SELECT + ' WHERE 1=1';
  const args = [];
  if (start) {
    sql += ' AND w.job_date >= ?';
    args.push(start);
  }
  if (end) {
    sql += ' AND w.job_date <= ?';
    args.push(end);
  }
  const status = query.get('status');
  if (status) {
    sql += ' AND w.status = ?';
    args.push(status);
  }
  sql += ' ORDER BY w.job_date, w.start_time';
  const rows = await db.prepare(sql).all(...args);
  sendJson(res, 200, rows.map(serializeWorkshopJob));
});

route('GET', '/api/workshop-jobs/:id', async (req, res, params) => {
  const id = Number(params.id);
  const row = await db.prepare(WORKSHOP_JOB_SELECT + ' WHERE w.id = ?').get(id);
  if (!row) return notFound(res, 'Job not found');
  sendJson(res, 200, serializeWorkshopJob(row));
});

// Shared by the staff "create job" route below and the customer portal's
// booking route (/api/portal/:shopSlug/bookings) - inserts the job plus its
// linked order in one transaction. Trusts every field completely; callers
// are responsible for validating/resolving them first (the portal route
// deliberately ignores anything the client sends for customerId/status and
// forces its own values, same principle as createSale() never trusting a
// client-sent total).
async function createWorkshopJob({ title, customerId, bikeId, mechanicId, jobDate, startTime, endTime, status, notes, skipAutoOrder }) {
  await db.exec('BEGIN');
  try {
    const info = await db
      .prepare(
        `INSERT INTO workshop_jobs (title, customer_id, bike_id, mechanic_id, job_date, start_time, end_time, status, notes, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(title, customerId, bikeId, mechanicId, jobDate, startTime, endTime, status, notes, nowIso());
    const jobId = info.lastInsertRowid;

    // Every workshop job is backed by an order so it's findable from the
    // Orders page, unless the caller already has an order it's about to link
    // this job to itself (the order's "show in workshop diary" toggle).
    if (!skipAutoOrder) {
      await db.prepare(
        `INSERT INTO sale_documents (kind, customer_id, subtotal, discount, total, note, title, workshop_job_id, updated_at)
         VALUES ('order', ?, 0, 0, 0, ?, ?, ?, ?)`
      ).run(customerId, notes, title, jobId, nowIso());
    }

    await db.exec('COMMIT');
    return jobId;
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
}

route('POST', '/api/workshop-jobs', async (req, res) => {
  const body = await readJsonBody(req);
  const title = (body.title || '').trim();
  if (!title) return badRequest(res, 'Job title is required');
  const jobDate = (body.jobDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jobDate)) return badRequest(res, 'A valid date is required');
  const notes = (body.notes || '').trim();

  const times = resolveJobTimes((body.startTime || '').trim(), (body.endTime || '').trim());
  if (times.error) return badRequest(res, times.error);

  const resolved = await resolveJobCustomerId(body.customerId, null);
  if (!resolved.ok) return badRequest(res, 'Customer not found or inactive');

  const bikeResolved = await resolveJobBikeId(body.bikeId, null, resolved.customerId);
  if (!bikeResolved.ok) return badRequest(res, bikeResolved.error);

  const mechResolved = await resolveJobMechanicId(body.mechanicId, null);
  if (!mechResolved.ok) return badRequest(res, 'Mechanic not found or inactive');

  const status = resolveJobStatus(body.status, null);
  if (status === null) return badRequest(res, `status must be one of: ${JOB_STATUSES.join(', ')}`);

  const jobId = await createWorkshopJob({
    title,
    customerId: resolved.customerId,
    bikeId: bikeResolved.bikeId,
    mechanicId: mechResolved.mechanicId,
    jobDate,
    startTime: times.startTime,
    endTime: times.endTime,
    status,
    notes,
    skipAutoOrder: !!body.skipAutoOrder,
  });
  const row = await db.prepare(WORKSHOP_JOB_SELECT + ' WHERE w.id = ?').get(jobId);
  sendJson(res, 201, serializeWorkshopJob(row));
});

route('PUT', '/api/workshop-jobs/:id', async (req, res, params) => {
  const id = Number(params.id);
  const existing = await db.prepare('SELECT * FROM workshop_jobs WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Job not found');
  const body = await readJsonBody(req);

  const title = body.title !== undefined ? String(body.title).trim() : existing.title;
  if (!title) return badRequest(res, 'Job title is required');
  const jobDate = body.jobDate !== undefined ? String(body.jobDate).trim() : existing.job_date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jobDate)) return badRequest(res, 'A valid date is required');
  const notes = body.notes !== undefined ? String(body.notes).trim() : existing.notes;

  const startTimeInput = body.startTime !== undefined ? String(body.startTime).trim() : existing.start_time;
  const endTimeInput = body.endTime !== undefined ? String(body.endTime).trim() : existing.end_time;
  const times = resolveJobTimes(startTimeInput, endTimeInput);
  if (times.error) return badRequest(res, times.error);

  const resolved = await resolveJobCustomerId(body.customerId, existing.customer_id);
  if (!resolved.ok) return badRequest(res, 'Customer not found or inactive');

  const bikeResolved = await resolveJobBikeId(body.bikeId, existing.bike_id, resolved.customerId);
  if (!bikeResolved.ok) return badRequest(res, bikeResolved.error);

  const mechResolved = await resolveJobMechanicId(body.mechanicId, existing.mechanic_id);
  if (!mechResolved.ok) return badRequest(res, 'Mechanic not found or inactive');

  const status = resolveJobStatus(body.status, existing.status);
  if (status === null) return badRequest(res, `status must be one of: ${JOB_STATUSES.join(', ')}`);

  await db.prepare(
    `UPDATE workshop_jobs SET title = ?, customer_id = ?, bike_id = ?, mechanic_id = ?, job_date = ?, start_time = ?, end_time = ?, status = ?, notes = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    title,
    resolved.customerId,
    bikeResolved.bikeId,
    mechResolved.mechanicId,
    jobDate,
    times.startTime,
    times.endTime,
    status,
    notes,
    nowIso(),
    id
  );
  const row = await db.prepare(WORKSHOP_JOB_SELECT + ' WHERE w.id = ?').get(id);
  sendJson(res, 200, serializeWorkshopJob(row));
});

route('DELETE', '/api/workshop-jobs/:id', async (req, res, params) => {
  const id = Number(params.id);
  const existing = await db.prepare('SELECT * FROM workshop_jobs WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Job not found');
  // The attachments row is ON DELETE CASCADE, but that only removes the DB
  // record - the file on disk needs its own cleanup or it just sits there
  // forever with nothing pointing at it.
  const attachments = await db.prepare('SELECT storage_key FROM workshop_job_attachments WHERE workshop_job_id = ?').all(id);
  await db.prepare('UPDATE sale_documents SET workshop_job_id = NULL WHERE workshop_job_id = ?').run(id);
  await db.prepare('DELETE FROM workshop_jobs WHERE id = ?').run(id);
  await Promise.all(attachments.map((a) => unlink(path.join(UPLOADS_DIR, a.storage_key)).catch(() => {})));
  sendJson(res, 200, { ok: true });
});

// ---------- Workshop job attachments ----------
// Files (e.g. an e-bike's downloaded diagnostic report) attached to a
// workshop job. Uploaded as base64 inside a normal JSON body rather than
// multipart/form-data - this project deliberately has exactly one
// dependency (pg), and a hand-rolled multipart parser is a lot of surface
// area for something that's rare and small (a PDF report, not a video) for
// a single shop's workshop.

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // plenty for a PDF report; small enough a handful of them won't fill the disk
// Base64 inflates the raw bytes by ~1.37x, so the request-body cap needs
// headroom above the decoded-file cap it's ultimately enforcing.
const MAX_ATTACHMENT_BODY_BYTES = Math.ceil(MAX_ATTACHMENT_BYTES * 1.4);

function serializeAttachment(row) {
  return {
    id: row.id,
    workshopJobId: row.workshop_job_id,
    originalName: row.original_name,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    uploadedAt: row.uploaded_at,
  };
}

route('GET', '/api/workshop-jobs/:jobId/attachments', async (req, res, params) => {
  const jobId = Number(params.jobId);
  const job = await db.prepare('SELECT id FROM workshop_jobs WHERE id = ?').get(jobId);
  if (!job) return notFound(res, 'Job not found');
  const rows = await db
    .prepare('SELECT * FROM workshop_job_attachments WHERE workshop_job_id = ? ORDER BY uploaded_at DESC')
    .all(jobId);
  sendJson(res, 200, rows.map(serializeAttachment));
});

route('POST', '/api/workshop-jobs/:jobId/attachments', async (req, res, params) => {
  const jobId = Number(params.jobId);
  const job = await db.prepare('SELECT id FROM workshop_jobs WHERE id = ?').get(jobId);
  if (!job) return notFound(res, 'Job not found');

  let body;
  try {
    body = await readJsonBody(req, MAX_ATTACHMENT_BODY_BYTES);
  } catch (err) {
    return badRequest(res, err.message === 'Payload too large' ? 'That file is too large (max 15MB).' : 'Invalid request body');
  }
  if (!body.dataBase64) return badRequest(res, 'No file data received');
  const originalName = String(body.filename || 'attachment').trim().slice(0, 200) || 'attachment';
  const contentType = String(body.contentType || 'application/octet-stream').trim().slice(0, 100);

  let buffer;
  try {
    buffer = Buffer.from(body.dataBase64, 'base64');
  } catch (err) {
    return badRequest(res, 'Could not decode file data');
  }
  if (!buffer.length) return badRequest(res, 'That file is empty');
  if (buffer.length > MAX_ATTACHMENT_BYTES) return badRequest(res, 'That file is too large (max 15MB).');

  const storageKey = randomBytes(24).toString('hex');
  await writeFile(path.join(UPLOADS_DIR, storageKey), buffer);
  const info = await db
    .prepare(
      `INSERT INTO workshop_job_attachments (workshop_job_id, storage_key, original_name, content_type, size_bytes)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(jobId, storageKey, originalName, contentType, buffer.length);
  const row = await db.prepare('SELECT * FROM workshop_job_attachments WHERE id = ?').get(info.lastInsertRowid);
  sendJson(res, 201, serializeAttachment(row));
});

route('GET', '/api/workshop-jobs/:jobId/attachments/:id', async (req, res, params) => {
  const attachment = await db
    .prepare('SELECT * FROM workshop_job_attachments WHERE id = ? AND workshop_job_id = ?')
    .get(Number(params.id), Number(params.jobId));
  if (!attachment) return notFound(res, 'Attachment not found');
  const filePath = path.join(UPLOADS_DIR, attachment.storage_key);
  if (!existsSync(filePath)) return notFound(res, 'Attachment not found');
  // RFC 5987 filename* carries the real (possibly non-ASCII) name; the
  // plain filename= is a plain-ASCII fallback for older clients, with
  // anything that would break the quoted string stripped out.
  const asciiFallback = attachment.original_name.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");
  res.writeHead(200, {
    'Content-Type': attachment.content_type || 'application/octet-stream',
    'Content-Length': attachment.size_bytes,
    'Content-Disposition': `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(attachment.original_name)}`,
    'Cache-Control': 'no-store',
  });
  createReadStream(filePath).pipe(res);
});

route('DELETE', '/api/workshop-jobs/:jobId/attachments/:id', async (req, res, params) => {
  const attachment = await db
    .prepare('SELECT * FROM workshop_job_attachments WHERE id = ? AND workshop_job_id = ?')
    .get(Number(params.id), Number(params.jobId));
  if (!attachment) return notFound(res, 'Attachment not found');
  await db.prepare('DELETE FROM workshop_job_attachments WHERE id = ?').run(attachment.id);
  await unlink(path.join(UPLOADS_DIR, attachment.storage_key)).catch(() => {});
  sendJson(res, 200, { ok: true });
});

// ---------- Image uploads (product photos, shop logo, shop hero image) ----------
// Same base64-in-a-JSON-body convention as workshop job attachments above,
// and the same opaque-storage_key-on-disk approach - but the uploader can be
// any of three different call sites (a product photo, the storefront logo,
// or its hero image), so the actual read/validate/store logic lives in one
// shared helper and each route just says what changed after the upload.

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Shared by product photo, logo, and hero image uploads - only the size
// cap and what happens with the resulting URL differ between them.
async function readUploadedImage(req, maxBytes) {
  const maxBodyBytes = Math.ceil(maxBytes * 1.4);
  let body;
  try {
    body = await readJsonBody(req, maxBodyBytes);
  } catch (err) {
    throw new ValidationError(err.message === 'Payload too large' ? `That image is too large (max ${Math.round(maxBytes / 1024 / 1024)}MB).` : 'Invalid request body');
  }
  if (!body.dataBase64) throw new ValidationError('No image data received');

  const contentType = String(body.contentType || '').trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new ValidationError('Image must be JPEG, PNG, or WebP');
  }

  let buffer;
  try {
    buffer = Buffer.from(body.dataBase64, 'base64');
  } catch (err) {
    throw new ValidationError('Could not decode image data');
  }
  if (!buffer.length) throw new ValidationError('That image is empty');
  if (buffer.length > maxBytes) throw new ValidationError(`That image is too large (max ${Math.round(maxBytes / 1024 / 1024)}MB).`);

  const storageKey = randomBytes(24).toString('hex');
  await writeFile(path.join(UPLOADS_DIR, storageKey), buffer);
  // uploaded_image_types has no `id` column (storage_key is its primary
  // key), so this INSERT carries its own RETURNING clause - otherwise
  // db.js's prepare() would auto-append `RETURNING id` (see needsReturningId
  // there) and the query would fail with "column \"id\" does not exist".
  await db.prepare('INSERT INTO uploaded_image_types (storage_key, content_type) VALUES (?, ?) RETURNING storage_key').run(storageKey, contentType);
  return `/api/uploaded-images/${storageKey}`;
}

const MAX_PRODUCT_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_SHOP_IMAGE_BYTES = 5 * 1024 * 1024;

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

route('POST', '/api/storefront-settings/logo', async (req, res) => {
  let logoUrl;
  try {
    logoUrl = await readUploadedImage(req, MAX_SHOP_IMAGE_BYTES);
  } catch (err) {
    if (err instanceof ValidationError) return badRequest(res, err.message);
    throw err;
  }
  sendJson(res, 200, serializeStorefrontSettings(await updateStorefrontSettings({ logoUrl })));
});

route('POST', '/api/storefront-settings/hero', async (req, res) => {
  let heroImageUrl;
  try {
    heroImageUrl = await readUploadedImage(req, MAX_SHOP_IMAGE_BYTES);
  } catch (err) {
    if (err instanceof ValidationError) return badRequest(res, err.message);
    throw err;
  }
  sendJson(res, 200, serializeStorefrontSettings(await updateStorefrontSettings({ heroImageUrl })));
});

// Deliberately NOT registered via route() into the shared routes table -
// every route reached that way requires a signed-in staff session (see the
// dispatcher below), but these images (product photos, shop logo, hero
// image) need to be viewable by anonymous public-storefront visitors whose
// <img> tags carry no session cookie at all. It's served from its own
// unauthenticated branch in the dispatcher instead. Safe to leave
// unauthenticated: the storage key is a randomBytes(24) hex token (192 bits
// of entropy) - unguessable, so knowing it is the only "access control" an
// image URL like this needs, the same way most image/CDN URLs work.
async function serveUploadedImage(req, res, key) {
  const filePath = path.join(UPLOADS_DIR, key);
  if (!filePath.startsWith(UPLOADS_DIR) || !existsSync(filePath)) {
    return notFound(res, 'Image not found');
  }
  const typeRow = await pool.query('SELECT content_type FROM uploaded_image_types WHERE storage_key = $1', [key]);
  const contentType = typeRow.rows[0]?.content_type || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' });
  createReadStream(filePath).pipe(res);
}

// ---------- Employees ----------
// A single roster shared by the Workshop (mechanics) and Front Desk
// (cashiers): every mechanic is an employee, but not every employee is a
// mechanic (or a cashier) - isMechanic/isCashier are independent flags on
// the same person.

function parseWorkingDays(raw) {
  try {
    const days = JSON.parse(raw);
    if (Array.isArray(days)) return days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  } catch (_) {
    // fall through to default
  }
  return [0, 1, 2, 3, 4, 5, 6];
}

function serializeEmployee(row) {
  return {
    id: row.id,
    name: row.name,
    isMechanic: !!row.is_mechanic,
    isCashier: !!row.is_cashier,
    workingDays: parseWorkingDays(row.working_days),
    active: !!row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function resolveWorkingDays(rawDays, existingRaw) {
  if (rawDays === undefined) return existingRaw !== undefined ? existingRaw : '[0,1,2,3,4,5,6]';
  if (!Array.isArray(rawDays)) return null;
  const days = [...new Set(rawDays.map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  return JSON.stringify(days.sort((a, b) => a - b));
}

route('GET', '/api/employees', async (req, res, params, query) => {
  let sql = 'SELECT * FROM employees WHERE 1=1';
  const args = [];
  if (query.get('all') !== '1') sql += ' AND active = 1';
  const role = query.get('role');
  if (role === 'mechanic') sql += ' AND is_mechanic = 1';
  else if (role === 'cashier') sql += ' AND is_cashier = 1';
  sql += ' ORDER BY name';
  const rows = await db.prepare(sql).all(...args);
  sendJson(res, 200, rows.map(serializeEmployee));
});

route('POST', '/api/employees', async (req, res) => {
  const body = await readJsonBody(req);
  const name = (body.name || '').trim();
  if (!name) return badRequest(res, 'Employee name is required');
  const isMechanic = body.isMechanic ? 1 : 0;
  const isCashier = body.isCashier ? 1 : 0;
  const workingDays = resolveWorkingDays(body.workingDays, undefined);
  if (workingDays === null) return badRequest(res, 'workingDays must be an array of day numbers (0-6)');
  const info = await db
    .prepare('INSERT INTO employees (name, is_mechanic, is_cashier, working_days, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(name, isMechanic, isCashier, workingDays, nowIso());
  const row = await db.prepare('SELECT * FROM employees WHERE id = ?').get(info.lastInsertRowid);
  sendJson(res, 201, serializeEmployee(row));
});

route('PUT', '/api/employees/:id', async (req, res, params) => {
  const id = Number(params.id);
  const existing = await db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Employee not found');
  const body = await readJsonBody(req);
  const name = body.name !== undefined ? String(body.name).trim() : existing.name;
  if (!name) return badRequest(res, 'Employee name is required');
  const active = body.active !== undefined ? (body.active ? 1 : 0) : existing.active;
  const isMechanic = body.isMechanic !== undefined ? (body.isMechanic ? 1 : 0) : existing.is_mechanic;
  const isCashier = body.isCashier !== undefined ? (body.isCashier ? 1 : 0) : existing.is_cashier;
  const workingDays = resolveWorkingDays(body.workingDays, existing.working_days);
  if (workingDays === null) return badRequest(res, 'workingDays must be an array of day numbers (0-6)');
  await db.prepare(
    'UPDATE employees SET name = ?, is_mechanic = ?, is_cashier = ?, working_days = ?, active = ?, updated_at = ? WHERE id = ?'
  ).run(name, isMechanic, isCashier, workingDays, active, nowIso(), id);
  const row = await db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  sendJson(res, 200, serializeEmployee(row));
});

route('DELETE', '/api/employees/:id', async (req, res, params) => {
  const id = Number(params.id);
  const existing = await db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Employee not found');
  await db.prepare('UPDATE employees SET active = 0, updated_at = ? WHERE id = ?').run(nowIso(), id);
  sendJson(res, 200, { ok: true });
});

// Permanently removes the employee row itself (as opposed to the soft
// deactivate above). Workshop jobs and sales/orders already tied to them are
// unassigned rather than deleted or blocked by the foreign key, consistent
// with how removing a customer/bike/product never destroys sale/job history.
route('DELETE', '/api/employees/:id/permanent', async (req, res, params) => {
  const id = Number(params.id);
  const existing = await db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Employee not found');
  await db.prepare('UPDATE workshop_jobs SET mechanic_id = NULL WHERE mechanic_id = ?').run(id);
  await db.prepare('UPDATE sales SET cashier_id = NULL WHERE cashier_id = ?').run(id);
  await db.prepare('UPDATE sale_documents SET cashier_id = NULL WHERE cashier_id = ?').run(id);
  await db.prepare('DELETE FROM employees WHERE id = ?').run(id);
  sendJson(res, 200, { ok: true });
});

// ---------- Workshop settings ----------

function serializeWorkshopSettings(row) {
  return {
    openingTime: row.opening_time,
    closingTime: row.closing_time,
    openingDays: parseWorkingDays(row.opening_days),
    fullDayThresholdMinutes: row.full_day_threshold_minutes,
    updatedAt: row.updated_at,
  };
}

const HOUR_RE = /^([01]\d|2[0-3]):00$/;

// One row per shop (RLS scopes it), rather than the old global single-row
// (id=1) singleton - a shop's id is assigned by Postgres, not fixed at 1, so
// lookups just take whichever single row RLS makes visible.
route('GET', '/api/workshop-settings', async (req, res) => {
  const row = await db.prepare('SELECT * FROM workshop_settings LIMIT 1').get();
  sendJson(res, 200, serializeWorkshopSettings(row));
});

route('PUT', '/api/workshop-settings', async (req, res) => {
  const existing = await db.prepare('SELECT * FROM workshop_settings LIMIT 1').get();
  const body = await readJsonBody(req);
  const openingTime = body.openingTime !== undefined ? String(body.openingTime).trim() : existing.opening_time;
  const closingTime = body.closingTime !== undefined ? String(body.closingTime).trim() : existing.closing_time;
  if (!HOUR_RE.test(openingTime) || !HOUR_RE.test(closingTime)) {
    return badRequest(res, 'Opening and closing times must be on the hour (e.g. 09:00)');
  }
  if (closingTime <= openingTime) return badRequest(res, 'Closing time must be after opening time');
  const openingDays = resolveWorkingDays(body.openingDays, existing.opening_days);
  if (openingDays === null) return badRequest(res, 'openingDays must be an array of day numbers (0-6)');
  let fullDayThresholdMinutes = existing.full_day_threshold_minutes;
  if (body.fullDayThresholdMinutes !== undefined) {
    fullDayThresholdMinutes = Number(body.fullDayThresholdMinutes);
    if (!Number.isInteger(fullDayThresholdMinutes) || fullDayThresholdMinutes < 0 || fullDayThresholdMinutes > 480) {
      return badRequest(res, 'The full-day threshold must be a whole number of minutes between 0 and 480');
    }
  }
  await db.prepare(
    'UPDATE workshop_settings SET opening_time = ?, closing_time = ?, opening_days = ?, full_day_threshold_minutes = ?, updated_at = ? WHERE id = ?'
  ).run(openingTime, closingTime, openingDays, fullDayThresholdMinutes, nowIso(), existing.id);
  const row = await db.prepare('SELECT * FROM workshop_settings LIMIT 1').get();
  sendJson(res, 200, serializeWorkshopSettings(row));
});

// ---------- Label (sticker printing) settings ----------
// The physical size of the label roll a shop's dedicated label printer
// takes. One row per shop, same singleton-per-shop pattern as
// workshop_settings; createShop() seeds a default row for new shops, but a
// shop created before this table existed won't have one - GET creates it
// lazily on first touch rather than needing a migration-time backfill
// (which would fight RLS, since a migration runs with no shop context set).

function serializeLabelSettings(row) {
  return { widthMm: Number(row.width_mm), heightMm: Number(row.height_mm), updatedAt: row.updated_at };
}

async function getOrCreateLabelSettings() {
  let row = await db.prepare('SELECT * FROM label_settings LIMIT 1').get();
  if (!row) {
    await db.prepare('INSERT INTO label_settings DEFAULT VALUES').run();
    row = await db.prepare('SELECT * FROM label_settings LIMIT 1').get();
  }
  return row;
}

route('GET', '/api/label-settings', async (req, res) => {
  sendJson(res, 200, serializeLabelSettings(await getOrCreateLabelSettings()));
});

route('PUT', '/api/label-settings', async (req, res) => {
  const existing = await getOrCreateLabelSettings();
  const body = await readJsonBody(req);
  const widthMm = body.widthMm !== undefined ? Number(body.widthMm) : Number(existing.width_mm);
  const heightMm = body.heightMm !== undefined ? Number(body.heightMm) : Number(existing.height_mm);
  if (!Number.isFinite(widthMm) || widthMm < 10 || widthMm > 150 || !Number.isFinite(heightMm) || heightMm < 10 || heightMm > 150) {
    return badRequest(res, 'Label width and height must both be between 10mm and 150mm');
  }
  await db.prepare('UPDATE label_settings SET width_mm = ?, height_mm = ?, updated_at = ? WHERE id = ?').run(
    widthMm,
    heightMm,
    nowIso(),
    existing.id
  );
  sendJson(res, 200, serializeLabelSettings(await db.prepare('SELECT * FROM label_settings LIMIT 1').get()));
});

// ---------- Shop colour scheme ----------
// Which preset a shop has chosen (see public/app.js's THEME_PRESETS for what
// each key actually renders as - only the key is stored server-side). Same
// singleton-per-shop, lazy-create-on-GET pattern as label_settings above.

const SHOP_THEME_PRESETS = ['forest', 'ocean', 'sunset', 'slate', 'plum'];

function serializeShopTheme(row) {
  return { preset: row.preset, updatedAt: row.updated_at };
}

async function getOrCreateShopTheme() {
  let row = await db.prepare('SELECT * FROM shop_theme LIMIT 1').get();
  if (!row) {
    await db.prepare('INSERT INTO shop_theme DEFAULT VALUES').run();
    row = await db.prepare('SELECT * FROM shop_theme LIMIT 1').get();
  }
  return row;
}

route('GET', '/api/shop-theme', async (req, res) => {
  sendJson(res, 200, serializeShopTheme(await getOrCreateShopTheme()));
});

route('PUT', '/api/shop-theme', async (req, res) => {
  const existing = await getOrCreateShopTheme();
  const body = await readJsonBody(req);
  const preset = String(body.preset || '');
  if (!SHOP_THEME_PRESETS.includes(preset)) {
    return badRequest(res, `preset must be one of: ${SHOP_THEME_PRESETS.join(', ')}`);
  }
  await db.prepare('UPDATE shop_theme SET preset = ?, updated_at = ? WHERE id = ?').run(preset, nowIso(), existing.id);
  sendJson(res, 200, serializeShopTheme(await db.prepare('SELECT * FROM shop_theme LIMIT 1').get()));
});

// ---------- Storefront settings ----------
// Public-storefront on/off switch plus its branding fields (tagline,
// description, logo/hero images, theme preset) - same singleton-per-shop,
// lazy-create-on-GET pattern as shop_theme above. Persistence and validation
// live in storefront.js (Task 3); these two routes are thin HTTP glue over
// it, same shape as the shop-theme pair above.

route('GET', '/api/storefront-settings', async (req, res) => {
  sendJson(res, 200, serializeStorefrontSettings(await getOrCreateStorefrontSettings()));
});

route('PUT', '/api/storefront-settings', async (req, res) => {
  const body = await readJsonBody(req);
  try {
    const updated = await updateStorefrontSettings(body);
    sendJson(res, 200, serializeStorefrontSettings(updated));
  } catch (err) {
    if (err.message.startsWith('Invalid theme preset')) return badRequest(res, err.message);
    throw err;
  }
});

// ---------- Shopify connection ----------
// Per-shop connection to a Shopify store via a custom-app Admin API token
// (Task 3, shopify.js). These two routes are thin HTTP glue over
// getShopifyConnection/saveShopifyConnection - same shape as the
// storefront-settings pair above.

route('GET', '/api/shopify/connection', async (req, res) => {
  sendJson(res, 200, serializeShopifyConnection(await getShopifyConnection()));
});

route('POST', '/api/shopify/connection', async (req, res) => {
  const body = await readJsonBody(req);
  const shopDomain = String(body.shopDomain || '').trim();
  const accessToken = String(body.accessToken || '').trim();
  const storefrontApiToken = String(body.storefrontApiToken || '').trim();
  if (!shopDomain || !accessToken || !storefrontApiToken) {
    return badRequest(res, 'shopDomain, accessToken, and storefrontApiToken are all required');
  }

  let connection;
  try {
    connection = await saveShopifyConnection({ shopDomain, accessToken, storefrontApiToken });
  } catch (err) {
    return badRequest(res, `Could not connect to Shopify: ${err.message}`);
  }

  try {
    await registerShopifyWebhooks(connection, connection.shop_id);
  } catch (err) {
    console.error('Failed to register Shopify webhooks', err);
    return sendJson(res, 200, {
      ...serializeShopifyConnection(connection),
      warning: 'Connected, but webhook registration failed - online orders will not sync back to stock until this is retried.',
    });
  }

  sendJson(res, 200, serializeShopifyConnection(connection));
});

// ---------- Print agents ----------
// Relays sticker print jobs from a browser tab to a print-agent process
// (print-agent/agent.js) running on any shop PC - possibly a different one
// than whichever machine the browser is on, so a printer physically wired
// to a stockroom PC can be reached from the till's browser too. Which
// devices are currently online and what's queued for each is inherently
// live/ephemeral state, not history worth a table for - an agent
// re-registers within one check-in interval of a server restart anyway, so
// this is plain in-memory state, keyed by shop id. Fine for this app's
// single-process deployment (see docker-compose.yml - one `app` service,
// no horizontal scaling to worry about).
//
// Every route here re-resolves the session itself via currentSession(req)
// (the same thing the dispatcher already calls before runWithShop) to get
// the shop id these maps are keyed by - the same pattern the customer
// portal's routes already use to get their own shop context inside a
// handler.

const printAgentsByShop = new Map(); // shopId -> Map<deviceId, {deviceName, printers, lastSeen}>
const printJobsByDevice = new Map(); // deviceId -> pending job array
const printJobStatus = new Map(); // jobId -> {status, error} - not surfaced in the UI yet, kept for a future job-history view
const PRINT_AGENT_STALE_MS = 25000; // ~2-3 missed check-ins before a device drops off the list

function liveAgentsForShop(shopId) {
  const byDevice = printAgentsByShop.get(shopId);
  if (!byDevice) return [];
  const now = Date.now();
  const live = [];
  for (const [deviceId, info] of byDevice) {
    if (now - info.lastSeen > PRINT_AGENT_STALE_MS) {
      byDevice.delete(deviceId);
      continue;
    }
    live.push({ deviceId, deviceName: info.deviceName, printers: info.printers });
  }
  return live;
}

route('POST', '/api/print-agents/checkin', async (req, res) => {
  const ctx = await currentSession(req);
  if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
  const body = await readJsonBody(req);
  const deviceId = String(body.deviceId || '').trim();
  if (!deviceId) return badRequest(res, 'deviceId is required');
  const deviceName = String(body.deviceName || deviceId).trim().slice(0, 100) || deviceId;
  const printers = Array.isArray(body.printers) ? body.printers.filter((p) => typeof p === 'string' && p).slice(0, 50) : [];

  if (!printAgentsByShop.has(ctx.shop.id)) printAgentsByShop.set(ctx.shop.id, new Map());
  printAgentsByShop.get(ctx.shop.id).set(deviceId, { deviceName, printers, lastSeen: Date.now() });

  const jobs = printJobsByDevice.get(deviceId) || [];
  printJobsByDevice.set(deviceId, []);
  sendJson(res, 200, { jobs });
});

// What the sticker-print modal's printer dropdown reads.
route('GET', '/api/print-agents', async (req, res) => {
  const ctx = await currentSession(req);
  if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
  sendJson(res, 200, { agents: liveAgentsForShop(ctx.shop.id) });
});

route('POST', '/api/print-agents/:deviceId/jobs', async (req, res, params) => {
  const ctx = await currentSession(req);
  if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
  // Only ever queue a job for a device this shop can currently see - stops
  // a stale or guessed deviceId (or one belonging to a different shop, by
  // construction, since it just wouldn't appear here) from ever receiving
  // a job.
  const known = liveAgentsForShop(ctx.shop.id).find((a) => a.deviceId === params.deviceId);
  if (!known) return badRequest(res, 'That device is not currently online for this shop');
  const body = await readJsonBody(req);
  const { printerName, widthMm, heightMm, pages } = body;
  if (!printerName || !known.printers.includes(printerName)) return badRequest(res, 'Unknown printer for that device');
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm)) return badRequest(res, 'A valid label width and height are required');
  if (!Array.isArray(pages) || !pages.length) return badRequest(res, 'At least one label page is required');

  const jobId = randomBytes(8).toString('hex');
  if (!printJobsByDevice.has(params.deviceId)) printJobsByDevice.set(params.deviceId, []);
  printJobsByDevice.get(params.deviceId).push({ jobId, printerName, widthMm, heightMm, pages });
  printJobStatus.set(jobId, { status: 'queued' });
  sendJson(res, 201, { jobId });
});

route('POST', '/api/print-agents/jobs/:jobId/complete', async (req, res, params) => {
  const ctx = await currentSession(req);
  if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
  const body = await readJsonBody(req);
  printJobStatus.set(params.jobId, { status: body.ok ? 'done' : 'error', error: body.error });
  if (!body.ok) console.error(`Print job ${params.jobId} failed: ${body.error}`);
  sendJson(res, 200, { ok: true });
});

// ---------- Dashboard ----------

route('GET', '/api/dashboard', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const todayAgg = await db
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS total
       FROM sales WHERE created_at >= ?::date AND created_at < ?::date + interval '1 day'`
    )
    .get(today, today);

  const lowStock = (await db
    .prepare(
      `SELECT * FROM products WHERE active = 1 AND low_stock_threshold > 0 AND stock_qty <= low_stock_threshold
       ORDER BY stock_qty ASC`
    )
    .all())
    .map(serializeProduct);

  const topToday = await db
    .prepare(
      `SELECT si.name, SUM(si.qty) AS qty, SUM(si.line_total) AS revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.created_at >= ?::date AND s.created_at < ?::date + interval '1 day'
       GROUP BY si.name
       ORDER BY revenue DESC
       LIMIT 5`
    )
    .all(today, today);

  sendJson(res, 200, {
    todayCount: todayAgg.count,
    todayTotal: todayAgg.total,
    lowStock,
    topToday,
  });
});

// ---------- Customer portal ----------
// A second, public-facing surface (see public-portal/) for customers to
// book their own workshop slots. Its auth is entirely separate from staff
// auth (see server/customer-auth.js) - signup/login/logout manage their own
// shop resolution and session, same as /api/auth/* does for staff, and
// never touch RLS-protected tables directly. Every other /api/portal/*
// route needs the shop's RLS context (resolved from the :shopSlug in the
// URL, see the dispatcher below) to read/write customers/employees/
// workshop_jobs/etc through the normal db.prepare(...) shim.

route('POST', '/api/portal/:shopSlug/signup', async (req, res, params) => {
  const ip = clientIp(req);
  if (!portalSignupLimiter.check(ip)) {
    return sendJson(res, 429, { error: 'Too many accounts created from this network - please try again later.' });
  }
  const body = await readJsonBody(req);
  let created;
  try {
    created = await signupCustomer({ shopSlug: params.shopSlug, email: body.email, password: body.password, name: body.name });
  } catch (err) {
    if (err instanceof CustomerAuthError) return badRequest(res, err.message);
    throw err;
  }
  const token = await createCustomerSession(created.login.id);
  setCustomerSessionCookie(req, res, token);
  sendJson(res, 201, {
    id: created.login.id,
    email: created.login.email,
    name: created.customer.name,
    shopName: created.shop.name,
    shopSlug: created.shop.slug,
  });
});

route('POST', '/api/portal/:shopSlug/login', async (req, res, params) => {
  const ip = clientIp(req);
  if (!portalLoginLimiter.check(ip)) {
    return sendJson(res, 429, { error: 'Too many login attempts - please wait a few minutes and try again.' });
  }
  const body = await readJsonBody(req);
  let login;
  try {
    login = await verifyCustomerLogin(params.shopSlug, body.email, body.password);
  } catch (err) {
    if (err instanceof CustomerAuthError) return sendJson(res, 401, { error: err.message });
    throw err;
  }
  portalLoginLimiter.reset(ip);
  const token = await createCustomerSession(login.id);
  setCustomerSessionCookie(req, res, token);
  sendJson(res, 200, serializeCustomerLogin(login));
});

route('POST', '/api/portal/:shopSlug/logout', async (req, res) => {
  const { [CUSTOMER_SESSION_COOKIE]: token } = parseCookies(req);
  await destroyCustomerSession(token);
  clearCustomerSessionCookie(res);
  sendJson(res, 200, { ok: true });
});

route('GET', '/api/portal/:shopSlug/me', async (req, res, params) => {
  const ctx = await currentCustomerSession(req);
  if (!ctx || ctx.shop.slug !== params.shopSlug) return sendJson(res, 401, { error: 'Not signed in' });
  const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(ctx.login.customer_id);
  sendJson(res, 200, {
    id: ctx.login.id,
    email: ctx.login.email,
    name: customer ? customer.name : '',
    shopName: ctx.shop.name,
    shopSlug: ctx.shop.slug,
  });
});

// A rough first pass at "jobs take different amounts of time" - the
// customer picks the closest job type rather than typing a duration, and
// the server (not the client) decides what that maps to in minutes. Not
// meant to be the final word on estimating job length, just enough that a
// general service doesn't eat the same single slot as a brake adjustment.
const PORTAL_JOB_TYPES = {
  quick: { label: 'Quick fix (puncture, brake or gear adjustment)', minutes: 30 },
  repair: { label: 'Repair (part replacement, wheel truing, etc.)', minutes: 60 },
  service: { label: 'General service (full safety check & tune)', minutes: 120 },
};

// Public - no login required to see what's open, only to actually book.
route('GET', '/api/portal/:shopSlug/mechanics', async (req, res) => {
  const mechanics = await db
    .prepare('SELECT id, name, working_days FROM employees WHERE is_mechanic = 1 AND active = 1 ORDER BY name')
    .all();
  const settings = await db.prepare('SELECT * FROM workshop_settings LIMIT 1').get();
  sendJson(res, 200, {
    mechanics: mechanics.map((m) => ({ id: m.id, name: m.name, workingDays: parseWorkingDays(m.working_days) })),
    openingTime: settings.opening_time,
    closingTime: settings.closing_time,
    openingDays: parseWorkingDays(settings.opening_days),
    jobTypes: Object.entries(PORTAL_JOB_TYPES).map(([value, t]) => ({ value, label: t.label, minutes: t.minutes })),
  });
});

// Public. Returns only mechanic/date/time for whatever's already booked -
// deliberately never reuses serializeWorkshopJob (title/customer/notes),
// since that's exactly the private detail this endpoint must not leak.
// Every job counts as busy regardless of status, including 'pending', so
// two customers can't unknowingly grab the same slot.
route('GET', '/api/portal/:shopSlug/availability', async (req, res, params, query) => {
  const start = query.get('start');
  const end = query.get('end');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '') || !/^\d{4}-\d{2}-\d{2}$/.test(end || '')) {
    return badRequest(res, 'Valid start and end dates are required');
  }
  let sql = `SELECT mechanic_id, job_date, start_time, end_time FROM workshop_jobs
    WHERE job_date >= ? AND job_date <= ? AND start_time IS NOT NULL AND start_time != ''`;
  const args = [start, end];
  const mechanicId = query.get('mechanicId');
  if (mechanicId) {
    sql += ' AND mechanic_id = ?';
    args.push(Number(mechanicId));
  }
  sql += ' ORDER BY job_date, start_time';
  const rows = await db.prepare(sql).all(...args);

  // Alongside the raw busy blocks, work out which mechanic/day combinations
  // already have less than workshop_settings.full_day_threshold_minutes of
  // genuinely free time left (small gaps between jobs merged, not summed
  // twice) - the portal treats those the same as a closed day, even though
  // technically-free slivers of time remain here and there.
  const settings = await db.prepare('SELECT * FROM workshop_settings LIMIT 1').get();
  const openMin = timeToMinutes(settings.opening_time);
  const closeMin = timeToMinutes(settings.closing_time);
  const workingMinutes = closeMin - openMin;
  const byMechanicDay = new Map();
  for (const r of rows) {
    const key = `${r.mechanic_id}|${r.job_date}`;
    if (!byMechanicDay.has(key)) byMechanicDay.set(key, { mechanicId: r.mechanic_id, jobDate: r.job_date, intervals: [] });
    byMechanicDay.get(key).intervals.push([
      Math.max(openMin, timeToMinutes(r.start_time)),
      Math.min(closeMin, timeToMinutes(r.end_time)),
    ]);
  }
  const fullDays = [];
  for (const { mechanicId: mId, jobDate, intervals } of byMechanicDay.values()) {
    const free = workingMinutes - mergedMinutes(intervals);
    if (free < settings.full_day_threshold_minutes) fullDays.push({ mechanicId: mId, jobDate });
  }

  sendJson(res, 200, {
    busy: rows.map((r) => ({ mechanicId: r.mechanic_id, jobDate: r.job_date, startTime: r.start_time, endTime: r.end_time })),
    fullDays,
  });
});

route('GET', '/api/portal/:shopSlug/bikes', async (req, res, params) => {
  const ctx = await currentCustomerSession(req);
  if (!ctx || ctx.shop.slug !== params.shopSlug) return sendJson(res, 401, { error: 'Not signed in' });
  const rows = await db
    .prepare('SELECT * FROM customer_bikes WHERE customer_id = ? AND active = 1 ORDER BY make, model')
    .all(ctx.login.customer_id);
  sendJson(res, 200, rows.map(serializeBike));
});

route('POST', '/api/portal/:shopSlug/bikes', async (req, res, params) => {
  const ctx = await currentCustomerSession(req);
  if (!ctx || ctx.shop.slug !== params.shopSlug) return sendJson(res, 401, { error: 'Not signed in' });
  const body = await readJsonBody(req);
  const make = (body.make || '').trim();
  const model = (body.model || '').trim();
  if (!make && !model) return badRequest(res, 'Make or model is required');
  const info = await db
    .prepare(
      `INSERT INTO customer_bikes (customer_id, make, model, colour, serial_number, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(ctx.login.customer_id, make, model, (body.colour || '').trim(), (body.serialNumber || '').trim(), nowIso());
  const row = await db.prepare('SELECT * FROM customer_bikes WHERE id = ?').get(info.lastInsertRowid);
  sendJson(res, 201, serializeBike(row));
});

route('GET', '/api/portal/:shopSlug/bookings', async (req, res, params) => {
  const ctx = await currentCustomerSession(req);
  if (!ctx || ctx.shop.slug !== params.shopSlug) return sendJson(res, 401, { error: 'Not signed in' });
  const rows = await db
    .prepare(WORKSHOP_JOB_SELECT + ' WHERE w.customer_id = ? ORDER BY w.job_date DESC, w.start_time DESC')
    .all(ctx.login.customer_id);
  sendJson(res, 200, rows.map((r) => serializeWorkshopJob(r)));
});

route('POST', '/api/portal/:shopSlug/bookings', async (req, res, params) => {
  const ctx = await currentCustomerSession(req);
  if (!ctx || ctx.shop.slug !== params.shopSlug) return sendJson(res, 401, { error: 'Not signed in' });
  const body = await readJsonBody(req);

  const jobDate = (body.jobDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jobDate)) return badRequest(res, 'A valid date is required');
  const description = (body.description || '').trim();
  if (!description) return badRequest(res, 'Please describe what you need done');

  const jobType = PORTAL_JOB_TYPES[body.jobType];
  if (!jobType) return badRequest(res, 'Please choose the kind of job this is');

  const startTime = (body.startTime || '').trim();
  const times = resolveJobTimes(startTime, startTime ? addMinutesToTime(startTime, jobType.minutes) : '');
  if (!times.startTime) return badRequest(res, 'A start time is required');
  if (times.error) return badRequest(res, times.error);

  const mechResolved = await resolveJobMechanicId(body.mechanicId, null);
  if (!mechResolved.ok || !mechResolved.mechanicId) return badRequest(res, 'Please choose a mechanic');

  // The grid only ever showed a fixed 60-minute proxy as "free" - the real
  // length depends on the job type chosen in this same request, so a
  // "service" (120 min) booked into what looked like an open slot could
  // actually run past closing or straight into another job. Check both
  // here, authoritatively, rather than trusting whatever the client showed.
  const settings = await db.prepare('SELECT * FROM workshop_settings LIMIT 1').get();

  // Even if this specific slot would technically fit, the shop may already
  // consider the day full once too little free time is left overall (e.g.
  // several small gaps between jobs adding up under the threshold) -
  // checked as a coarser gate before the exact-slot checks below.
  const freeMinutes = await mechanicFreeMinutes(mechResolved.mechanicId, jobDate, settings.opening_time, settings.closing_time);
  if (freeMinutes < settings.full_day_threshold_minutes) {
    return badRequest(res, 'That mechanic is fully booked that day - please choose another day.');
  }

  if (times.startTime < settings.opening_time || times.endTime > settings.closing_time) {
    return badRequest(res, `That job doesn't fit in the shop's opening hours (${settings.opening_time}–${settings.closing_time}) - please choose an earlier time or a shorter job type.`);
  }
  const overlap = await db
    .prepare(
      `SELECT id FROM workshop_jobs
       WHERE mechanic_id = ? AND job_date = ? AND start_time IS NOT NULL AND start_time != ''
       AND start_time < ? AND end_time > ?
       LIMIT 1`
    )
    .get(mechResolved.mechanicId, jobDate, times.endTime, times.startTime);
  if (overlap) {
    return badRequest(res, "That mechanic is already booked over part of that window - please choose another time or a shorter job type.");
  }

  // Either an existing bike of theirs, or a new one registered inline -
  // never a bike belonging to another customer (checked below).
  let bikeId = null;
  if (body.newBike) {
    const make = (body.newBike.make || '').trim();
    const model = (body.newBike.model || '').trim();
    if (!make && !model) return badRequest(res, 'Bike make or model is required');
    const info = await db
      .prepare(
        `INSERT INTO customer_bikes (customer_id, make, model, colour, serial_number, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        ctx.login.customer_id,
        make,
        model,
        (body.newBike.colour || '').trim(),
        (body.newBike.serialNumber || '').trim(),
        nowIso()
      );
    bikeId = info.lastInsertRowid;
  } else if (body.bikeId) {
    const bike = await db
      .prepare('SELECT * FROM customer_bikes WHERE id = ? AND customer_id = ? AND active = 1')
      .get(Number(body.bikeId), ctx.login.customer_id);
    if (!bike) return badRequest(res, 'Bike not found');
    bikeId = bike.id;
  }

  // Never trusts a client-sent customerId or status - always the logged-in
  // customer's own linked record, always 'pending' until a mechanic reviews
  // it, same principle as createSale() never trusting a client-sent total.
  const jobId = await createWorkshopJob({
    title: `Online booking: ${description}`.slice(0, 200),
    customerId: ctx.login.customer_id,
    bikeId,
    mechanicId: mechResolved.mechanicId,
    jobDate,
    startTime: times.startTime,
    endTime: times.endTime,
    status: 'pending',
    notes: description,
    skipAutoOrder: false,
  });
  const row = await db.prepare(WORKSHOP_JOB_SELECT + ' WHERE w.id = ?').get(jobId);
  sendJson(res, 201, serializeWorkshopJob(row));
});

// ---------- Static file serving ----------

async function serveStatic(req, res, pathname, baseDir) {
  let filePath = path.join(baseDir, pathname === '/' ? 'index.html' : pathname);
  // Prevent path traversal outside the given static directory.
  if (!filePath.startsWith(baseDir)) {
    return notFound(res);
  }
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = path.join(baseDir, 'index.html');
  }
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';
  // Without an explicit header here, Cloudflare's edge falls back to its own
  // default caching for static-looking extensions (observed: a 4-hour TTL)
  // - fine for a CDN-fronted site with a build/version pipeline, but this
  // app deploys straight from source with no cache-busted filenames, so a
  // cached JS/CSS bundle can silently outlive the code it's stale against.
  // Small, low-traffic internal tool - correctness beats any caching win.
  res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
  createReadStream(filePath).pipe(res);
}

async function handleStorefrontRequest(req, res, pathname, shop) {
  if (pathname === '/api/storefront/info' && req.method === 'GET') {
    return sendJson(res, 200, await getStorefrontInfo(shop));
  }
  if (pathname === '/api/storefront/products' && req.method === 'GET') {
    return sendJson(res, 200, await listStorefrontProducts());
  }
  // On a subdomain-hosted storefront (<slug>.wheelhouseepos.com),
  // parseStorefrontSlugCandidate matches every path on that host, not just
  // storefront-specific ones - so requests for uploaded images and the
  // booking portal have to be forwarded to their real handlers here instead
  // of falling through to the storefront's own static bundle below (whose
  // serveStatic fallback would otherwise return the storefront's index.html
  // for these paths instead of the actual image or portal page). The caller
  // (the request dispatcher) already wraps this whole call in a try/catch,
  // so errors from these forwarded calls propagate up to that handler.
  if (pathname.startsWith('/api/uploaded-images/')) {
    return serveUploadedImage(req, res, pathname.slice('/api/uploaded-images/'.length));
  }
  if (pathname === '/book' || pathname.startsWith('/book/')) {
    const relative = pathname.slice('/book'.length) || '/';
    return serveStatic(req, res, relative, PORTAL_DIR);
  }
  const storePrefix = `/store/${shop.slug}`;
  // The storefront's HTML references its CSS/JS with relative hrefs, which
  // the browser resolves against the current URL's directory. Without a
  // trailing slash here, "/store/<slug>" has no directory segment of its
  // own, so the browser drops the slug entirely (e.g. requests
  // "/store/storefront.css" instead of "/store/<slug>/storefront.css").
  // Redirecting to the trailing-slash form fixes relative resolution for
  // every asset without needing per-request URL rewriting.
  if (pathname === storePrefix) {
    const queryIndex = req.url.indexOf('?');
    const search = queryIndex === -1 ? '' : req.url.slice(queryIndex);
    res.writeHead(302, { Location: `${storePrefix}/${search}` });
    return res.end();
  }
  const relative = pathname.startsWith(storePrefix) ? (pathname.slice(storePrefix.length) || '/') : pathname;
  return serveStatic(req, res, relative, STOREFRONT_DIR);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  if (parseStorefrontSlugCandidate(req, url)) {
    const storefrontShop = await resolveStorefrontShop(req, url);
    if (!storefrontShop) {
      return notFound(res, 'Storefront not found');
    }
    try {
      await runWithShop(storefrontShop.id, () => handleStorefrontRequest(req, res, pathname, storefrontShop));
    } catch (err) {
      console.error(err);
      sendJson(res, 500, { error: 'Internal server error' });
    }
    return;
  }

  // Deliberately handled here, before the generic /api/ branch below would
  // otherwise swallow it and demand a staff session - these images need to
  // be fetchable by anonymous public-storefront visitors (see
  // serveUploadedImage's comment for why that's safe).
  if (pathname.startsWith('/api/uploaded-images/')) {
    try {
      await serveUploadedImage(req, res, pathname.slice('/api/uploaded-images/'.length));
    } catch (err) {
      console.error(err);
      sendJson(res, 500, { error: 'Internal server error' });
    }
    return;
  }

  if (pathname.startsWith('/api/portal/')) {
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const match = r.regex.exec(pathname);
      if (!match) continue;
      const params = {};
      r.paramNames.forEach((name, i) => (params[name] = match[i + 1]));

      // signup/login/logout resolve their own shop (or need none at all, for
      // logout) and never touch RLS-protected tables directly, same as
      // /api/auth/* does for staff. Every other portal route needs the
      // shop's RLS context, resolved here from :shopSlug, to read/write
      // customers/employees/workshop_jobs/etc through the normal db
      // shim - customer identity (if the route needs it) is then checked
      // inside the handler itself via currentCustomerSession().
      if (/\/(signup|login|logout)$/.test(pathname)) {
        try {
          await r.handler(req, res, params, url.searchParams);
        } catch (err) {
          console.error(err);
          sendJson(res, 500, { error: err.message || 'Internal server error' });
        }
        return;
      }

      const { rows: [shop] } = await pool.query('SELECT * FROM shops WHERE slug = $1', [params.shopSlug]);
      if (!shop) return notFound(res, 'Shop not found');

      try {
        await runWithShop(shop.id, () => r.handler(req, res, params, url.searchParams, shop));
      } catch (err) {
        console.error(err);
        sendJson(res, 500, { error: err.message || 'Internal server error' });
      }
      return;
    }
    return notFound(res, 'Unknown portal route');
  }

  if (pathname.startsWith('/api/')) {
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const match = r.regex.exec(pathname);
      if (!match) continue;
      const params = {};
      r.paramNames.forEach((name, i) => (params[name] = match[i + 1]));

      // Auth routes manage the session cookie themselves and never touch shop
      // data, so they run outside runWithShop. Every other /api/ route needs
      // a signed-in shop first - a client scoped (via RLS) to that shop
      // becomes `db` for the duration of this one request.
      if (pathname.startsWith('/api/auth/')) {
        try {
          await r.handler(req, res, params, url.searchParams);
        } catch (err) {
          console.error(err);
          sendJson(res, 500, { error: err.message || 'Internal server error' });
        }
        return;
      }

      const ctx = await currentSession(req);
      if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });

      try {
        await runWithShop(ctx.shop.id, () => r.handler(req, res, params, url.searchParams));
      } catch (err) {
        console.error(err);
        sendJson(res, 500, { error: err.message || 'Internal server error' });
      }
      return;
    }
    return notFound(res, 'Unknown API route');
  }

  // A standalone, self-contained sales-demo page - fixed content, not a
  // directory to fall back through like /book or / below, so it's served
  // directly with an explicit content type rather than via serveStatic
  // (which would guess the MIME type from a file extension the URL
  // deliberately doesn't have).
  if (pathname === '/sdbdemo' || pathname === '/sdbdemo/') {
    try {
      const html = await readFile(DEMO_FILE, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(html);
    } catch (err) {
      console.error(err);
      sendJson(res, 500, { error: 'Internal server error' });
    }
    return;
  }

  // Customer-portal frontend lives under /book - its own small static
  // bundle (public-portal/), entirely separate from the staff app's.
  if (pathname === '/book' || pathname.startsWith('/book/')) {
    const relative = pathname.slice('/book'.length) || '/';
    try {
      await serveStatic(req, res, relative, PORTAL_DIR);
    } catch (err) {
      console.error(err);
      sendJson(res, 500, { error: 'Internal server error' });
    }
    return;
  }

  try {
    await serveStatic(req, res, pathname, PUBLIC_DIR);
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

runMigrations()
  .then(() => mkdir(UPLOADS_DIR, { recursive: true }))
  .then(() => {
    server.listen(PORT, () => {
      console.log(`\n  Bike Shop EPOS running at http://localhost:${PORT}\n`);
    });
  })
  .catch((err) => {
    console.error('Failed to run database migrations - server not started.');
    console.error(err);
    process.exit(1);
  });
