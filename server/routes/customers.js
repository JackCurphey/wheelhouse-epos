// Customers, their groups and their bikes: /api/customers, /api/customer-groups
// and /api/bikes, with the helpers only they use. Staff routes: they run under
// the dispatcher's /api/ branch (server.js), so a handler gets (req, res,
// params, query, afterRelease, shopId) with the shop's row-level security
// already bound, and needs a staff session. Mark's file. Moved out of
// server.js unchanged (split plan §4.1, WP-0.4).
import { prepare, dbExec } from '../db.js';
import { badRequest, notFound, nowIso, readJsonBody, sendJson } from '../lib/http.js';
import { serializeBike } from '../lib/serializers.js';
import { SALE_SELECT, serializeSale } from '../lib/sales.js';
import { serializeWorkshopJob } from '../workshop/jobs.js';

// The same shim server.js uses: each call reads the request's client.
const db = { prepare, exec: dbExec };

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

// ---------- Customer bikes ----------

export function register(route) {
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
}
