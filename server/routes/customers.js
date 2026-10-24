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
import { TEMPLATES } from '../messaging/templates.js';
import { shopToday } from '../clock.js';

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

// A UK number however it's written: +44 7700 900142, 0044 7700 900142 and
// 07700 900142 are the same number (review), as digits from 0.
const ukNumber = (d) => (d.startsWith('0044') ? `0${d.slice(4)}` : d.startsWith('44') && d.length === 12 ? `0${d.slice(2)}` : d);
const UK_NUMBER_SQL = `(CASE WHEN regexp_replace(coalesce(c.phone, ''), '\\D', '', 'g') LIKE '0044%' THEN '0' || substr(regexp_replace(coalesce(c.phone, ''), '\\D', '', 'g'), 5)
  WHEN regexp_replace(coalesce(c.phone, ''), '\\D', '', 'g') LIKE '44%' AND length(regexp_replace(coalesce(c.phone, ''), '\\D', '', 'g')) = 12 THEN '0' || substr(regexp_replace(coalesce(c.phone, ''), '\\D', '', 'g'), 3)
  ELSE regexp_replace(coalesce(c.phone, ''), '\\D', '', 'g') END)`;

// The address, postcode and offers (cs-add): optional text, trimmed, blank
// as none; offers true or false. Absent keeps what's there.
function customerExtras(body, existing) {
  const text = (key, column, max) => {
    if (body[key] === undefined) return { value: existing[column] ?? null };
    if (body[key] !== null && typeof body[key] !== 'string') return { error: `${key} must be text` };
    const t = (body[key] ?? '').trim();
    if (t.length > max) return { error: `${key} can be up to ${max} characters` };
    return { value: t || null };
  };
  const address = text('address', 'address', 300);
  const postcode = text('postcode', 'postcode', 12);
  for (const r of [address, postcode]) if (r.error) return { error: r.error };
  if (body.marketingPermission !== undefined && typeof body.marketingPermission !== 'boolean') return { error: 'marketingPermission must be true or false' };
  const marketing = body.marketingPermission === undefined ? (existing.marketing_permission ? 1 : 0) : (body.marketingPermission ? 1 : 0);
  return { address: address.value, postcode: postcode.value, marketing };
}

function serializeCustomer(row, groups) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    // Add a customer (cs-add; migration 067, and 025 for offers).
    address: row.address ?? null,
    postcode: row.postcode ?? null,
    marketingPermission: row.marketing_permission === 1 || row.marketing_permission === true,
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

export function register(route) {
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

  // Recent customers (cs-list; customer service review 12): the latest of
  // their own change, newest job and newest sale, with their newest bike.
  // screens: customers
  route('GET', '/api/recent-customers', async (req, res) => {
    const rows = await db.prepare(
      `SELECT c.*, (SELECT NULLIF(trim(coalesce(b.make, '') || ' ' || coalesce(b.model, '')), '') FROM customer_bikes b
                     WHERE b.customer_id = c.id ORDER BY b.created_at DESC, b.id DESC LIMIT 1) AS bike_label,
              GREATEST(c.updated_at::timestamptz, c.created_at::timestamptz,
                       (SELECT max(w.created_at) FROM workshop_jobs w WHERE w.customer_id = c.id),
                       (SELECT max(s.created_at::timestamptz) FROM sales s WHERE s.customer_id = c.id)) AS seen_at
         FROM customers c WHERE c.active = 1
        ORDER BY seen_at DESC NULLS LAST, c.id DESC LIMIT 25`
    ).all();
    sendJson(res, 200, rows.map((r) => ({ ...serializeCustomer(r), bikeLabel: r.bike_label ?? null })));
  });

  // A possible match while adding (cs-add-match; customer service review 5):
  // the same phone number, whatever its spaces, or the same email, active only.
  // screens: customers
  route('GET', '/api/customer-matches', async (req, res, params, query) => {
    const digits = ukNumber((query.get('phone') ?? '').replace(/\D/g, ''));
    const email = (query.get('email') ?? '').trim().toLowerCase();
    const byPhone = digits || null;
    const byEmail = email.includes('@') ? email : null;
    if (!byPhone && !byEmail) return sendJson(res, 200, []);
    const rows = await db.prepare(
      `SELECT c.*, (SELECT NULLIF(trim(coalesce(b.make, '') || ' ' || coalesce(b.model, '')), '') FROM customer_bikes b
                     WHERE b.customer_id = c.id ORDER BY b.created_at DESC, b.id DESC LIMIT 1) AS bike_label
         FROM customers c
        WHERE c.active = 1 AND ((?::text IS NOT NULL AND ${UK_NUMBER_SQL} = ?::text)
                             OR (?::text IS NOT NULL AND lower(trim(coalesce(c.email, ''))) = ?::text))
        ORDER BY c.id LIMIT 5`
    ).all(byPhone, byPhone, byEmail, byEmail);
    sendJson(res, 200, rows.map((r) => ({ ...serializeCustomer(r), bikeLabel: r.bike_label ?? null })));
  });

  route('GET', '/api/customers/:id', async (req, res, params) => {
    const id = Number(params.id);
    const row = await db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!row) return notFound(res, 'Customer not found');
    sendJson(res, 200, serializeCustomer(row, await groupsForCustomer(row.id)));
  });

  // A customer's page: one history of their jobs, sales and messages, newest
  // first (cs-page; customer service review 12). A job is open while its
  // booking stands and the bike isn't collected (walk-through 9 L5).
  // screens: customers
  route('GET', '/api/customers/:id/history', async (req, res, params) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1 || id > 2_147_483_647) return notFound(res, 'Customer not found');
    const customer = await db.prepare('SELECT id FROM customers WHERE id = ?').get(id);
    if (!customer) return notFound(res, 'Customer not found');
    // A job's day and time are the shop's, so its moment is read in the shop's time zone (review).
    const zone = (await db.prepare('SELECT time_zone FROM workshop_settings LIMIT 1').get())?.time_zone || 'Europe/London';
    const today = shopToday(zone);
    const jobs = await db.prepare(
      `SELECT w.id, w.reference, w.title, w.job_date, w.start_time, w.booking_state, w.custody_state, w.work_state, w.created_at, e.name AS mechanic_name,
              CASE WHEN w.job_date IS NULL THEN w.created_at
                   ELSE ((w.job_date::text || ' ' || coalesce(NULLIF(w.start_time, ''), '00:00'))::timestamp AT TIME ZONE ?) END AS at
         FROM workshop_jobs w LEFT JOIN employees e ON e.id = w.mechanic_id WHERE w.customer_id = ?`
    ).all(zone, id);
    const sales = await db.prepare(
      `SELECT s.id, s.created_at, s.total,
              (SELECT string_agg(CASE WHEN i.qty > 1 THEN i.name || ' × ' || i.qty ELSE i.name END, ', ' ORDER BY i.id) FROM sale_items i WHERE i.sale_id = s.id) AS what
         FROM sales s WHERE s.customer_id = ?`
    ).all(id);
    const messages = await db.prepare(
      `SELECT id, template_key, channel, to_address, coalesce(sent_at, created_at) AS at FROM customer_messages
        WHERE customer_id = ? AND coalesce(direction, 'outbound') = 'outbound' AND intent_state <> 'undone'`
    ).all(id);
    const iso = (v) => new Date(v).toISOString();
    const items = [
      ...jobs.map((j) => ({
        kind: 'job', id: j.id, reference: j.reference, title: j.title, jobDate: j.job_date, startTime: j.start_time,
        bookingState: j.booking_state, custodyState: j.custody_state, workState: j.work_state, mechanicName: j.mechanic_name ?? null,
        // Open while the booking stands and the bike isn't collected; a bike never
        // booked in whose day has gone isn't (a no-show, review).
        open: !['cancelled', 'declined', 'expired'].includes(j.booking_state) && j.custody_state !== 'collected'
          && !(j.custody_state === 'expected' && j.job_date && j.job_date < today),
        at: iso(j.at),
      })),
      ...sales.map((x) => ({ kind: 'sale', id: x.id, total: Number(x.total), what: x.what ?? '', at: iso(x.created_at) })),
      ...messages.map((m) => ({ kind: 'message', id: m.id, name: TEMPLATES[m.template_key]?.name ?? (m.template_key === 'receipt' ? 'Receipt' : 'Message'), channel: m.channel ?? 'sms', to: m.to_address ?? null, at: iso(m.at) })),
    ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    sendJson(res, 200, { items });
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
    const extra = customerExtras(body, {});
    if (extra.error) return badRequest(res, extra.error);

    const groups = await resolveGroupIds(body.groupIds);
    if (groups && groups.error) return badRequest(res, groups.error);

    const info = await db
      .prepare('INSERT INTO customers (name, email, phone, notes, address, postcode, marketing_permission, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(name, email, phone, notes, extra.address, extra.postcode, extra.marketing, nowIso());
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
    const extra = customerExtras(body, existing);
    if (extra.error) return badRequest(res, extra.error);

    const groups = await resolveGroupIds(body.groupIds);
    if (groups && groups.error) return badRequest(res, groups.error);

    await db.prepare(
      'UPDATE customers SET name = ?, email = ?, phone = ?, notes = ?, address = ?, postcode = ?, marketing_permission = ?, active = ?, updated_at = ? WHERE id = ?'
    ).run(name, email, phone, notes, extra.address, extra.postcode, extra.marketing, active, nowIso(), id);
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
}
