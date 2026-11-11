// Quick buttons on the server (openspec/changes/owner-setup-till-payments-eod,
// design 1, tasks 1.1 and 1.3; Jack's answer 1 of 11 Nov,
// docs/decisions/2026-11-11-settings-rest-answers.md). The migration from
// empty and onto shops that already have services, then the routes.
//
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import '../server/load-env.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { pool, runWithShop, prepare } from '../server/db.js';
import { createAppDatabase, dropDatabase, adminUrlFrom, appRoleFrom } from '../scripts/dev/new-db.mjs';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATE = path.join(ROOT, 'server/migrations/run-migrations.js');
const FILE = '131_quick_buttons.sql';
const LATER = readdirSync(path.join(ROOT, 'server/migrations')).filter((f) => f.endsWith('.sql') && f >= FILE);

function adminUrlOrSkip(t) {
  try {
    return adminUrlFrom(process.env);
  } catch (err) {
    if (process.env.CI) throw err;
    t.skip('no superuser connection configured');
    return null;
  }
}
async function withClient(url, fn) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try { return await fn(client); } finally { await client.end(); }
}
const migrate = (env) => execFileSync('node', [MIGRATE], { env, encoding: 'utf8', stdio: 'pipe' });
const one = async (c, sql, args) => (await c.query(sql, args)).rows[0];
const asShop = (c, id) => c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(id)]);
async function scratch(t, tag) {
  const admin = adminUrlOrSkip(t);
  if (!admin) return null;
  const name = `epos_qb_${tag}_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  return { url: url.href, env: { ...process.env, DATABASE_URL: url.href } };
}

// ---------- 1.1 The migration ----------

test('131 runs from empty: exactly one item per button, a group takes its buttons, each shop sees its own', async (t) => {
  const db = await scratch(t, 'empty');
  if (!db) return;
  assert.match(migrate(db.env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(db.url, async (c) => {
    const shop = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Shop]', 's1') RETURNING id")).id;
    const other = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Other shop]', 's2') RETURNING id")).id;
    await asShop(c, shop);
    const pads = (await one(c, "INSERT INTO products (name, price) VALUES ('Shimano brake pads B05S-RX', 28) RETURNING id")).id;
    const service = (await one(c, "INSERT INTO workshop_services (name, price, price_pence, minutes) VALUES ('Standard service', 65, 6500, 60) RETURNING id")).id;
    const group = (await one(c, "INSERT INTO quick_button_groups (name, position) VALUES ('Workshop', 0) RETURNING id")).id;
    // Exactly one of a product or a service.
    await assert.rejects(c.query('INSERT INTO quick_buttons (group_id, product_id, service_id, position) VALUES ($1, $2, $3, 0)', [group, pads, service]), /check/i, 'both refused');
    await assert.rejects(c.query('INSERT INTO quick_buttons (group_id, position) VALUES ($1, 0)', [group]), /check/i, 'neither refused');
    await c.query('INSERT INTO quick_buttons (group_id, product_id, position) VALUES ($1, $2, 0)', [group, pads]);
    await c.query('INSERT INTO quick_buttons (group_id, service_id, position) VALUES ($1, $2, 1)', [group, service]);
    // Names and labels have their limits; a taken group name is refused, ignoring capitals.
    await assert.rejects(c.query("INSERT INTO quick_button_groups (name, position) VALUES ('workshop', 1)"), /unique|duplicate/i);
    await assert.rejects(c.query('INSERT INTO quick_button_groups (name, position) VALUES ($1, 1)', ['x'.repeat(21)]), /check/i);
    await assert.rejects(c.query('INSERT INTO quick_buttons (group_id, product_id, label, position) VALUES ($1, $2, $3, 2)', [group, pads, 'x'.repeat(41)]), /check/i);
    // Another shop sees none of them.
    await asShop(c, other);
    assert.equal((await c.query('SELECT 1 FROM quick_button_groups')).rowCount, 0);
    assert.equal((await c.query('SELECT 1 FROM quick_buttons')).rowCount, 0);
    // Removing a group removes its buttons.
    await asShop(c, shop);
    await c.query('DELETE FROM quick_button_groups WHERE id = $1', [group]);
    assert.equal((await c.query('SELECT 1 FROM quick_buttons')).rowCount, 0);
  });
});

test("131 copies each shop's active services into a Workshop group in the till's order; none for a shop without", async (t) => {
  const db = await scratch(t, 'copy');
  if (!db) return;
  // Everything before 131, from empty.
  await withClient(db.url, async (c) => {
    await c.query('CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    for (const f of LATER) await c.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
  });
  migrate(db.env);
  const ids = {};
  await withClient(db.url, async (c) => {
    ids.shop = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Shop]', 's1') RETURNING id")).id;
    ids.none = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Shop with none]', 's2') RETURNING id")).id;
    ids.inactive = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Shop with inactive only]', 's3') RETURNING id")).id;
    await asShop(c, ids.shop);
    // Added in this order; the till lists active services by name.
    const add = async (name, pence, minutes, active) => (await one(c, 'INSERT INTO workshop_services (name, price, price_pence, minutes, active) VALUES ($1, $2, $3, $4, $5) RETURNING id', [name, pence / 100, pence, minutes, active])).id;
    ids.standard = await add('Standard service', 6500, 60, 1);
    ids.cable = await add('Replace gear cable', 1200, null, 0);
    ids.brakes = await add('Fit & adjust brakes', 1800, 30, 1);
    await asShop(c, ids.inactive);
    await add('Replace gear cable', 1200, null, 0);
    await c.query('DELETE FROM schema_migrations WHERE filename = ANY($1)', [LATER]);
  });
  assert.match(migrate(db.env), new RegExp(`Applied migration: ${FILE}`));
  const workshop = (c) => c.query('SELECT g.name, g.position AS g_pos, b.service_id, b.product_id, b.label, b.position FROM quick_button_groups g LEFT JOIN quick_buttons b ON b.group_id = g.id ORDER BY g.position, b.position');
  await withClient(db.url, async (c) => {
    await asShop(c, ids.shop);
    assert.deepEqual((await workshop(c)).rows, [
      { name: 'Workshop', g_pos: 0, service_id: ids.brakes, product_id: null, label: null, position: 0 },
      { name: 'Workshop', g_pos: 0, service_id: ids.standard, product_id: null, label: null, position: 1 },
    ]);
    await asShop(c, ids.none);
    assert.equal((await workshop(c)).rowCount, 0, 'no services, no group');
    await asShop(c, ids.inactive);
    assert.equal((await workshop(c)).rowCount, 0, 'inactive services only, no group');
  });
  // Run again: no second Workshop group.
  await withClient(db.url, (c) => c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]));
  assert.match(migrate(db.env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(db.url, async (c) => {
    await asShop(c, ids.shop);
    assert.equal((await workshop(c)).rowCount, 2);
  });
});

// ---------- 1.3 The routes ----------

let server;
let owner;
let jo;
let other;
const items = {};
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  other = await staffSignup(server.baseUrl);
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
  await runWithShop(owner.shop.id, async () => {
    const service = async (name, pence, minutes) => (await prepare('INSERT INTO workshop_services (name, price, price_pence, minutes) VALUES (?, ?, ?, ?) RETURNING id').get(name, pence / 100, pence, minutes)).id;
    items.standard = await service('Standard service', 6500, 60);
    items.brakes = await service('Fit & adjust brakes', 1800, 30);
    items.cable = await service('Replace gear cable', 1200, null);
    items.pads = (await prepare("INSERT INTO products (name, price) VALUES ('Shimano brake pads B05S-RX', 28) RETURNING id").get()).id;
  });
});
after(async () => {
  for (const shop of [owner, other]) if (shop) await deleteTestShop(shop.shop.id);
  if (server) await server.stop();
  await pool.end();
});
const as = (who) => (p, options) => staffRequest(server.baseUrl, who.cookie, p, options);
const own = (p, options) => as(owner)(p, options);
const list = async () => {
  const res = await own('/api/quick-buttons');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.groups;
};
const group = async (name) => (await list()).find((g) => g.name === name);
const names = async (groupName) => (await group(groupName)).buttons.map((b) => b.name);
async function addGroup(name) {
  const res = await own('/api/quick-button-groups', { method: 'POST', body: { name } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.groups.find((g) => g.name === name);
}
async function addButton(groupId, item) {
  const res = await own('/api/quick-buttons', { method: 'POST', body: { groupId, ...item } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.id;
}

test('GET gives groups and buttons in order, each with its item, current price and onSale', async () => {
  const g = await addGroup('Workshop');
  for (const serviceId of [items.standard, items.brakes, items.cable]) await addButton(g.id, { serviceId });
  await addButton(g.id, { productId: items.pads, label: 'Shimano brake pads' });
  const workshop = await group('Workshop');
  assert.deepEqual(workshop.buttons.map(({ name, kind, line, price, pricePence, onSale, position }) => ({ name, kind, line, price, pricePence, onSale, position })), [
    { name: 'Standard service', kind: 'service', line: 'Labour · 60 min', price: 65, pricePence: 6500, onSale: true, position: 0 },
    { name: 'Fit & adjust brakes', kind: 'service', line: 'Labour · 30 min', price: 18, pricePence: 1800, onSale: true, position: 1 },
    { name: 'Replace gear cable', kind: 'service', line: 'Labour', price: 12, pricePence: 1200, onSale: true, position: 2 },
    { name: 'Shimano brake pads', kind: 'product', line: 'Part', price: 28, pricePence: 2800, onSale: true, position: 3 },
  ]);
  assert.equal(workshop.buttons[3].itemName, 'Shimano brake pads B05S-RX');
  assert.equal(workshop.buttons[3].productId, items.pads);
  // Another shop sees none of it.
  assert.deepEqual((await as(other)('/api/quick-buttons')).body.groups, []);
});

test("a product's new price, and an inactive service, show on its button with no change to the button", async () => {
  // [price]: any figure other than £28.00.
  await runWithShop(owner.shop.id, () => prepare('UPDATE products SET price = 30 WHERE id = ?').run(items.pads));
  await runWithShop(owner.shop.id, () => prepare('UPDATE workshop_services SET active = 0 WHERE id = ?').run(items.brakes));
  const buttons = (await group('Workshop')).buttons;
  assert.equal(buttons.find((b) => b.productId === items.pads).pricePence, 3000);
  assert.equal(buttons.find((b) => b.serviceId === items.brakes).onSale, false);
  await runWithShop(owner.shop.id, () => prepare('UPDATE workshop_services SET active = 1 WHERE id = ?').run(items.brakes));
});

test('add, rename, move and remove a group; a taken name is refused', async () => {
  const parts = await addGroup('Parts');
  const accessories = await addGroup('Accessories');
  assert.deepEqual((await list()).map((g) => [g.name, g.position]), [['Workshop', 0], ['Parts', 1], ['Accessories', 2]]);
  const taken = await own('/api/quick-button-groups', { method: 'POST', body: { name: 'parts' } });
  assert.equal(taken.status, 409);
  assert.equal((await own('/api/quick-button-groups', { method: 'POST', body: { name: '' } })).status, 400);
  assert.equal((await own('/api/quick-button-groups', { method: 'POST', body: { name: 'x'.repeat(21) } })).status, 400);
  assert.equal((await own(`/api/quick-button-groups/${parts.id}`, { method: 'PUT', body: { name: 'WORKSHOP' } })).status, 409);
  const renamed = await own(`/api/quick-button-groups/${parts.id}`, { method: 'PUT', body: { name: 'Spares' } });
  assert.equal(renamed.status, 200, JSON.stringify(renamed.body));
  const moved = await own(`/api/quick-button-groups/${accessories.id}`, { method: 'PUT', body: { position: 0 } });
  assert.equal(moved.status, 200);
  assert.deepEqual((await list()).map((g) => [g.name, g.position]), [['Accessories', 0], ['Workshop', 1], ['Spares', 2]]);
  assert.equal((await own(`/api/quick-button-groups/${parts.id}`, { method: 'DELETE' })).status, 200);
  assert.deepEqual((await list()).map((g) => [g.name, g.position]), [['Accessories', 0], ['Workshop', 1]]);
  assert.equal((await own(`/api/quick-button-groups/${accessories.id}`, { method: 'DELETE' })).status, 200);
});

test('removing a group with buttons returns 409 has_buttons with the count until confirmed', async () => {
  const g = await addGroup('Spares');
  await addButton(g.id, { productId: items.pads });
  await addButton(g.id, { serviceId: items.cable });
  const asked = await own(`/api/quick-button-groups/${g.id}`, { method: 'DELETE' });
  assert.equal(asked.status, 409);
  assert.deepEqual([asked.body.code, asked.body.count], ['has_buttons', 2]);
  assert.ok(await group('Spares'), 'nothing removed');
  assert.equal((await own(`/api/quick-button-groups/${g.id}?confirm=1`, { method: 'DELETE' })).status, 200);
  assert.equal(await group('Spares'), undefined);
});

test('add, change, move and remove a button; Undo puts it back where it was', async () => {
  const workshop = await group('Workshop');
  const brakes = workshop.buttons.find((b) => b.serviceId === items.brakes);
  const changed = await own(`/api/quick-buttons/${brakes.id}`, { method: 'PUT', body: { label: 'Brakes' } });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.equal((await group('Workshop')).buttons[1].name, 'Brakes');
  await own(`/api/quick-buttons/${brakes.id}`, { method: 'PUT', body: { label: '' } });
  assert.equal((await group('Workshop')).buttons[1].name, 'Fit & adjust brakes', 'empty is the item’s own name');
  assert.equal((await own(`/api/quick-buttons/${brakes.id}`, { method: 'PUT', body: { label: 'x'.repeat(41) } })).status, 400);
  assert.equal((await own(`/api/quick-buttons/${brakes.id}`, { method: 'PUT', body: { productId: items.pads, serviceId: items.cable } })).status, 400);
  // Move Replace gear cable above Fit & adjust brakes.
  const cable = workshop.buttons.find((b) => b.serviceId === items.cable);
  assert.equal((await own(`/api/quick-buttons/${cable.id}`, { method: 'PUT', body: { position: 1 } })).status, 200);
  assert.deepEqual(await names('Workshop'), ['Standard service', 'Replace gear cable', 'Fit & adjust brakes', 'Shimano brake pads']);
  // Remove, then Undo re-adds it at its old position.
  assert.equal((await own(`/api/quick-buttons/${brakes.id}`, { method: 'DELETE' })).status, 200);
  assert.deepEqual((await group('Workshop')).buttons.map((b) => b.position), [0, 1, 2]);
  await own('/api/quick-buttons', { method: 'POST', body: { groupId: workshop.id, serviceId: items.brakes, position: 2 } });
  assert.deepEqual(await names('Workshop'), ['Standard service', 'Replace gear cable', 'Fit & adjust brakes', 'Shimano brake pads']);
  // Nothing picked is refused; another shop's item is refused.
  assert.equal((await own('/api/quick-buttons', { method: 'POST', body: { groupId: workshop.id } })).status, 400);
  const theirs = await runWithShop(other.shop.id, () => prepare("INSERT INTO products (name, price) VALUES ('Shimano brake pads B05S-RX', 28) RETURNING id").get());
  assert.equal((await own('/api/quick-buttons', { method: 'POST', body: { groupId: workshop.id, productId: theirs.id } })).status, 400);
});

test('two moves landing at once keep positions whole and in order', async () => {
  const before = (await group('Workshop')).buttons;
  const [first, , , last] = before;
  const [a, b] = await Promise.all([
    own(`/api/quick-buttons/${last.id}`, { method: 'PUT', body: { position: 0 } }),
    own(`/api/quick-buttons/${first.id}`, { method: 'PUT', body: { position: 3 } }),
  ]);
  assert.deepEqual([a.status, b.status], [200, 200]);
  const after = (await group('Workshop')).buttons;
  assert.deepEqual(after.map((x) => x.position), [0, 1, 2, 3]);
  // Both moves stay: in either order, last to first and first to last gives D, B, C, A.
  assert.deepEqual(after.map((x) => x.id), [last.id, before[1].id, before[2].id, first.id]);
});

test('Staff can read but are refused changes (403); signed out gets 401', async () => {
  const workshop = await group('Workshop');
  const staff = as(jo);
  const read = await staff('/api/quick-buttons');
  assert.equal(read.status, 200);
  assert.equal(read.body.groups.length, 1);
  const tries = [
    ['POST', '/api/quick-button-groups', { name: 'Parts' }],
    ['PUT', `/api/quick-button-groups/${workshop.id}`, { name: 'Parts' }],
    ['DELETE', `/api/quick-button-groups/${workshop.id}?confirm=1`],
    ['POST', '/api/quick-buttons', { groupId: workshop.id, productId: items.pads }],
    ['PUT', `/api/quick-buttons/${workshop.buttons[0].id}`, { position: 2 }],
    ['DELETE', `/api/quick-buttons/${workshop.buttons[0].id}`],
  ];
  for (const [method, p, body] of tries) {
    const res = await staff(p, { method, body });
    assert.equal(res.status, 403, `${method} ${p}`);
    assert.equal(res.body.code, 'owner_only');
  }
  assert.deepEqual(await list(), [workshop], 'nothing changed');
  assert.equal((await staffRequest(server.baseUrl, '', '/api/quick-buttons')).status, 401);
  assert.equal((await staffRequest(server.baseUrl, '', '/api/quick-button-groups', { method: 'POST', body: { name: 'Parts' } })).status, 401);
});
