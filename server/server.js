// Bike Shop EPOS - local server.
// Pure Node.js built-ins only (http + node:sqlite) - no npm install required.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AsyncLocalStorage } from 'node:async_hooks';
import { getShopDb } from './db.js';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

// Every request that touches shop data runs inside `dbContext.run(shopDb, ...)`
// (set up once the session cookie has been resolved to a shop, see the
// request handler at the bottom of this file). `db` below reads whichever
// shop's database is current for the request handling it, so the ~60 route
// handlers in this file can keep using the plain `db.prepare(...)` calls
// they always have instead of threading a db argument through every one of
// them - each concurrent request still only ever touches its own shop's data.
const dbContext = new AsyncLocalStorage();
const db = new Proxy(
  {},
  {
    get(_target, prop) {
      const real = dbContext.getStore();
      if (!real) throw new Error('No shop database in scope for this request');
      const value = real[prop];
      return typeof value === 'function' ? value.bind(real) : value;
    },
  }
);

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

function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}`
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

function currentSession(req) {
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

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 2_000_000) {
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
  };
}

function listProducts({ search, category, activeOnly }) {
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
  const rows = db.prepare(sql).all(...params);
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
// run inside dbContext (see the request handler at the bottom) - it only
// ever touches the shop/login registry (auth.js), never a specific shop's
// data, and each handler resolves its own session via currentSession().

route('POST', '/api/auth/signup', async (req, res) => {
  const body = await readJsonBody(req);
  let created;
  try {
    created = createShop({ shopName: body.shopName, ownerName: body.ownerName, email: body.email, password: body.password });
  } catch (err) {
    if (err instanceof AuthError) return badRequest(res, err.message);
    throw err;
  }
  const token = createSession(created.login.id);
  setSessionCookie(res, token);
  sendJson(res, 201, serializeSession(getSessionContext(token)));
});

route('POST', '/api/auth/login', async (req, res) => {
  const body = await readJsonBody(req);
  let login;
  try {
    login = verifyLogin(body.email, body.password);
  } catch (err) {
    if (err instanceof AuthError) return sendJson(res, 401, { error: err.message });
    throw err;
  }
  const token = createSession(login.id);
  setSessionCookie(res, token);
  sendJson(res, 200, serializeSession(getSessionContext(token)));
});

route('POST', '/api/auth/logout', async (req, res) => {
  const { [SESSION_COOKIE]: token } = parseCookies(req);
  destroySession(token);
  clearSessionCookie(res);
  sendJson(res, 200, { ok: true });
});

route('GET', '/api/auth/me', async (req, res) => {
  const ctx = currentSession(req);
  if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
  sendJson(res, 200, serializeSession(ctx));
});

// ---------- Auth: employee logins (owner-only to add/deactivate) ----------

route('GET', '/api/auth/team', async (req, res) => {
  const ctx = currentSession(req);
  if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
  sendJson(res, 200, listLogins(ctx.shop.id));
});

route('POST', '/api/auth/team', async (req, res) => {
  const ctx = currentSession(req);
  if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
  if (!ctx.login.is_owner) return sendJson(res, 403, { error: 'Only the owner can add employee logins' });
  const body = await readJsonBody(req);
  try {
    const login = createEmployeeLogin({ shopId: ctx.shop.id, name: body.name, email: body.email, password: body.password });
    sendJson(res, 201, serializeLogin(login));
  } catch (err) {
    if (err instanceof AuthError) return badRequest(res, err.message);
    throw err;
  }
});

route('PUT', '/api/auth/team/:id', async (req, res, params) => {
  const ctx = currentSession(req);
  if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
  if (!ctx.login.is_owner) return sendJson(res, 403, { error: 'Only the owner can manage employee logins' });
  const body = await readJsonBody(req);
  try {
    const login = setLoginActive(ctx.shop.id, Number(params.id), !!body.active);
    sendJson(res, 200, login);
  } catch (err) {
    if (err instanceof AuthError) return badRequest(res, err.message);
    throw err;
  }
});

route('GET', '/api/products', async (req, res, params, query) => {
  const products = listProducts({
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

  try {
    const info = db
      .prepare(
        `INSERT INTO products (sku, barcode, name, category, price, cost, stock_qty, low_stock_threshold, supplier, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(sku, barcode, name, category, price, cost, stockQty, lowStockThreshold, supplier, nowIso());
    if (stockQty !== 0) {
      db.prepare(
        `INSERT INTO stock_movements (product_id, change_qty, type, note) VALUES (?, ?, 'intake', 'Initial stock')`
      ).run(info.lastInsertRowid, stockQty);
    }
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
    sendJson(res, 201, serializeProduct(row));
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return badRequest(res, err.message.includes('barcode') ? `Barcode "${barcode}" is already in use` : `SKU "${sku}" is already in use`);
    }
    throw err;
  }
});

route('PUT', '/api/products/:id', async (req, res, params) => {
  const id = Number(params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
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

  if (!name) return badRequest(res, 'Product name is required');

  try {
    db.prepare(
      `UPDATE products SET sku = ?, barcode = ?, name = ?, category = ?, price = ?, cost = ?, low_stock_threshold = ?, supplier = ?, active = ?, updated_at = ?
       WHERE id = ?`
    ).run(sku, barcode, name, category, price, cost, lowStockThreshold, supplier, active, nowIso(), id);
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    sendJson(res, 200, serializeProduct(row));
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return badRequest(res, err.message.includes('barcode') ? `Barcode "${barcode}" is already in use` : `SKU "${sku}" is already in use`);
    }
    throw err;
  }
});

route('DELETE', '/api/products/:id', async (req, res, params) => {
  const id = Number(params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Product not found');
  db.prepare('UPDATE products SET active = 0, updated_at = ? WHERE id = ?').run(nowIso(), id);
  sendJson(res, 200, { ok: true });
});

route('POST', '/api/products/:id/stock', async (req, res, params) => {
  const id = Number(params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Product not found');
  const body = await readJsonBody(req);
  const change = Math.trunc(Number(body.change));
  if (!Number.isFinite(change) || change === 0) return badRequest(res, 'A non-zero whole-number "change" is required');
  const type = body.type === 'adjustment' ? 'adjustment' : 'intake';
  const note = (body.note || '').trim();

  const newQty = existing.stock_qty + change;
  if (newQty < 0) return badRequest(res, 'Stock cannot go below zero');

  db.prepare('UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ?').run(newQty, nowIso(), id);
  db.prepare('INSERT INTO stock_movements (product_id, change_qty, type, note) VALUES (?, ?, ?, ?)').run(
    id,
    change,
    type,
    note
  );
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  sendJson(res, 200, serializeProduct(row));
});

route('GET', '/api/categories', async (req, res) => {
  const rows = db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all();
  sendJson(res, 200, rows.map((r) => r.category));
});

// ---------- Customers ----------

function serializeCustomer(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    active: !!row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function listCustomers({ search, activeOnly }) {
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
  return db.prepare(sql).all(...params).map(serializeCustomer);
}

route('GET', '/api/customers', async (req, res, params, query) => {
  const customers = listCustomers({
    search: query.get('search') || '',
    activeOnly: query.get('all') !== '1',
  });
  sendJson(res, 200, customers);
});

route('GET', '/api/customers/:id', async (req, res, params) => {
  const id = Number(params.id);
  const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!row) return notFound(res, 'Customer not found');
  sendJson(res, 200, serializeCustomer(row));
});

route('GET', '/api/customers/:id/sales', async (req, res, params) => {
  const id = Number(params.id);
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!customer) return notFound(res, 'Customer not found');
  const rows = db.prepare(SALE_SELECT + ' WHERE s.customer_id = ? ORDER BY s.id DESC LIMIT 500').all(id);
  sendJson(res, 200, rows.map((r) => serializeSale(r)));
});

route('POST', '/api/customers', async (req, res) => {
  const body = await readJsonBody(req);
  const name = (body.name || '').trim();
  if (!name) return badRequest(res, 'Customer name is required');
  const email = (body.email || '').trim();
  const phone = (body.phone || '').trim();
  const notes = (body.notes || '').trim();

  const info = db
    .prepare('INSERT INTO customers (name, email, phone, notes, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(name, email, phone, notes, nowIso());
  const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(info.lastInsertRowid);
  sendJson(res, 201, serializeCustomer(row));
});

route('PUT', '/api/customers/:id', async (req, res, params) => {
  const id = Number(params.id);
  const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Customer not found');
  const body = await readJsonBody(req);

  const name = body.name !== undefined ? String(body.name).trim() : existing.name;
  const email = body.email !== undefined ? String(body.email).trim() : existing.email;
  const phone = body.phone !== undefined ? String(body.phone).trim() : existing.phone;
  const notes = body.notes !== undefined ? String(body.notes).trim() : existing.notes;
  const active = body.active !== undefined ? (body.active ? 1 : 0) : existing.active;

  if (!name) return badRequest(res, 'Customer name is required');

  db.prepare(
    'UPDATE customers SET name = ?, email = ?, phone = ?, notes = ?, active = ?, updated_at = ? WHERE id = ?'
  ).run(name, email, phone, notes, active, nowIso(), id);
  const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  sendJson(res, 200, serializeCustomer(row));
});

route('DELETE', '/api/customers/:id', async (req, res, params) => {
  const id = Number(params.id);
  const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Customer not found');
  db.prepare('UPDATE customers SET active = 0, updated_at = ? WHERE id = ?').run(nowIso(), id);
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
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!customer) return notFound(res, 'Customer not found');
  let sql = 'SELECT * FROM customer_bikes WHERE customer_id = ?';
  const args = [customerId];
  if (query.get('all') !== '1') sql += ' AND active = 1';
  sql += ' ORDER BY make, model';
  const rows = db.prepare(sql).all(...args);
  sendJson(res, 200, rows.map(serializeBike));
});

route('POST', '/api/customers/:id/bikes', async (req, res, params) => {
  const customerId = Number(params.id);
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!customer) return notFound(res, 'Customer not found');
  const body = await readJsonBody(req);
  const make = (body.make || '').trim();
  const model = (body.model || '').trim();
  if (!make && !model) return badRequest(res, 'Make or model is required');
  const colour = (body.colour || '').trim();
  const serialNumber = (body.serialNumber || '').trim();
  const notes = (body.notes || '').trim();

  const info = db
    .prepare(
      `INSERT INTO customer_bikes (customer_id, make, model, colour, serial_number, notes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(customerId, make, model, colour, serialNumber, notes, nowIso());
  const row = db.prepare('SELECT * FROM customer_bikes WHERE id = ?').get(info.lastInsertRowid);
  sendJson(res, 201, serializeBike(row));
});

route('PUT', '/api/bikes/:id', async (req, res, params) => {
  const id = Number(params.id);
  const existing = db.prepare('SELECT * FROM customer_bikes WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Bike not found');
  const body = await readJsonBody(req);

  const make = body.make !== undefined ? String(body.make).trim() : existing.make;
  const model = body.model !== undefined ? String(body.model).trim() : existing.model;
  if (!make && !model) return badRequest(res, 'Make or model is required');
  const colour = body.colour !== undefined ? String(body.colour).trim() : existing.colour;
  const serialNumber = body.serialNumber !== undefined ? String(body.serialNumber).trim() : existing.serial_number;
  const notes = body.notes !== undefined ? String(body.notes).trim() : existing.notes;
  const active = body.active !== undefined ? (body.active ? 1 : 0) : existing.active;

  db.prepare(
    `UPDATE customer_bikes SET make = ?, model = ?, colour = ?, serial_number = ?, notes = ?, active = ?, updated_at = ?
     WHERE id = ?`
  ).run(make, model, colour, serialNumber, notes, active, nowIso(), id);
  const row = db.prepare('SELECT * FROM customer_bikes WHERE id = ?').get(id);
  sendJson(res, 200, serializeBike(row));
});

route('DELETE', '/api/bikes/:id', async (req, res, params) => {
  const id = Number(params.id);
  const existing = db.prepare('SELECT * FROM customer_bikes WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Bike not found');
  db.prepare('UPDATE customer_bikes SET active = 0, updated_at = ? WHERE id = ?').run(nowIso(), id);
  sendJson(res, 200, { ok: true });
});

route('GET', '/api/bikes/:id/jobs', async (req, res, params) => {
  const id = Number(params.id);
  const bike = db.prepare('SELECT * FROM customer_bikes WHERE id = ?').get(id);
  if (!bike) return notFound(res, 'Bike not found');
  const rows = db
    .prepare('SELECT * FROM workshop_jobs WHERE bike_id = ? ORDER BY job_date DESC, start_time DESC')
    .all(id);
  sendJson(res, 200, rows.map(serializeWorkshopJob));
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
  if (dateFilter === 'today') {
    const today = new Date().toISOString().slice(0, 10);
    sql += ' AND substr(s.created_at, 1, 10) = ?';
    args.push(today);
  } else if (dateFilter) {
    sql += ' AND substr(s.created_at, 1, 10) = ?';
    args.push(dateFilter);
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
  const rows = db.prepare(sql).all(...args);
  sendJson(
    res,
    200,
    rows.map((r) => serializeSale(r))
  );
});

route('GET', '/api/sales/:id', async (req, res, params) => {
  const id = Number(params.id);
  const sale = db.prepare(SALE_SELECT + ' WHERE s.id = ?').get(id);
  if (!sale) return notFound(res, 'Sale not found');
  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id);
  const payments = db.prepare('SELECT * FROM sale_payments WHERE sale_id = ?').all(id);
  sendJson(res, 200, serializeSale(sale, items, payments));
});

class ValidationError extends Error {}

function resolveCashierId(rawId) {
  if (rawId === undefined || rawId === null || rawId === '') return { ok: true, cashierId: null };
  const cashierId = Number(rawId);
  const cashier = db.prepare('SELECT * FROM employees WHERE id = ? AND active = 1 AND is_cashier = 1').get(cashierId);
  if (!cashier) return { ok: false };
  return { ok: true, cashierId };
}

// Validates items against live stock, inserts the sale + sale_items, and
// deducts stock. Shared by direct checkout and quote/order -> sale conversion.
function createSale({ customerId, cashierId, items, discount, cashAmount, cardAmount, cashTendered, payments, note }) {
  const loaded = [];
  for (const it of items) {
    const productId = Number(it.productId);
    const qty = Math.trunc(Number(it.qty));
    if (!productId || !Number.isFinite(qty) || qty <= 0) {
      throw new ValidationError('Each item needs a valid productId and positive qty');
    }
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(productId);
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
  const total = Math.max(0, subtotal - discount);

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

  db.exec('BEGIN');
  try {
    const saleInfo = db
      .prepare(
        `INSERT INTO sales (customer_id, cashier_id, subtotal, discount, total, payment_method, cash_amount, card_amount, cash_tendered, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(customerId, cashierId, subtotal, discount, total, paymentMethod, cash, card, cashTendered, note);
    const saleId = saleInfo.lastInsertRowid;

    for (const p of extraPayments) {
      db.prepare('INSERT INTO sale_payments (sale_id, tender_type, amount) VALUES (?, ?, ?)').run(
        saleId,
        p.tenderType,
        p.amount
      );
    }

    for (const { product, qty, unitPrice } of loaded) {
      const lineTotal = unitPrice * qty;
      db.prepare(
        `INSERT INTO sale_items (sale_id, product_id, name, sku, unit_price, qty, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(saleId, product.id, product.name, product.sku, unitPrice, qty, lineTotal);

      const newQty = product.stock_qty - qty;
      db.prepare('UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ?').run(newQty, nowIso(), product.id);
      db.prepare(
        `INSERT INTO stock_movements (product_id, change_qty, type, note) VALUES (?, ?, 'sale', ?)`
      ).run(product.id, -qty, `Sale #${saleId}`);
    }
    db.exec('COMMIT');
    return saleId;
  } catch (err) {
    db.exec('ROLLBACK');
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
    const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND active = 1').get(customerId);
    if (!customer) return badRequest(res, 'Customer not found or inactive');
  }

  const cashierResolved = resolveCashierId(body.cashierId);
  if (!cashierResolved.ok) return badRequest(res, 'Cashier not found or inactive');
  if (cashierResolved.cashierId === null) return badRequest(res, 'Select a cashier before completing the sale');

  let saleId;
  try {
    saleId = createSale({ customerId, cashierId: cashierResolved.cashierId, items, discount, cashAmount, cardAmount, cashTendered, payments, note });
  } catch (err) {
    if (err instanceof ValidationError) return badRequest(res, err.message);
    throw err;
  }

  const sale = db.prepare(SALE_SELECT + ' WHERE s.id = ?').get(saleId);
  const savedItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
  const savedPayments = db.prepare('SELECT * FROM sale_payments WHERE sale_id = ?').all(saleId);
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
  const rows = db.prepare(sql).all(...args);
  sendJson(res, 200, rows.map((r) => serializeSaleDocument(r)));
});

route('GET', '/api/sale-documents/:id', async (req, res, params) => {
  const id = Number(params.id);
  const row = db.prepare(DOC_SELECT + ' WHERE d.id = ?').get(id);
  if (!row) return notFound(res, 'Not found');
  const items = db.prepare('SELECT * FROM sale_document_items WHERE document_id = ?').all(id);
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
    const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND active = 1').get(customerId);
    if (!customer) return badRequest(res, 'Customer not found or inactive');
  }

  const cashierResolved = resolveCashierId(body.cashierId);
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
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(productId);
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

  db.exec('BEGIN');
  try {
    const info = db
      .prepare(
        `INSERT INTO sale_documents (kind, customer_id, cashier_id, subtotal, discount, total, note, title, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(kind, customerId, cashierResolved.cashierId, subtotal, discount, total, note, title, nowIso());
    const docId = info.lastInsertRowid;
    for (const { product, qty, unitPrice } of loaded) {
      const lineTotal = unitPrice * qty;
      db.prepare(
        `INSERT INTO sale_document_items (document_id, product_id, name, sku, unit_price, qty, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(docId, product.id, product.name, product.sku, unitPrice, qty, lineTotal);
    }
    db.exec('COMMIT');
    const row = db.prepare(DOC_SELECT + ' WHERE d.id = ?').get(docId);
    const savedItems = db.prepare('SELECT * FROM sale_document_items WHERE document_id = ?').all(docId);
    sendJson(res, 201, serializeSaleDocument(row, savedItems));
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
});

route('PUT', '/api/sale-documents/:id', async (req, res, params) => {
  const id = Number(params.id);
  const existing = db.prepare('SELECT * FROM sale_documents WHERE id = ?').get(id);
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
      const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND active = 1').get(customerId);
      if (!customer) return badRequest(res, 'Customer not found or inactive');
    }
  }

  let workshopJobId = existing.workshop_job_id;
  if (body.workshopJobId !== undefined) {
    if (body.workshopJobId === null) {
      workshopJobId = null;
    } else {
      const jobId = Number(body.workshopJobId);
      const job = db.prepare('SELECT id FROM workshop_jobs WHERE id = ?').get(jobId);
      if (!job) return badRequest(res, 'Workshop job not found');
      workshopJobId = jobId;
    }
  }

  db.prepare(
    'UPDATE sale_documents SET status = ?, title = ?, customer_id = ?, note = ?, workshop_job_id = ?, updated_at = ? WHERE id = ?'
  ).run(status, title, customerId, note, workshopJobId, nowIso(), id);
  const row = db.prepare(DOC_SELECT + ' WHERE d.id = ?').get(id);
  const items = db.prepare('SELECT * FROM sale_document_items WHERE document_id = ?').all(id);
  sendJson(res, 200, serializeSaleDocument(row, items));
});

// Replaces the full item list on an existing quote/order (e.g. adding parts
// to the placeholder order behind a workshop job). Items snapshot product
// name/sku/price like creation does - no stock check, same reasoning as
// POST /api/sale-documents.
route('PUT', '/api/sale-documents/:id/items', async (req, res, params) => {
  const id = Number(params.id);
  const existing = db.prepare('SELECT * FROM sale_documents WHERE id = ?').get(id);
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
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(productId);
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

  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM sale_document_items WHERE document_id = ?').run(id);
    for (const { product, qty, unitPrice } of loaded) {
      const lineTotal = unitPrice * qty;
      db.prepare(
        `INSERT INTO sale_document_items (document_id, product_id, name, sku, unit_price, qty, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(id, product.id, product.name, product.sku, unitPrice, qty, lineTotal);
    }
    db.prepare('UPDATE sale_documents SET subtotal = ?, discount = ?, total = ?, updated_at = ? WHERE id = ?').run(
      subtotal,
      discount,
      total,
      nowIso(),
      id
    );
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const row = db.prepare(DOC_SELECT + ' WHERE d.id = ?').get(id);
  const savedItems = db.prepare('SELECT * FROM sale_document_items WHERE document_id = ?').all(id);
  sendJson(res, 200, serializeSaleDocument(row, savedItems));
});

route('POST', '/api/sale-documents/:id/convert', async (req, res, params) => {
  const id = Number(params.id);
  const doc = db.prepare('SELECT * FROM sale_documents WHERE id = ?').get(id);
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

  const cashierResolved = resolveCashierId(body.cashierId);
  if (!cashierResolved.ok) return badRequest(res, 'Cashier not found or inactive');
  if (cashierResolved.cashierId === null) return badRequest(res, 'Select a cashier before completing the sale');

  const items = db.prepare('SELECT * FROM sale_document_items WHERE document_id = ?').all(id);
  const saleItems = items.map((it) => ({ productId: it.product_id, qty: it.qty, unitPrice: it.unit_price }));

  let saleId;
  try {
    saleId = createSale({
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

  db.prepare('UPDATE sale_documents SET status = ?, converted_sale_id = ?, updated_at = ? WHERE id = ?').run(
    'converted',
    saleId,
    nowIso(),
    id
  );

  const sale = db.prepare(SALE_SELECT + ' WHERE s.id = ?').get(saleId);
  const savedItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
  const savedPayments = db.prepare('SELECT * FROM sale_payments WHERE sale_id = ?').all(saleId);
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const JOB_STATUSES = ['scheduled', 'waiting_parts', 'on_hold', 'complete'];

function resolveJobStatus(raw, existing) {
  if (raw === undefined) return existing || 'scheduled';
  if (!JOB_STATUSES.includes(raw)) return null;
  return raw;
}

const WORKSHOP_JOB_SELECT = `SELECT w.*, c.name AS customer_name, trim(b.make || ' ' || b.model) AS bike_label, mech.name AS mechanic_name, d.id AS order_id
  FROM workshop_jobs w
  LEFT JOIN customers c ON c.id = w.customer_id
  LEFT JOIN customer_bikes b ON b.id = w.bike_id
  LEFT JOIN employees mech ON mech.id = w.mechanic_id
  LEFT JOIN sale_documents d ON d.workshop_job_id = w.id`;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function resolveJobCustomerId(rawId, existingId) {
  if (rawId === undefined) return { ok: true, customerId: existingId };
  if (rawId === null || rawId === '') return { ok: true, customerId: null };
  const customerId = Number(rawId);
  const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND active = 1').get(customerId);
  if (!customer) return { ok: false };
  return { ok: true, customerId };
}

// A bike belongs to exactly one customer, so a job can only be linked to a
// bike when it's also linked to that same bike's owner. When bikeId isn't
// explicitly provided (e.g. a drag/resize that only moves the time), the
// existing link is kept unless it no longer matches the resolved customer,
// in which case it's silently dropped rather than rejecting the request.
function resolveJobBikeId(rawId, existingId, resolvedCustomerId) {
  if (rawId === undefined) {
    if (!existingId) return { ok: true, bikeId: null };
    const bike = db.prepare('SELECT * FROM customer_bikes WHERE id = ?').get(existingId);
    if (!bike || !resolvedCustomerId || bike.customer_id !== resolvedCustomerId) {
      return { ok: true, bikeId: null };
    }
    return { ok: true, bikeId: existingId };
  }
  if (rawId === null || rawId === '') return { ok: true, bikeId: null };
  const bikeId = Number(rawId);
  const bike = db.prepare('SELECT * FROM customer_bikes WHERE id = ? AND active = 1').get(bikeId);
  if (!bike) return { ok: false, error: 'Bike not found or inactive' };
  if (!resolvedCustomerId || bike.customer_id !== resolvedCustomerId) {
    return { ok: false, error: "That bike doesn't belong to the selected customer" };
  }
  return { ok: true, bikeId };
}

function resolveJobMechanicId(rawId, existingId) {
  if (rawId === undefined) return { ok: true, mechanicId: existingId };
  if (rawId === null || rawId === '') return { ok: true, mechanicId: null };
  const mechanicId = Number(rawId);
  const mechanic = db.prepare('SELECT * FROM employees WHERE id = ? AND active = 1 AND is_mechanic = 1').get(mechanicId);
  if (!mechanic) return { ok: false };
  return { ok: true, mechanicId };
}

function addMinutesToTime(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = Math.max(0, Math.min(23 * 60 + 59, h * 60 + m + minutes));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
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
  sql += ' ORDER BY w.job_date, w.start_time';
  const rows = db.prepare(sql).all(...args);
  sendJson(res, 200, rows.map(serializeWorkshopJob));
});

route('GET', '/api/workshop-jobs/:id', async (req, res, params) => {
  const id = Number(params.id);
  const row = db.prepare(WORKSHOP_JOB_SELECT + ' WHERE w.id = ?').get(id);
  if (!row) return notFound(res, 'Job not found');
  sendJson(res, 200, serializeWorkshopJob(row));
});

route('POST', '/api/workshop-jobs', async (req, res) => {
  const body = await readJsonBody(req);
  const title = (body.title || '').trim();
  if (!title) return badRequest(res, 'Job title is required');
  const jobDate = (body.jobDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jobDate)) return badRequest(res, 'A valid date is required');
  const notes = (body.notes || '').trim();

  const times = resolveJobTimes((body.startTime || '').trim(), (body.endTime || '').trim());
  if (times.error) return badRequest(res, times.error);

  const resolved = resolveJobCustomerId(body.customerId, null);
  if (!resolved.ok) return badRequest(res, 'Customer not found or inactive');

  const bikeResolved = resolveJobBikeId(body.bikeId, null, resolved.customerId);
  if (!bikeResolved.ok) return badRequest(res, bikeResolved.error);

  const mechResolved = resolveJobMechanicId(body.mechanicId, null);
  if (!mechResolved.ok) return badRequest(res, 'Mechanic not found or inactive');

  const status = resolveJobStatus(body.status, null);
  if (status === null) return badRequest(res, `status must be one of: ${JOB_STATUSES.join(', ')}`);

  // Every workshop job is backed by an order so it's findable from the
  // Orders page, unless the caller already has an order it's about to link
  // this job to itself (the order's "show in workshop diary" toggle).
  const skipAutoOrder = !!body.skipAutoOrder;

  db.exec('BEGIN');
  try {
    const info = db
      .prepare(
        `INSERT INTO workshop_jobs (title, customer_id, bike_id, mechanic_id, job_date, start_time, end_time, status, notes, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        title,
        resolved.customerId,
        bikeResolved.bikeId,
        mechResolved.mechanicId,
        jobDate,
        times.startTime,
        times.endTime,
        status,
        notes,
        nowIso()
      );
    const jobId = info.lastInsertRowid;

    if (!skipAutoOrder) {
      db.prepare(
        `INSERT INTO sale_documents (kind, customer_id, subtotal, discount, total, note, title, workshop_job_id, updated_at)
         VALUES ('order', ?, 0, 0, 0, ?, ?, ?, ?)`
      ).run(resolved.customerId, notes, title, jobId, nowIso());
    }

    db.exec('COMMIT');
    const row = db.prepare(WORKSHOP_JOB_SELECT + ' WHERE w.id = ?').get(jobId);
    sendJson(res, 201, serializeWorkshopJob(row));
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
});

route('PUT', '/api/workshop-jobs/:id', async (req, res, params) => {
  const id = Number(params.id);
  const existing = db.prepare('SELECT * FROM workshop_jobs WHERE id = ?').get(id);
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

  const resolved = resolveJobCustomerId(body.customerId, existing.customer_id);
  if (!resolved.ok) return badRequest(res, 'Customer not found or inactive');

  const bikeResolved = resolveJobBikeId(body.bikeId, existing.bike_id, resolved.customerId);
  if (!bikeResolved.ok) return badRequest(res, bikeResolved.error);

  const mechResolved = resolveJobMechanicId(body.mechanicId, existing.mechanic_id);
  if (!mechResolved.ok) return badRequest(res, 'Mechanic not found or inactive');

  const status = resolveJobStatus(body.status, existing.status);
  if (status === null) return badRequest(res, `status must be one of: ${JOB_STATUSES.join(', ')}`);

  db.prepare(
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
  const row = db.prepare(WORKSHOP_JOB_SELECT + ' WHERE w.id = ?').get(id);
  sendJson(res, 200, serializeWorkshopJob(row));
});

route('DELETE', '/api/workshop-jobs/:id', async (req, res, params) => {
  const id = Number(params.id);
  const existing = db.prepare('SELECT * FROM workshop_jobs WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Job not found');
  db.prepare('UPDATE sale_documents SET workshop_job_id = NULL WHERE workshop_job_id = ?').run(id);
  db.prepare('DELETE FROM workshop_jobs WHERE id = ?').run(id);
  sendJson(res, 200, { ok: true });
});

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
  const rows = db.prepare(sql).all(...args);
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
  const info = db
    .prepare('INSERT INTO employees (name, is_mechanic, is_cashier, working_days, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(name, isMechanic, isCashier, workingDays, nowIso());
  const row = db.prepare('SELECT * FROM employees WHERE id = ?').get(info.lastInsertRowid);
  sendJson(res, 201, serializeEmployee(row));
});

route('PUT', '/api/employees/:id', async (req, res, params) => {
  const id = Number(params.id);
  const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Employee not found');
  const body = await readJsonBody(req);
  const name = body.name !== undefined ? String(body.name).trim() : existing.name;
  if (!name) return badRequest(res, 'Employee name is required');
  const active = body.active !== undefined ? (body.active ? 1 : 0) : existing.active;
  const isMechanic = body.isMechanic !== undefined ? (body.isMechanic ? 1 : 0) : existing.is_mechanic;
  const isCashier = body.isCashier !== undefined ? (body.isCashier ? 1 : 0) : existing.is_cashier;
  const workingDays = resolveWorkingDays(body.workingDays, existing.working_days);
  if (workingDays === null) return badRequest(res, 'workingDays must be an array of day numbers (0-6)');
  db.prepare(
    'UPDATE employees SET name = ?, is_mechanic = ?, is_cashier = ?, working_days = ?, active = ?, updated_at = ? WHERE id = ?'
  ).run(name, isMechanic, isCashier, workingDays, active, nowIso(), id);
  const row = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  sendJson(res, 200, serializeEmployee(row));
});

route('DELETE', '/api/employees/:id', async (req, res, params) => {
  const id = Number(params.id);
  const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Employee not found');
  db.prepare('UPDATE employees SET active = 0, updated_at = ? WHERE id = ?').run(nowIso(), id);
  sendJson(res, 200, { ok: true });
});

// Permanently removes the employee row itself (as opposed to the soft
// deactivate above). Workshop jobs and sales/orders already tied to them are
// unassigned rather than deleted or blocked by the foreign key, consistent
// with how removing a customer/bike/product never destroys sale/job history.
route('DELETE', '/api/employees/:id/permanent', async (req, res, params) => {
  const id = Number(params.id);
  const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Employee not found');
  db.prepare('UPDATE workshop_jobs SET mechanic_id = NULL WHERE mechanic_id = ?').run(id);
  db.prepare('UPDATE sales SET cashier_id = NULL WHERE cashier_id = ?').run(id);
  db.prepare('UPDATE sale_documents SET cashier_id = NULL WHERE cashier_id = ?').run(id);
  db.prepare('DELETE FROM employees WHERE id = ?').run(id);
  sendJson(res, 200, { ok: true });
});

// ---------- Workshop settings ----------

function serializeWorkshopSettings(row) {
  return {
    openingTime: row.opening_time,
    closingTime: row.closing_time,
    openingDays: parseWorkingDays(row.opening_days),
    updatedAt: row.updated_at,
  };
}

const HOUR_RE = /^([01]\d|2[0-3]):00$/;

route('GET', '/api/workshop-settings', async (req, res) => {
  const row = db.prepare('SELECT * FROM workshop_settings WHERE id = 1').get();
  sendJson(res, 200, serializeWorkshopSettings(row));
});

route('PUT', '/api/workshop-settings', async (req, res) => {
  const existing = db.prepare('SELECT * FROM workshop_settings WHERE id = 1').get();
  const body = await readJsonBody(req);
  const openingTime = body.openingTime !== undefined ? String(body.openingTime).trim() : existing.opening_time;
  const closingTime = body.closingTime !== undefined ? String(body.closingTime).trim() : existing.closing_time;
  if (!HOUR_RE.test(openingTime) || !HOUR_RE.test(closingTime)) {
    return badRequest(res, 'Opening and closing times must be on the hour (e.g. 09:00)');
  }
  if (closingTime <= openingTime) return badRequest(res, 'Closing time must be after opening time');
  const openingDays = resolveWorkingDays(body.openingDays, existing.opening_days);
  if (openingDays === null) return badRequest(res, 'openingDays must be an array of day numbers (0-6)');
  db.prepare(
    'UPDATE workshop_settings SET opening_time = ?, closing_time = ?, opening_days = ?, updated_at = ? WHERE id = 1'
  ).run(openingTime, closingTime, openingDays, nowIso());
  const row = db.prepare('SELECT * FROM workshop_settings WHERE id = 1').get();
  sendJson(res, 200, serializeWorkshopSettings(row));
});

// ---------- Dashboard ----------

route('GET', '/api/dashboard', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const todayAgg = db
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS total
       FROM sales WHERE substr(created_at, 1, 10) = ?`
    )
    .get(today);

  const lowStock = db
    .prepare(
      `SELECT * FROM products WHERE active = 1 AND low_stock_threshold > 0 AND stock_qty <= low_stock_threshold
       ORDER BY stock_qty ASC`
    )
    .all()
    .map(serializeProduct);

  const topToday = db
    .prepare(
      `SELECT si.name, SUM(si.qty) AS qty, SUM(si.line_total) AS revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE substr(s.created_at, 1, 10) = ?
       GROUP BY si.name
       ORDER BY revenue DESC
       LIMIT 5`
    )
    .all(today);

  sendJson(res, 200, {
    todayCount: todayAgg.count,
    todayTotal: todayAgg.total,
    lowStock,
    topToday,
  });
});

// ---------- Static file serving ----------

async function serveStatic(req, res, pathname) {
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  // Prevent path traversal outside the public directory.
  if (!filePath.startsWith(PUBLIC_DIR)) {
    return notFound(res);
  }
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  createReadStream(filePath).pipe(res);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname.startsWith('/api/')) {
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const match = r.regex.exec(pathname);
      if (!match) continue;
      const params = {};
      r.paramNames.forEach((name, i) => (params[name] = match[i + 1]));

      // Auth routes manage the session cookie themselves and never touch shop
      // data, so they run outside dbContext. Every other /api/ route needs a
      // signed-in shop first - that shop's database becomes `db` for the
      // duration of this one request.
      if (pathname.startsWith('/api/auth/')) {
        try {
          await r.handler(req, res, params, url.searchParams);
        } catch (err) {
          console.error(err);
          sendJson(res, 500, { error: err.message || 'Internal server error' });
        }
        return;
      }

      const ctx = currentSession(req);
      if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });

      try {
        const shopDb = getShopDb(ctx.shop.slug);
        await dbContext.run(shopDb, () => r.handler(req, res, params, url.searchParams));
      } catch (err) {
        console.error(err);
        sendJson(res, 500, { error: err.message || 'Internal server error' });
      }
      return;
    }
    return notFound(res, 'Unknown API route');
  }

  try {
    await serveStatic(req, res, pathname);
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

server.listen(PORT, () => {
  console.log(`\n  Bike Shop EPOS running at http://localhost:${PORT}\n`);
});
