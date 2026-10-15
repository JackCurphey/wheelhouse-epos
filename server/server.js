// Wheelhouse - local server, PostgreSQL-backed.
import './load-env.js';
import { createServer } from 'node:http';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { prepare, dbExec, runWithShop, pool, assertPoolerModeSafe } from './db.js';
import { work } from './workshop/state-machines.js';
import { applyEvent } from './workshop/transitions.js';
import { serializeWorkshopJob, sendQuoteResult, parseWorkingDays, currentShopToday, currentShopTimeZone } from './workshop/jobs.js';
import { resolveWorkingDays } from './capacity.js';
import {
  createRevision as createQuoteRevision,
  send as sendQuoteForApproval,
  serializeQuote,
  readQuote,
  serializeQuoteWithLines,
  listRevisions,
  withdraw as withdrawQuote,
  answerAll as answerQuote,
} from './workshop/quotes.js';
import { clientIp, isHttpsRequest } from './proxy-trust.js';
import { runMigrations } from './migrations/run-migrations.js';
import { sendJson, notFound, badRequest, readJsonBody, readRawBody, nowIso, ValidationError } from './lib/http.js';
import { serializeProduct, serializeBike } from './lib/serializers.js';
import { UPLOADS_DIR, MAX_SERIAL } from './lib/uploads.js';
import {
  serializeSale, SALE_SELECT, resolveCashierId, loadDocumentLine, createSale,
  pendingShopifyPushes, runRequestWithPushSlotCleanup, firePendingShopifyPushes,
} from './lib/sales.js';
// Tests import these from server.js; it keeps re-exporting them (split plan §4.1).
export { loadDocumentLine, createSale, pendingShopifyPushes, runRequestWithPushSlotCleanup, firePendingShopifyPushes };
import { currentSession } from './lib/session.js';
import { ROUTE_AREAS } from './routes/index.js';
import { resolveBookingLink } from './routes/portal.js';
// tests/portal-copy.test.js reads the job statuses from here.
export { JOB_STATUSES } from './routes/workshop.js';
export { serializeWorkshopService } from './routes/workshop-settings.js';
import { sendSms } from './sms.js';
import { parseStorefrontSlugCandidate, resolveStorefrontShop, getStorefrontInfo, listStorefrontProducts } from './storefront.js';
import { newLinkCode, hashLinkCode, linkPath } from './booking-link.js';
import { makeFailureLimiter } from './till/failure-limiter.js';
import { pushInventoryLevel } from './shopify.js';
import {
  getShopifyConnectionByShopId,
  decryptSecret,
  verifyShopifyWebhookHmac,
  matchOrderLineItemsToProducts,
  matchRefundLineItemsToProducts,
  claimShopifyEvent,
  markShopifyEventError,
} from './shopify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const STOREFRONT_DIR = path.join(__dirname, '..', 'public-storefront');
const WORKSHOP_HTML = path.join(PUBLIC_DIR, 'workshop.html');
const BOOK_HTML = path.join(PUBLIC_DIR, 'book.html');
const VITE_MANIFEST = path.join(PUBLIC_DIR, 'dist', '.vite', 'manifest.json');
const DEMO_FILE = path.join(__dirname, '..', 'public-demo', 'sdbdemo.html');
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

const tillAuthFailures = makeFailureLimiter(20, 60 * 1000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  // Self-hosted fonts (public/fonts/).
  '.woff2': 'font/woff2',
};

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
  routes.push({ method, pattern, regex, paramNames, handler });
}

// The table as "METHOD pattern", in registration order: what
// tests/route-list.test.js compares with its snapshot (split plan §4.1).
export function listRoutes() {
  return routes.map((r) => `${r.method} ${r.pattern}`);
}

// URL params that name a row by its SERIAL id. A malformed one - "abc", "NaN",
// "1.5", or past int4's 2147483647 - would reach Postgres and come back as a
// 500 carrying the database's own message. It names no row, so it is a 404,
// answered before any handler runs. Phase 4 screens build URLs from route
// params, where a missing param arrives as "undefined".
// :shopSlug and :deviceId are not ids and are not checked.
const ID_PARAMS = new Set(['id', 'jobId', 'lineId', 'loginId']);

function idParamsWellFormed(params) {
  for (const [name, value] of Object.entries(params)) {
    if (!ID_PARAMS.has(name)) continue;
    if (!/^[1-9][0-9]{0,9}$/.test(value) || Number(value) > MAX_SERIAL) return false;
  }
  return true;
}

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
    // ILIKE: staff type "maya" and expect "Maya Patel".
    sql += ' AND (name ILIKE ? OR email ILIKE ? OR phone ILIKE ?)';
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

// ---------- Sales ----------

route('GET', '/api/sales', async (req, res, params, query) => {
  const dateFilter = query.get('date'); // 'today' or 'YYYY-MM-DD'
  const customerId = query.get('customerId');
  const cashierId = query.get('cashierId');
  let sql = SALE_SELECT + ' WHERE 1=1';
  const args = [];
  let dateStr = null;
  if (dateFilter === 'today') dateStr = await currentShopToday();
  else if (dateFilter) dateStr = dateFilter;
  if (dateStr) {
    const day = await shopDayWindow('s.created_at', dateStr);
    sql += ` AND ${day.sql}`;
    args.push(...day.args);
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

async function processShopifyOrderWebhook(shopId, order) {
  return runWithShop(shopId, async () => {
    const claimed = await claimShopifyEvent(order.id, 'order');
    if (!claimed) return;

    const items = await matchOrderLineItemsToProducts(order);
    if (items.length === 0) return;

    try {
      // Shopify's undiscounted line-item sum. order.total_discounts (a
      // string) is the total discount Shopify already applied to the order -
      // ignoring it here would record a discounted order at its full,
      // pre-discount value in EPOS's sales history/dashboards. createSale
      // computes its own total as subtotal - discount - groupDiscount.amount
      // (groupDiscount is 0 here since customerId is null for Shopify
      // orders), so mirror that same math for the payment amount, or
      // createSale's "payments must sum to the total" validation would fail.
      const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
      const discount = Number.parseFloat(order.total_discounts) || 0;
      const payableTotal = Math.max(0, subtotal - discount);
      await createSale({
        customerId: null,
        cashierId: null,
        items,
        discount,
        cashAmount: 0,
        cardAmount: 0,
        cashTendered: null,
        payments: [{ tenderType: 'Shopify', amount: payableTotal }],
        note: `Shopify order #${order.order_number || order.id}`,
      });
    } catch (err) {
      // claimShopifyEvent above commits immediately, standalone - it isn't
      // part of a transaction with createSale. If createSale throws
      // something unexpected (not a ValidationError - a DB blip, a bug),
      // that error still needs to propagate so the outer webhook handler
      // returns a 500 and Shopify retries, but the event is already
      // irreversibly marked claimed - claimShopifyEvent would report the
      // retry as already-claimed and return without ever calling createSale
      // again, permanently dropping the order. Marking the claim as an error
      // here (regardless of which kind of failure this was) at least leaves
      // an honest, investigable record instead of the misleading default
      // status='ok' a claimed-but-never-actually-processed row would
      // otherwise carry.
      await markShopifyEventError(order.id, 'order', err.message);
      if (err instanceof ValidationError) {
        return;
      }
      throw err;
    }
  });
}

async function processShopifyRefundWebhook(shopId, refund) {
  return runWithShop(shopId, async () => {
    const claimed = await claimShopifyEvent(refund.id, 'refund');
    if (!claimed) return;

    try {
      const items = await matchRefundLineItemsToProducts(refund);
      for (const { product, qty } of items) {
        const newQty = product.stock_qty + qty;
        await db.prepare('UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ?').run(newQty, nowIso(), product.id);
        await db.prepare(
          `INSERT INTO stock_movements (product_id, change_qty, type, note) VALUES (?, ?, 'return', ?)`
        ).run(product.id, qty, `Shopify refund #${refund.id}`);
        if (product.shopify_inventory_item_id) {
          await pushInventoryLevel(product, newQty).catch((err) => console.error('Shopify inventory push failed', err));
        }
      }
    } catch (err) {
      // Same claim-before-work reasoning as processShopifyOrderWebhook above -
      // an unexpected failure here (e.g. a DB blip) must still leave an
      // honest status='error' record, not the misleading default 'ok'.
      await markShopifyEventError(refund.id, 'refund', err.message);
      throw err;
    }
  });
}

route('POST', '/api/sales', async (req, res, params, searchParams, afterRelease, shopId) => {
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
  if (!cashierResolved.ok) return badRequest(res, 'Staff member not found or inactive');
  if (cashierResolved.cashierId === null) return badRequest(res, 'Select a staff member before completing the sale');

  let saleId;
  const shopifyPushes = [];
  try {
    saleId = await createSale(
      { customerId, cashierId: cashierResolved.cashierId, items, discount, cashAmount, cardAmount, cashTendered, payments, note, sellPastStock: body.sellPastStock === true },
      { deferShopifyPushesTo: shopifyPushes }
    );
  } catch (err) {
    if (err instanceof ValidationError) return badRequest(res, err.message);
    throw err;
  }

  const sale = await db.prepare(SALE_SELECT + ' WHERE s.id = ?').get(saleId);
  const savedItems = await db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
  const savedPayments = await db.prepare('SELECT * FROM sale_payments WHERE sale_id = ?').all(saleId);
  sendJson(res, 201, serializeSale(sale, savedItems, savedPayments));
  if (afterRelease && shopifyPushes.length) {
    afterRelease.push(() => firePendingShopifyPushes(shopId, shopifyPushes));
  }
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
          lineType: it.line_type,
          serviceId: it.service_id,
          minutes: it.minutes,
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
  if (!cashierResolved.ok) return badRequest(res, 'Staff member not found or inactive');

  // Snapshot product name/sku/price only - no stock check, since a quote or
  // order can reference items that are currently out of stock.
  const loaded = [];
  for (const it of items) {
    try {
      loaded.push(await loadDocumentLine(it, { checkStock: false }));
    } catch (err) {
      if (err instanceof ValidationError) return badRequest(res, err.message);
      throw err;
    }
  }

  const subtotal = loaded.reduce((sum, line) => sum + line.lineTotal, 0);
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
    for (const line of loaded) {
      await db.prepare(
        `INSERT INTO sale_document_items (document_id, product_id, name, sku, unit_price, qty, line_total, line_type, service_id, minutes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        docId,
        line.product ? line.product.id : null,
        line.name,
        line.sku,
        line.unitPrice,
        line.qty,
        line.lineTotal,
        line.lineType,
        line.serviceId,
        line.minutes
      );
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
    try {
      loaded.push(await loadDocumentLine(it, { checkStock: false }));
    } catch (err) {
      if (err instanceof ValidationError) return badRequest(res, err.message);
      throw err;
    }
  }

  const subtotal = loaded.reduce((sum, line) => sum + line.lineTotal, 0);
  const total = Math.max(0, subtotal - discount);

  await db.exec('BEGIN');
  try {
    await db.prepare('DELETE FROM sale_document_items WHERE document_id = ?').run(id);
    for (const line of loaded) {
      await db.prepare(
        `INSERT INTO sale_document_items (document_id, product_id, name, sku, unit_price, qty, line_total, line_type, service_id, minutes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        line.product ? line.product.id : null,
        line.name,
        line.sku,
        line.unitPrice,
        line.qty,
        line.lineTotal,
        line.lineType,
        line.serviceId,
        line.minutes
      );
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

route('POST', '/api/sale-documents/:id/convert', async (req, res, params, searchParams, afterRelease, shopId) => {
  const id = Number(params.id);
  const doc = await db.prepare('SELECT * FROM sale_documents WHERE id = ?').get(id);
  if (!doc) return notFound(res, 'Not found');
  if (doc.status !== 'open') return badRequest(res, `This ${doc.kind} is already ${doc.status}`);

  // Tendering the order for a job is the shop saying the work is done, so the
  // work must already be finished or be a legal 'finish' on the work machine
  // (Jack, 8 Oct, docs/decisions/2026-10-08-paying-for-finished-work.md). If
  // it is neither, the tender is refused (Jack's decision, 20 Sep, reaffirmed
  // after a day on the other behaviour): the job record governs, and the shop
  // marks the job's real state before taking the money.
  //
  // Note the breadth. 'finish' is legal only from in_progress, so this refuses a
  // job that never started AND one that is on hold or waiting for parts. The
  // shop's way through is to move the job to where it actually is first -
  // resume, or parts-arrived - which is the point: the refusal is telling them
  // the record disagrees with what they are about to do.
  //
  // Checked HERE, before the sale is created. Refusing further down would leave
  // a real sale on the books and the job untouched, which is worse than either
  // outcome.
  let jobToFinish = null;
  let jobAlreadyFinished = null;
  if (doc.workshop_job_id) {
    jobToFinish = await db.prepare('SELECT id, work_state, version FROM workshop_jobs WHERE id = ?')
      .get(doc.workshop_job_id);
    // Work already finished ("Mark ready for collection") already says the
    // work is done, which is what the decision asks of the record: the
    // customer pays and the job is left as it is (Jack, 8 Oct). It is checked
    // again after the sale, below, in case someone reopens it in between.
    if (jobToFinish && jobToFinish.work_state === 'complete') {
      jobAlreadyFinished = jobToFinish;
      jobToFinish = null;
    }
    if (jobToFinish && !work.can(jobToFinish.work_state, 'finish')) {
      return sendJson(res, 409, {
        error: `cannot finish a job that is ${jobToFinish.work_state}; from here you can ${work.events(jobToFinish.work_state).join(', ') || 'do nothing'}`,
        code: 'illegal',
      });
    }
  }

  const body = await readJsonBody(req);
  const cashAmount = Math.max(0, Number(body.cashAmount) || 0);
  const cardAmount = Math.max(0, Number(body.cardAmount) || 0);
  const payments = Array.isArray(body.payments) ? body.payments : [];
  const cashTendered =
    body.cashTendered !== undefined && body.cashTendered !== null && body.cashTendered !== ''
      ? Number(body.cashTendered)
      : null;

  const cashierResolved = await resolveCashierId(body.cashierId);
  if (!cashierResolved.ok) return badRequest(res, 'Staff member not found or inactive');
  if (cashierResolved.cashierId === null) return badRequest(res, 'Select a staff member before completing the sale');

  const items = await db.prepare('SELECT * FROM sale_document_items WHERE document_id = ?').all(id);
  // A stored labour line has product_id NULL. Dropping line_type here (as a
  // bare {productId, qty, unitPrice} mapping used to) sends it into
  // loadDocumentLine looking like an incomplete product line, which rejects
  // it - a job with labour on its order could never be converted into a
  // sale. Carry the fields loadDocumentLine actually branches on, for both
  // line types, so a labour line survives the round trip.
  const saleItems = items.map((it) => ({
    lineType: it.line_type,
    productId: it.product_id,
    qty: it.qty,
    unitPrice: it.unit_price,
    name: it.name,
    serviceId: it.service_id,
    minutes: it.minutes,
  }));

  let saleId;
  const shopifyPushes = [];
  try {
    saleId = await createSale(
      {
        customerId: doc.customer_id,
        cashierId: cashierResolved.cashierId,
        items: saleItems,
        discount: doc.discount,
        cashAmount,
        cardAmount,
        cashTendered,
        payments,
        note: `Converted from ${doc.kind} #${doc.id}`,
      },
      { deferShopifyPushesTo: shopifyPushes }
    );
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
  let jobWarning = null;
  if (jobToFinish) {
    const finished = await applyEvent({
      jobId: jobToFinish.id,
      machine: work,
      event: 'finish',
      expectedVersion: jobToFinish.version,
    });
    // The pre-flight check above passed, so reaching here means someone moved
    // the job in between. The sale is already real and cannot be undone, so the
    // payment stands and the response says the job did not move - a silently
    // uncompleted job is exactly the ambiguity the state machines exist to
    // remove.
    if (!finished.ok) jobWarning = finished.message;
  }
  // The same race for work that was already finished at the check: if someone
  // reopened it before the sale was made, the record no longer says the work
  // is done (docs/decisions/2026-10-08-paying-for-finished-work.md). The sale
  // stands, the job is left where they put it, and the reply says so.
  if (jobAlreadyFinished) {
    const now = await db.prepare('SELECT work_state FROM workshop_jobs WHERE id = ?').get(jobAlreadyFinished.id);
    if (!now) jobWarning = 'Job not found';
    else if (now.work_state !== 'complete') {
      jobWarning = `This job changed while the payment went through: its work is now ${now.work_state}, not finished. The payment stands; check the job.`;
    }
  }

  const sale = await db.prepare(SALE_SELECT + ' WHERE s.id = ?').get(saleId);
  const savedItems = await db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
  const savedPayments = await db.prepare('SELECT * FROM sale_payments WHERE sale_id = ?').all(saleId);
  const payload = serializeSale(sale, savedItems, savedPayments);
  sendJson(res, 201, jobWarning ? { ...payload, jobWarning } : payload);
  if (afterRelease && shopifyPushes.length) {
    afterRelease.push(() => firePendingShopifyPushes(shopId, shopifyPushes));
  }
});

// ---------- Quotes ----------
// screens: quote-editor, quote-send, approved
route('GET', '/api/quotes/:id', async (req, res, params) => {
  const result = await readQuote({ quoteId: Number(params.id) });
  if (!result.ok) return notFound(res, 'Quote not found');
  sendJson(res, 200, serializeQuoteWithLines(result.quote, result.lines, result.totals));
});

// screens: quote-editor, approved, job
route('GET', '/api/workshop-jobs/:id/quotes', async (req, res, params) => {
  const rows = await listRevisions({ jobId: Number(params.id) });
  sendJson(res, 200, rows.map(serializeQuote));
});

// screens: quote-editor
route('POST', '/api/workshop-jobs/:id/quotes', async (req, res, params) => {
  const body = await readJsonBody(req);
  if (!Array.isArray(body.lines)) return badRequest(res, 'lines must be an array');
  sendQuoteResult(res, await createQuoteRevision({ jobId: Number(params.id), lines: body.lines }), 201);
});

// Approved quote lines join the job's work and parts (journey 4): a part with
// a product as that product, anything else as a labour line with its
// description. Each line records when, so it is never added twice. Refused
// (thrown as a ValidationError) when the job's order is closed.
async function addApprovedLinesToOrder(quoteId) {
  const quote = await db.prepare('SELECT * FROM workshop_quotes WHERE id = ?').get(quoteId);
  const lines = await db.prepare(
    "SELECT * FROM workshop_quote_lines WHERE workshop_quote_id = ? AND decision = 'approved' AND added_to_order_at IS NULL ORDER BY id"
  ).all(quoteId);
  if (!lines.length) return;
  const doc = await db.prepare('SELECT * FROM sale_documents WHERE workshop_job_id = ?').get(quote.workshop_job_id);
  if (!doc) throw new ValidationError('This job has no order to add the approved work to');
  if (doc.status !== 'open') throw new ValidationError(`This job's order is already ${doc.status}`);
  let added = 0;
  for (const l of lines) {
    const line = l.kind === 'part' && l.product_id
      ? await loadDocumentLine({ productId: l.product_id, qty: Math.max(1, Math.round(Number(l.quantity))), unitPrice: Number(l.unit_amount) }, { checkStock: false })
      : await loadDocumentLine({ lineType: 'labour', name: l.description, unitPrice: Number(l.quantity) * Number(l.unit_amount) }, { checkStock: false });
    await db.prepare(
      `INSERT INTO sale_document_items (document_id, product_id, name, sku, unit_price, qty, line_total, line_type, service_id, minutes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(doc.id, line.product ? line.product.id : null, line.name, line.sku, line.unitPrice, line.qty, line.lineTotal, line.lineType, line.serviceId, line.minutes);
    await db.prepare('UPDATE workshop_quote_lines SET added_to_order_at = now() WHERE id = ?').run(l.id);
    added += line.lineTotal;
  }
  await db.prepare('UPDATE sale_documents SET subtotal = subtotal + ?, total = GREATEST(0, subtotal + ? - discount), updated_at = ? WHERE id = ?')
    .run(added, added, nowIso(), doc.id);
}

// An answer and its lines joining the order happen together, or not at all.
async function answerAndAddToOrder(args) {
  await db.exec('BEGIN');
  try {
    const result = await answerQuote(args);
    if (result.ok) await addApprovedLinesToOrder(result.quote.id);
    await db.exec('COMMIT');
    return result;
  } catch (err) {
    await db.exec('ROLLBACK').catch(() => {});
    if (err instanceof ValidationError) return { ok: false, code: 'illegal', message: err.message };
    throw err;
  }
}

// The address a customer opens: APP_PUBLIC_URL when set, else the address
// the member of staff is using.
function publicBase(req) {
  return process.env.APP_PUBLIC_URL || `${isHttpsRequest(req) ? 'https' : 'http'}://${req.headers.host}`;
}

// Send (journey 4 decision 5): the quote goes to sent, the customer's booking
// link is issued afresh (only a hash of the old one is kept, so it can't be
// sent again; the old link stops working), and the link goes to them by text.
// The answer says whether the text went. The staff app's one-minute Undo
// lives in the app, which calls this only when the minute is up.
// screens: quote-send
route('POST', '/api/quotes/:id/send', async (req, res, params, query, afterRelease, shopId) => {
  const ctx = await currentSession(req);
  const result = await sendQuoteForApproval({ quoteId: Number(params.id) });
  if (!result.ok) return sendQuoteResult(res, result);
  const job = await db.prepare(
    `SELECT w.id, w.customer_id, c.name AS customer_name, c.phone, trim(b.make || ' ' || b.model) AS bike_label
       FROM workshop_jobs w LEFT JOIN customers c ON c.id = w.customer_id LEFT JOIN customer_bikes b ON b.id = w.bike_id
      WHERE w.id = ?`
  ).get(result.quote.workshop_job_id);
  const code = newLinkCode();
  await db.prepare('UPDATE workshop_jobs SET link_token_hash = ?, updated_at = ? WHERE id = ?').run(hashLinkCode(code), nowIso(), job.id);
  const { rows: [shop] } = await pool.query('SELECT slug, name FROM shops WHERE id = $1', [shopId]);
  const link = `${publicBase(req)}${linkPath(shop.slug, code)}`;
  let message;
  if (!job.customer_id) message = { status: 'not_sent', reason: 'This job has no customer.' };
  else if (!job.phone) message = { status: 'not_sent', reason: `${job.customer_name} has no phone number on file.` };
  else if (!process.env.TWILIO_ACCOUNT_SID) message = { status: 'not_sent', reason: "Texts aren't set up on this Wheelhouse yet." };
  else {
    const text = `${shop.name}: your quote for ${job.bike_label || 'your bike'} is ready. See it and choose what to go ahead with: ${link}`;
    const sent = await sendSms(job.phone, text);
    await db.prepare(
      `INSERT INTO customer_messages (customer_id, body, status, error, provider_sid, sent_by_login_id) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(job.customer_id, text, sent.ok ? 'sent' : 'failed', sent.ok ? null : sent.error, sent.ok ? sent.sid : null, ctx?.login?.id ?? null);
    message = sent.ok ? { status: 'sent' } : { status: 'failed', reason: sent.error };
  }
  sendJson(res, 200, { quote: serializeQuote(result.quote), message, link });
});

// screens: quote-send
route('POST', '/api/quotes/:id/withdraw', async (req, res, params) => {
  sendQuoteResult(res, await withdrawQuote({ quoteId: Number(params.id) }));
});

// Record their answer (journey 4 decision 4): staff, after a phone call or a
// chat in the shop. Who took it and when are recorded with each line.
// screens: approved
route('POST', '/api/quotes/:id/answer', async (req, res, params) => {
  const ctx = await currentSession(req);
  const body = await readJsonBody(req);
  if (!['phone', 'in_shop'].includes(body.via)) return badRequest(res, "via must be 'phone' or 'in_shop'");
  sendQuoteResult(res, await answerAndAddToOrder({
    quoteId: Number(params.id), decisions: body.decisions, via: body.via, loginId: ctx?.login?.id ?? null,
  }));
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
  // The capacity hold references this job, so it has to go first or the delete
  // fails on the foreign key. Deleted rather than released: a released hold is
  // a record of a slot the shop gave back, and there is no longer a booking for
  // it to be a record of.
  await db.prepare('DELETE FROM workshop_capacity_holds WHERE workshop_job_id = ?').run(id);
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
    fromCustomer: row.from_customer,
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

// ---------- Uploaded images, served to anyone ----------

// The upload routes are in server/routes/products.js (a product's photo) and
// server/routes/website.js (the shop's logo and hero image); they share
// readUploadedImage in server/lib/uploads.js.

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
// A single roster shared by the Workshop (mechanics) and the Till
// (Staff): every mechanic is an employee, but not every employee is a
// mechanic (or Staff) - isMechanic/isCashier are independent flags on
// the same person.

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

// Name/roles/working-days only - never touches login access. See the
// /api/team routes below for creating a person, and for deactivate/
// reactivate, which also has to cascade to their login when they have one.
route('PUT', '/api/employees/:id', async (req, res, params) => {
  const id = Number(params.id);
  const existing = await db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Employee not found');
  const body = await readJsonBody(req);
  const name = body.name !== undefined ? String(body.name).trim() : existing.name;
  if (!name) return badRequest(res, 'Employee name is required');
  const isMechanic = body.isMechanic !== undefined ? (body.isMechanic ? 1 : 0) : existing.is_mechanic;
  const isCashier = body.isCashier !== undefined ? (body.isCashier ? 1 : 0) : existing.is_cashier;
  const workingDays = resolveWorkingDays(body.workingDays, existing.working_days);
  if (workingDays === null) return badRequest(res, 'workingDays must be an array of day numbers (0-6)');
  await db.prepare(
    'UPDATE employees SET name = ?, is_mechanic = ?, is_cashier = ?, working_days = ?, updated_at = ? WHERE id = ?'
  ).run(name, isMechanic, isCashier, workingDays, nowIso(), id);
  const row = await db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  sendJson(res, 200, serializeEmployee(row));
});

// ---------- The shop's day ----------

// A timestamp column's rows on one of the shop's days (YYYY-MM-DD): midnight
// to midnight on the shop's clock, summer time included, not UTC midnight.
// Returns the SQL condition and its four arguments.
async function shopDayWindow(column, date) {
  const timeZone = await currentShopTimeZone();
  return {
    sql: `${column} >= (?::date)::timestamp AT TIME ZONE ? AND ${column} < (?::date + 1)::timestamp AT TIME ZONE ?`,
    args: [date, timeZone, date, timeZone],
  };
}

// ---------- Dashboard ----------

route('GET', '/api/dashboard', async (req, res) => {
  const today = await shopDayWindow('created_at', await currentShopToday());
  const todayAgg = await db
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS total
       FROM sales WHERE ${today.sql}`
    )
    .get(...today.args);

  const lowStock = (await db
    .prepare(
      `SELECT * FROM products WHERE active = 1 AND low_stock_threshold > 0 AND stock_qty <= low_stock_threshold
       ORDER BY stock_qty ASC`
    )
    .all())
    .map(serializeProduct);

  const todayItems = await shopDayWindow('s.created_at', await currentShopToday());
  const topToday = await db
    .prepare(
      `SELECT si.name, SUM(si.qty) AS qty, SUM(si.line_total) AS revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE ${todayItems.sql}
       GROUP BY si.name
       ORDER BY revenue DESC
       LIMIT 5`
    )
    .all(...todayItems.args);

  sendJson(res, 200, {
    todayCount: todayAgg.count,
    todayTotal: todayAgg.total,
    lowStock,
    topToday,
  });
});

// The customer's whole answer in one call - every line's yes or no, then
// approve - so a quote with many lines doesn't run into the link's limit on
// attempts. The revision is the one their page showed.
// screens: approval, approval-done, stale
route('POST', '/api/portal/:shopSlug/booking-links/:code/quote/answer', async (req, res, params) => {
  const found = await resolveBookingLink(req, res, params.code);
  if (!found) return;
  const body = await readJsonBody(req);
  if (!Number.isInteger(body.revision)) return badRequest(res, 'revision is required - send the revision your page showed');
  // The quote their page showed, by its revision; answerAll refuses it if a
  // newer revision exists or it is no longer open (canApprove).
  const shown = await db.prepare('SELECT id FROM workshop_quotes WHERE workshop_job_id = ? AND revision = ?').get(found.id, body.revision);
  if (!shown) return notFound(res, 'There is no quote for this booking');
  sendQuoteResult(res, await answerAndAddToOrder({
    quoteId: shown.id, jobId: found.id, decisions: body.decisions, via: 'online', linkRevision: body.revision,
  }));
});

// The route areas already moved to server/routes/ (split plan §4.1), in
// the fixed order of server/routes/index.js.
for (const area of ROUTE_AREAS) area.register(route);

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
  // The fallback above assumes baseDir itself has an index.html - if the
  // whole directory is missing (a deploy/packaging gap, e.g. a static
  // bundle never copied into the image) that assumption fails too. Without
  // this check, createReadStream() below fails asynchronously and - since
  // nothing else on this stream listens for 'error' - Node's default
  // behavior for an unhandled 'error' event is to crash the entire
  // process, taking down every shop, not just this one request.
  if (!existsSync(filePath)) {
    return notFound(res);
  }
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';
  // Without an explicit header here, any CDN or caching proxy in front of
  // this app falls back to its own default caching for static-looking
  // extensions (a 4-hour TTL was observed in practice) - fine for a
  // CDN-fronted site with a build/version pipeline, but most of what this app
  // serves deploys straight from source with no cache-busted filenames, so a
  // cached JS/CSS bundle can silently outlive the code it's stale against.
  // Those files stay 'no-store': correctness beats any caching win.
  //
  // The one exception is /dist/assets/, which holds Vite's build output.
  // Every filename there carries a hash of the file's own contents, so a
  // change produces a new URL and a cached copy can never be stale - the
  // exact reason 'no-store' exists doesn't apply. Scoped to assets/
  // specifically: anything else under dist (the manifest, or a stray unhashed
  // file) must not be pinned in browsers for a year.
  //
  // Decided on the RESOLVED filePath, not the request path: the index.html
  // fallback above can turn a /dist/... request into index.html, which is not
  // hashed and must not be cached.
  const distRoot = path.join(baseDir, 'dist') + path.sep;
  const isHashedBuildOutput = filePath.startsWith(path.join(distRoot, 'assets'));
  const cacheControl = isHashedBuildOutput
    ? 'public, max-age=31536000, immutable'
    : 'no-store';
  res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': cacheControl });
  const stream = createReadStream(filePath);
  // Defense in depth beyond the existsSync check above (e.g. a permissions
  // error, or the file disappearing between the check and the read) -
  // same reasoning: an unhandled stream 'error' event crashes the process.
  stream.on('error', (err) => {
    console.error('serveStatic stream error', err);
    res.destroy();
  });
  stream.pipe(res);
}

// Either React app's entry tags. Vite content-hashes its output, so the
// entry filename is not knowable at author time - it is read from the manifest
// Vite writes into the bundle. Read per request rather than cached: the file is
// small, no shop is live on this page yet, and a cache would serve a deleted
// filename after a rebuild until the process restarts.
//
// public/dist is untracked, so a fresh checkout has no manifest until a build.
// The request answers 500 either way; this error is what the server log shows,
// so a missing file says what to run rather than a bare ENOENT.
export async function appEntryTags(entryKey, manifestPath = VITE_MANIFEST) {
  let raw;
  try {
    raw = await readFile(manifestPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`no app build at ${manifestPath} - run npm run build`, { cause: err });
    }
    throw err;
  }
  const manifest = JSON.parse(raw);
  const entry = manifest[entryKey];
  if (!entry) throw new Error(`vite manifest has no ${entryKey} entry - run npm run build`);
  // Vite hoists shared CSS onto a shared chunk once there is more than one
  // entry point, so the entry's own `css` list can be empty while a chunk it
  // `imports` carries the stylesheet - so every chunk reachable via `imports`
  // has to be walked (depth-first, dependencies' css before the entry's own,
  // matching Vite's own HTML output), not just the entry itself. `imports`
  // are keys back into this same manifest (Vite's documented shape); a key
  // that isn't present, or a cycle, is skipped rather than throwing, since a
  // manifest is generated output and this is a display concern, not a build
  // integrity check.
  const cssHrefs = [];
  const seenHrefs = new Set();
  const visitedKeys = new Set();
  const visit = (key) => {
    if (visitedKeys.has(key)) return;
    visitedKeys.add(key);
    const chunk = manifest[key];
    if (!chunk) return;
    for (const importKey of chunk.imports || []) visit(importKey);
    for (const href of chunk.css || []) {
      if (seenHrefs.has(href)) continue;
      seenHrefs.add(href);
      cssHrefs.push(href);
    }
  };
  visit(entryKey);
  const css = cssHrefs.map((href) => `<link rel="stylesheet" href="/dist/${href}" />`).join('\n  ');
  return `${css}\n  <script type="module" src="/dist/${entry.file}"></script>`;
}

// One of the React apps' pages: its HTML with the entry's tags put in. Every
// address the app's router owns gets this same page, so a link opened cold
// reaches its screen. No build means a 500 that says so, not a blank page.
// The response body is a fixed string - the real error (which can include an
// absolute manifest path) goes to the server log only, never to the visitor.
async function serveAppPage(res, htmlPath, entryKey, label) {
  try {
    const [html, tags] = await Promise.all([readFile(htmlPath, 'utf8'), appEntryTags(entryKey)]);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(html.replace('<!--WH_ENTRY-->', tags));
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(`${label} bundle not built - see the server log`);
  }
}

async function handleStorefrontRequest(req, res, pathname, shop) {
  if (pathname === '/api/storefront/info' && req.method === 'GET') {
    return sendJson(res, 200, await getStorefrontInfo(shop));
  }
  if (pathname === '/api/storefront/products' && req.method === 'GET') {
    return sendJson(res, 200, await listStorefrontProducts());
  }
  // On a subdomain-hosted website (<slug>.wheelhouseepos.com),
  // parseStorefrontSlugCandidate matches every path on that host, not just
  // storefront-specific ones - so requests for uploaded images and the
  // customer booking app have to be forwarded to their real handlers here
  // instead of falling through to the website's own static bundle below
  // (whose serveStatic fallback would otherwise return the website's
  // index.html for these paths instead of the actual image or booking app
  // page). The caller (the request dispatcher) already wraps this whole
  // call in a try/catch, so errors from these forwarded calls propagate up
  // to that handler.
  if (pathname.startsWith('/api/uploaded-images/')) {
    return serveUploadedImage(req, res, pathname.slice('/api/uploaded-images/'.length));
  }
  if (pathname === '/book' || pathname.startsWith('/book/')) {
    // A website books for its own shop only. Another shop's slug gets the
    // same answer as an unknown website, so it says nothing about that shop.
    const bookSlug = pathname.split('/')[2];
    if (bookSlug && bookSlug !== shop.slug) return notFound(res, 'Storefront not found');
    return serveAppPage(res, BOOK_HTML, 'src/customer/main.tsx', 'book');
  }
  const storePrefix = `/store/${shop.slug}`;
  // The website's HTML references its CSS/JS with relative hrefs, which
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

// Steady-state health, not boot health: the boot chain already runs
// runMigrations() then assertPoolerModeSafe() before the server ever starts
// listening, so a container that reports "up" has already proven the
// database was reachable once. That says nothing about a minute later - a
// dropped connection, a full pool, or Postgres going away after boot leaves
// the process listening and accepting connections while every real request
// fails. Takes a fresh query on every call (never cached) so /healthz always
// reflects the database's condition right now, not at startup.
export async function checkDatabaseHealth(targetPool = pool) {
  try {
    await targetPool.query('SELECT 1');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err };
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  // Deliberately ahead of every other branch: an orchestrator's health probe
  // must never be mistaken for a shop/storefront route (and must never wait
  // on shop resolution), and must never be satisfied by the generic static
  // fallback at the bottom of this dispatcher - that's exactly the docker-
  // compose bug this replaces (GETting `/`, which serves index.html off disk
  // and passes with Postgres completely down).
  if (pathname === '/healthz') {
    const health = await checkDatabaseHealth();
    if (health.ok) return sendJson(res, 200, { status: 'ok' });
    console.error('Health check failed: database unreachable', health.error);
    return sendJson(res, 503, { status: 'error', error: 'Database unreachable' });
  }

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

  if (pathname.startsWith('/webhooks/shopify/')) {
    const match = pathname.match(/^\/webhooks\/shopify\/(\d+)\/(orders|refunds)$/);
    if (!match) return notFound(res, 'Unknown webhook route');
    const shopId = Number(match[1]);
    const kind = match[2];

    // The whole branch - including the connection lookup and signature
    // verification, not just order/refund processing at the bottom - is
    // wrapped in one try/catch, matching every other branch in this
    // dispatcher (see the website and /api/uploaded-images/ branches
    // above). Without this, an unhandled rejection from e.g. a DB blip on
    // getShopifyConnectionByShopId, or a GCM auth failure from decryptSecret,
    // would propagate out of this async dispatcher callback uncaught -
    // there's no process.on('unhandledRejection') handler anywhere in this
    // codebase, so on Node's default behavior that crashes the entire
    // process, taking down every shop, for a route reachable by an
    // unauthenticated caller with a guessable shopId.
    try {
      let rawBody;
      try {
        rawBody = await readRawBody(req);
      } catch (err) {
        return badRequest(res, 'Invalid request body');
      }

      // shopify_connections has FORCE ROW LEVEL SECURITY, so it can only be
      // read correctly from inside a runWithShop context for the exact shop
      // being queried (the website framework plan's final review found
      // this same bug class in resolveStorefrontShop - a bare pool/prepare
      // call against an RLS-protected table outside runWithShop either
      // throws on a connection that's never set app.current_shop_id, or
      // reads a stale different shop's session value). Unlike that case,
      // shopId is already known here from the URL, so there's no chicken-
      // and-egg problem - just enter the context immediately.
      const connection = await runWithShop(shopId, () => getShopifyConnectionByShopId(shopId));
      if (!connection) return notFound(res, 'Unknown shop');

      const hmacHeader = req.headers['x-shopify-hmac-sha256'];
      if (!verifyShopifyWebhookHmac(rawBody, hmacHeader, decryptSecret(connection.webhook_secret))) {
        return sendJson(res, 401, { error: 'Invalid signature' });
      }

      let payload;
      try {
        payload = JSON.parse(rawBody.toString('utf8'));
      } catch (err) {
        return badRequest(res, 'Invalid JSON body');
      }

      if (kind === 'orders') {
        await processShopifyOrderWebhook(shopId, payload);
      } else {
        await processShopifyRefundWebhook(shopId, payload);
      }
      sendJson(res, 200, { ok: true });
    } catch (err) {
      console.error('Shopify webhook processing failed', err);
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

  // Tills authenticate with a bearer token, not a cookie: a till is a
  // registered device that must keep working across an outage, so its
  // credential never expires (switching the till off withdraws it). The shop
  // comes from :shopSlug, as for portal routes; the token is then looked up
  // inside that shop's RLS scope, so another shop's token reads as unknown.
  if (pathname.startsWith('/api/till/')) {
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const match = r.regex.exec(pathname);
      if (!match) continue;
      const params = {};
      r.paramNames.forEach((name, i) => (params[name] = match[i + 1]));
      if (!idParamsWellFormed(params)) return notFound(res);

      // The token is checked FIRST. A till presenting a valid, active token
      // is always served - even while its address + shop key is blocked - so
      // a guesser (or a dead neighbouring till with a stale token) sharing
      // its address can never lock a working till out. The limiter
      // (server/till/failure-limiter.js, keyed on address + shop slug) is
      // consulted only when the lookup fails: missing or malformed token,
      // unknown shop, or no active till with that token. Then a blocked key
      // gets 429 (and the failure is not counted again), otherwise the
      // failure is counted and the answer is 401. A good token clears the
      // count only when the key is not already blocked, so a till's own
      // traffic cannot lift a block that guessers earned.
      const key = `${clientIp(req)}|${params.shopSlug}`;
      const refuse = () => {
        if (tillAuthFailures.isBlocked(key)) return sendJson(res, 429, { error: 'Too many attempts - try again in a minute' });
        tillAuthFailures.recordFailure(key);
        sendJson(res, 401, { error: 'Till not recognised' });
      };
      const header = req.headers.authorization || '';
      const token = /^Bearer ([0-9a-f]{64})$/.exec(header)?.[1];
      if (!token) return refuse();

      try {
        const { rows: [shop] } = await pool.query('SELECT * FROM shops WHERE slug = $1', [params.shopSlug]);
        if (!shop) return refuse();

        await runWithShop(shop.id, async () => {
          const till = await db.prepare('SELECT * FROM tills WHERE token_hash = ? AND active = true').get(hashLinkCode(token));
          if (!till) return refuse();
          if (!tillAuthFailures.isBlocked(key)) tillAuthFailures.clear(key);
          await r.handler(req, res, params, url.searchParams, till);
        });
      } catch (err) {
        console.error(err);
        if (!res.headersSent) sendJson(res, 500, { error: err.message || 'Internal server error' });
      }
      return;
    }
    return notFound(res, 'Unknown till route');
  }

  if (pathname.startsWith('/api/portal/')) {
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const match = r.regex.exec(pathname);
      if (!match) continue;
      const params = {};
      r.paramNames.forEach((name, i) => (params[name] = match[i + 1]));
      if (!idParamsWellFormed(params)) return notFound(res);

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
      if (!idParamsWellFormed(params)) return notFound(res);

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

      // A handler that needs work done AFTER its pooled client goes back to
      // the pool (currently: firing Shopify inventory pushes queued by
      // createSale's deferShopifyPushesTo - see the comment there) pushes a
      // callback onto this array instead of running that work itself while
      // still inside runWithShop. It is only read below once the
      // `runWithShop` call has fully resolved, which cannot happen until its
      // `finally` has already released the client back to the pool - so
      // anything queued here is guaranteed to run without holding one of the
      // ten pooled connections across it.
      const afterRelease = [];
      try {
        // runRequestWithPushSlotCleanup (see registerPendingShopifyPushSlot's
        // comment) settles any pendingShopifyPushes slot this request
        // registered at commit time if the request itself fails anywhere in
        // its own tail, before ever reaching the afterRelease loop below.
        await runRequestWithPushSlotCleanup(() =>
          runWithShop(ctx.shop.id, () => r.handler(req, res, params, url.searchParams, afterRelease, ctx.shop.id))
        );
      } catch (err) {
        console.error(err);
        sendJson(res, 500, { error: err.message || 'Internal server error' });
        return;
      }
      for (const work of afterRelease) {
        try {
          work();
        } catch (err) {
          console.error('Post-release work failed', err);
        }
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

  // The React workshop app. Every path under /workshop gets the same page,
  // because the client-side router owns those URLs: a browser opening
  // /workshop/<anything> directly must get this page, not the old app's
  // index.html that the static fallback below would hand it.
  if (pathname === '/workshop' || pathname.startsWith('/workshop/')) {
    await serveAppPage(res, WORKSHOP_HTML, 'src/staff/main.tsx', 'workshop');
    return;
  }

  // The React customer app (src/customer/). Every path under /book gets the
  // same page because its router owns those addresses, including the private
  // link /book/<slug>/booking/<code>. The old public-portal/ page is no longer
  // served (J1, changed 25 Sep).
  if (pathname === '/book' || pathname.startsWith('/book/')) {
    await serveAppPage(res, BOOK_HTML, 'src/customer/main.tsx', 'book');
    return;
  }

  try {
    await serveStatic(req, res, pathname, PUBLIC_DIR);
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

// ---------- Graceful shutdown ----------

// How long a rolling deploy's SIGTERM waits for requests already in flight
// (a till mid-transaction, a slow Shopify push-with-retry) to finish on their
// own before the process gives up and exits anyway. Bounded deliberately: an
// orchestrator's own "give up and SIGKILL" timeout is typically 10-30s, and
// exiting cleanly one second before that beats being SIGKILLed mid-write.
const SHUTDOWN_GRACE_MS = 10_000;

// Printed once, as soon as the signal handlers are installed. Exported so the
// lifecycle test matches on the same string this prints rather than a copy of
// it that can drift.
export const SIGNALS_READY = 'Boot: signal handlers installed';

let shuttingDown = false;

// Critical 2: signal handlers are installed before server.listen (see the
// isMainModule block below), so a SIGTERM/SIGINT can land while the boot
// chain (runMigrations, assertPoolerModeSafe) is still running and the HTTP
// server has never listened. Without this flag, gracefulShutdown would call
// httpServer.close() on a server that was never started (a synchronous
// ERR_SERVER_NOT_RUNNING from Node, logged as "Error while closing the HTTP
// server") AND set shuttingDown before the still-running boot chain's own
// pool.end()-adjacent work runs - so a pooler probe mid-flight on the same
// pool then fails with "Cannot use a pool after calling end on the pool",
// and the boot chain's catch block logs a false "Database startup checks
// failed", even though nothing about the database ever failed. This matters
// most for a rolling deploy scaling a replica down while it's still waiting
// on another replica's migration advisory lock - exactly the multi-replica
// cold start that lock exists to make safe.
let serverListening = false;

// Waits for every currently-tracked deferred Shopify push to settle
// (success or failure - either way it's done with the pool). Re-checks the
// set after each round rather than snapshotting once, in case a push that
// was itself still in the middle of starting adds a sibling before this
// resolves. Deliberately has no timeout of its own: the caller's own
// forceExit timer already bounds the ENTIRE shutdown (this wait included),
// so a wedged push cannot hold the process open past that - it just means
// the process exits via the force-exit path instead of the clean one.
async function waitForPendingShopifyPushes(pendingPushes) {
  while (pendingPushes.size > 0) {
    await Promise.allSettled([...pendingPushes]);
  }
}

// Exported so tests can drive it directly against a fake server/pool without
// spawning a real process for every assertion; production only ever calls it
// through the SIGTERM/SIGINT listeners below.
export function gracefulShutdown(signal, {
  httpServer = server,
  dbPool = pool,
  graceMs = SHUTDOWN_GRACE_MS,
  exit = process.exit,
  pendingPushes = pendingShopifyPushes,
  // Only the real production httpServer (the default) is gated on the
  // module-level serverListening flag - tests inject their own fake
  // httpServer objects to drive the drain/force-exit paths directly and
  // don't model a pre-listen state at all, so a fake httpServer is always
  // treated as already listening.
  isListening = () => (httpServer === server ? serverListening : true),
} = {}) {
  if (shuttingDown) return;
  shuttingDown = true;

  // A signal landing before server.listen()'s callback has fired means
  // there is no HTTP server to close and no pool activity belonging to
  // this shutdown path - the boot chain (runMigrations,
  // assertPoolerModeSafe) is still using the pool itself. Exit clean and
  // immediately, touching neither the HTTP server nor the pool: setting
  // `shuttingDown` above is what keeps the still-running boot chain's own
  // failure path quiet (see the isMainModule .catch below), and returning
  // here rather than falling through avoids the false
  // ERR_SERVER_NOT_RUNNING / "Cannot use a pool after calling end" pair a
  // real run of this scenario produced.
  if (!isListening()) {
    console.log(`${signal} received before the server started listening - exiting cleanly`);
    exit(0);
    return;
  }

  console.log(`${signal} received - closing the HTTP server, waiting up to ${graceMs}ms for in-flight requests to finish`);

  const forceExit = setTimeout(() => {
    console.error(`Shutdown grace period (${graceMs}ms) elapsed with requests still in flight - forcing exit`);
    exit(1);
  }, graceMs);
  // The force-exit timer must never be the reason the process stays alive -
  // only in-flight work should do that.
  forceExit.unref();

  httpServer.close((err) => {
    if (err) console.error('Error while closing the HTTP server', err);
    // A sale that completed just as the signal landed can still have a
    // deferred Shopify push in flight, opened on its OWN pooled client after
    // the sale's own client was already released (see
    // firePendingShopifyPushes in lib/sales.js) - draining HTTP connections says
    // nothing about that. Wait for it before ending the pool, or pg refuses
    // its connect() with the pool already ended and the push dies silently.
    waitForPendingShopifyPushes(pendingPushes)
      .then(() => dbPool.end())
      .catch((poolErr) => console.error('Error while closing the database pool', poolErr))
      .finally(() => {
        clearTimeout(forceExit);
        exit(err ? 1 : 0);
      });
  });

  // A keep-alive socket sitting idle (no request in flight on it) would
  // otherwise hold server.close()'s callback open indefinitely, since Node
  // only fires it once every connection - including idle ones - has closed.
  // Idle connections have nothing to drain, so cut them immediately; a
  // connection with a request actually in flight is untouched by this call
  // and is left to finish within the grace period above.
  httpServer.closeIdleConnections?.();
}

// ---------- Crash guard ----------

// Several comments elsewhere in this file (the Shopify webhook branch, the
// website branch, etc.) individually wrap their own async work in
// try/catch specifically because, until now, nothing caught a rejection that
// slipped past all of them - Node's default behaviour for an unhandled
// rejection or an uncaught synchronous throw is to crash the whole process
// immediately, taking every shop down with it, with no log line explaining
// why. This does not try to keep serving after either kind of error: a
// process whose state is unknown (a client that may never have been
// released, an in-flight transaction of uncertain status) is worse than one
// that exits and lets the orchestrator start a clean one.
//
// Deliberately NOT coordinated with gracefulShutdown's `shuttingDown` flag:
// an uncaught error that lands while a drain is already in progress (a bug
// in some OTHER, unrelated in-flight request, say) exits immediately here
// rather than letting the rest of the grace period run out first, which
// truncates it for every other still-draining request. That is an accepted
// cost under the same reasoning as above, not an oversight - a process that
// has just proven its own state is unknown by throwing uncaught is not one
// this codebase trusts to finish draining correctly either.
export function installCrashGuard({ exit = process.exit } = {}) {
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Fatal: unhandled promise rejection - exiting so the process supervisor can restart clean', {
      reason,
      promise,
    });
    exit(1);
  });
  process.on('uncaughtException', (err, origin) => {
    console.error(`Fatal: uncaught exception (${origin}) - exiting so the process supervisor can restart clean`, err);
    exit(1);
  });
}

// This module exports functions (serializeX, etc.) that test files import
// directly. Without this guard, every test file that imports server.js would
// also run this migrate-and-listen chain and boot a real HTTP server -
// one listener per test file, all fighting over the same port and holding
// the event loop open forever. Only start the server when this file is the
// entry point actually being run (node server/server.js / npm start), not
// when it's merely imported for its exports.
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  installCrashGuard();
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  // Announced because "this process can now shut down cleanly" is a real thing
  // to know during a rolling deploy: before this line the process dies on
  // SIGTERM with the default disposition, and nothing else says when that
  // window closes. It cannot be closed entirely - ES module evaluation runs
  // before any code here - so the honest answer is to say when it ended rather
  // than to pretend it does not exist. tests/server-lifecycle.test.js waits for
  // this instead of guessing a delay; it used to sleep 120ms, which sat in a
  // ~78ms gap between module evaluation finishing and the server listening, and
  // lost the race on a slower machine.
  // Same treatment as SIGTERM so Ctrl+C locally behaves consistently with a
  // real rolling deploy rather than Node's raw default (immediate exit).
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  console.log(SIGNALS_READY);

  runMigrations()
    // Session-scoped tenancy (the DB_TENANT_SCOPE default) is only safe on a
    // direct connection or a session-mode pooler. Put a transaction-mode
    // pooler in front of this and one shop's request can be served on a
    // connection still carrying another shop's tenant - so check once, here,
    // rather than discover it in production. See server/db.js.
    .then(() => assertPoolerModeSafe())
    .then(() => mkdir(UPLOADS_DIR, { recursive: true }))
    .then(() => {
      server.listen(PORT, () => {
        serverListening = true;
        console.log(`\n  Wheelhouse running at http://localhost:${PORT}\n`);
      });
    })
    .catch((err) => {
      // A signal that landed pre-listen already called gracefulShutdown's
      // own clean exit(0) path above (see the `!isListening()` branch) and
      // set `shuttingDown` before this boot chain's own pool use (e.g.
      // probePoolerMode) could fail as a side effect of that shutdown. Stay
      // quiet here in that case - the real cause is an intentional
      // shutdown, not a database failure, and process.exit(0) has already
      // been called or is about to win the race.
      if (shuttingDown) return;
      console.error('Database startup checks failed - server not started.');
      console.error(err);
      process.exit(1);
    });
}
