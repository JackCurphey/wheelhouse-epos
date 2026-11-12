// Cycle to Work tables and settings (openspec/changes/cycle-to-work, design 2
// and 7, tasks 1.1–1.4). The migration from empty, then the settings and
// scheme-provider routes. Placeholders throughout: the drawings leave the
// numbers "[n]", so the tests use their own.
//
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import '../server/load-env.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { pool } from '../server/db.js';
import { createAppDatabase, dropDatabase, adminUrlFrom, appRoleFrom } from '../scripts/dev/new-db.mjs';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATE = path.join(ROOT, 'server/migrations/run-migrations.js');
const FILE = '137_cycle_to_work.sql';
const TABLES = ['c2w_settings', 'c2w_providers', 'c2w_orders', 'c2w_order_events', 'c2w_payments', 'c2w_payment_orders'];

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

// ---------- 1.1 The migration ----------

test('137 makes the Cycle to Work tables, each shop’s own, links a frame and an order line, and runs twice', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig137_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    for (const table of TABLES) {
      const r = await one(c, 'SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = $1', [table]);
      assert.deepEqual([r?.relrowsecurity, r?.relforcerowsecurity], [true, true], `${table} has row-level security`);
    }
    const shop = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Shop]', 's1') RETURNING id")).id;
    const otherShop = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Other shop]', 's2') RETURNING id")).id;
    await asShop(c, shop);
    const settings = await one(c, 'INSERT INTO c2w_settings DEFAULT VALUES RETURNING *');
    assert.deepEqual(
      [settings.shop_id, settings.hold_days, settings.order_rule, settings.deposit_on_certificate, settings.deposit_on_pull_out, settings.how_to_apply, settings.next_quote_number],
      [shop, null, 'certificate', 'refund', 'refund', '', 1],
    );
    await assert.rejects(c.query("UPDATE c2w_settings SET order_rule = 'whenever'"), /check/i);
    const provider = (await one(c, "INSERT INTO c2w_providers (name, commission_kind, commission_value) VALUES ('[Provider]', 'percent', 500) RETURNING id")).id;
    await assert.rejects(c.query("INSERT INTO c2w_providers (name, commission_kind, commission_value) VALUES ('[Provider]', 'percent', 10001)"), /check/i, 'over 100% refused');
    const customer = (await one(c, "INSERT INTO customers (name) VALUES ('[Customer]') RETURNING id")).id;
    const product = (await one(c, "INSERT INTO products (name, category) VALUES ('[Bike]', 'Bikes') RETURNING id")).id;
    const order = (await one(c, "INSERT INTO c2w_orders (customer_id, provider_id, product_id, quote_number, total_pence, customer_code) VALUES ($1, $2, $3, 1, 100000, '[code 1]') RETURNING id, stage", [customer, provider, product]));
    assert.equal(order.stage, 'quote');
    await assert.rejects(c.query("INSERT INTO c2w_orders (customer_id, provider_id, product_id, quote_number, total_pence, customer_code) VALUES ($1, $2, $3, 1, 100000, '[code 2]')", [customer, provider, product]), /idx_c2w_orders_quote_number/, 'a quote number once per shop');
    await c.query("INSERT INTO c2w_order_events (order_id, kind) VALUES ($1, 'quote_given')", [order.id]);
    const payment = (await one(c, "INSERT INTO c2w_payments (provider_id, amount_pence, received_on) VALUES ($1, 95000, '2026-09-30') RETURNING id", [provider])).id;
    await c.query('INSERT INTO c2w_payment_orders (payment_id, order_id, amount_pence) VALUES ($1, $2, 95000)', [payment, order.id]);
    const frame = (await one(c, "INSERT INTO stock_frames (product_id, frame_number, frame_key, state, c2w_order_id) VALUES ($1, '[frame 1]', '[FRAME1]', 'held', $2) RETURNING id", [product, order.id])).id;
    await c.query('UPDATE c2w_orders SET frame_id = $1 WHERE id = $2', [frame, order.id]);
    const supplier = (await one(c, "INSERT INTO suppliers (name, adapter_type) VALUES ('[Supplier]', 'mock_csv') RETURNING id")).id;
    const po = (await one(c, 'INSERT INTO purchase_orders (supplier_id) VALUES ($1) RETURNING id', [supplier])).id;
    await c.query("INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, qty_ordered, c2w_order_id) VALUES ($1, $2, '[Bike]', 1, $3)", [po, product, order.id]);

    await asShop(c, otherShop);
    for (const table of TABLES) assert.equal((await c.query(`SELECT 1 FROM ${table}`)).rowCount, 0, `another shop never reads ${table}`);
    await assert.rejects(c.query("INSERT INTO c2w_providers (shop_id, name) VALUES ($1, '[Provider]')", [shop]), /row-level security/i);
    // An order can't name another shop's provider, even by id.
    const theirCustomer = (await one(c, "INSERT INTO customers (name) VALUES ('[Customer]') RETURNING id")).id;
    const theirProduct = (await one(c, "INSERT INTO products (name, category) VALUES ('[Bike]', 'Bikes') RETURNING id")).id;
    await assert.rejects(c.query("INSERT INTO c2w_orders (customer_id, provider_id, product_id, quote_number, total_pence, customer_code) VALUES ($1, $2, $3, 1, 1, '[code 3]')", [theirCustomer, provider, theirProduct]), /foreign key/i);

    await asShop(c, shop);
    // Removing the order clears the frame's and the order line's links rather than blocking.
    await c.query('UPDATE c2w_orders SET frame_id = NULL');
    await c.query('DELETE FROM c2w_payment_orders');
    await c.query('DELETE FROM c2w_order_events');
    await c.query('DELETE FROM c2w_orders');
    assert.equal((await one(c, 'SELECT c2w_order_id FROM stock_frames WHERE id = $1', [frame])).c2w_order_id, null);
    assert.equal((await one(c, 'SELECT c2w_order_id FROM purchase_order_items WHERE purchase_order_id = $1', [po])).c2w_order_id, null);
    await c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
});

// ---------- 1.2–1.4 The routes ----------

let server;
let owner;
let jo;
let other;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  other = await staffSignup(server.baseUrl);
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
});
after(async () => {
  for (const shop of [owner, other]) if (shop) await deleteTestShop(shop.shop.id);
  if (server) await server.stop();
  await pool.end();
});
const as = (who) => (p, options) => staffRequest(server.baseUrl, who.cookie, p, options);
const own = (p, options) => as(owner)(p, options);

test('1.2 the settings are made on first read, the Owner saves them, and nobody else can', async () => {
  const first = await as(jo)('/api/c2w/settings');
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.deepEqual(first.body.settings, {
    holdDays: null, remindDays: null, quoteValidDays: null, orderRule: 'certificate',
    depositKind: 'pounds', depositValue: null, depositOnCertificate: 'refund', depositOnPullOut: 'refund',
    howToApply: '', todayLines: true,
  });
  const saved = await own('/api/c2w/settings', { method: 'PUT', body: { holdDays: 21, remindDays: 3, quoteValidDays: 30, orderRule: 'applied', howToApply: '[The shop’s own words]', todayLines: false } });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.deepEqual(
    [saved.body.settings.holdDays, saved.body.settings.remindDays, saved.body.settings.quoteValidDays, saved.body.settings.orderRule, saved.body.settings.howToApply, saved.body.settings.todayLines],
    [21, 3, 30, 'applied', '[The shop’s own words]', false],
  );
  // What isn't sent is kept.
  const again = await own('/api/c2w/settings', { method: 'PUT', body: { holdDays: 14 } });
  assert.deepEqual([again.body.settings.holdDays, again.body.settings.orderRule], [14, 'applied']);

  const refused = await as(jo)('/api/c2w/settings', { method: 'PUT', body: { holdDays: 7 } });
  assert.equal(refused.status, 403);
  assert.equal(refused.body.code, 'owner_only');
  assert.equal((await own('/api/c2w/settings')).body.settings.holdDays, 14, 'unchanged by the refusal');
  // Another shop has its own.
  assert.equal((await as(other)('/api/c2w/settings')).body.settings.holdDays, null);

  for (const bad of [{ holdDays: 0 }, { holdDays: 1.5 }, { remindDays: -1 }, { orderRule: 'whenever' }, { howToApply: 'x'.repeat(2001) }, { todayLines: 'yes' }]) {
    const r = await own('/api/c2w/settings', { method: 'PUT', body: bad });
    assert.equal(r.status, 400, `${JSON.stringify(bad)} refused`);
  }
  assert.equal((await staffRequest(server.baseUrl, '', '/api/c2w/settings')).status, 401);
});

test('1.3 “Straight away, with a deposit” is refused until the till can take a deposit for an order', async () => {
  const r = await own('/api/c2w/settings', { method: 'PUT', body: { orderRule: 'deposit' } });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, 'deposit_not_ready');
  assert.notEqual((await own('/api/c2w/settings')).body.settings.orderRule, 'deposit');
  // The deposit's own settings can still be filled in ahead.
  const kept = await own('/api/c2w/settings', { method: 'PUT', body: { depositKind: 'percent', depositValue: 1000, depositOnCertificate: 'count', depositOnPullOut: 'keep' } });
  assert.equal(kept.status, 200, JSON.stringify(kept.body));
  assert.deepEqual([kept.body.settings.depositKind, kept.body.settings.depositValue, kept.body.settings.depositOnCertificate, kept.body.settings.depositOnPullOut], ['percent', 1000, 'count', 'keep']);
});

test('1.4 providers: the Owner adds, edits and retires; the commission is left out for someone who can’t see costs', async () => {
  const added = await own('/api/c2w/providers', { method: 'POST', body: { name: '[Provider A]', commissionKind: 'percent', commissionValue: 450, paysInDays: 28, accessoriesInside: false, handoverNote: '[Line 1]\n[Line 2]' } });
  assert.equal(added.status, 201, JSON.stringify(added.body));
  const a = added.body.provider;
  assert.deepEqual(
    [a.name, a.commissionKind, a.commissionValue, a.paysInDays, a.accessoriesInside, a.handoverChecks, a.retiredAt],
    ['[Provider A]', 'percent', 450, 28, false, ['[Line 1]', '[Line 2]'], null],
  );
  const b = (await own('/api/c2w/providers', { method: 'POST', body: { name: '[Provider B]' } })).body.provider;
  assert.deepEqual([b.commissionValue, b.paysInDays, b.accessoriesInside, b.handoverChecks], [null, null, true, []], 'terms start empty, to fill in');

  const edited = await own(`/api/c2w/providers/${a.id}`, { method: 'PUT', body: { commissionKind: 'pounds', commissionValue: 2500 } });
  assert.equal(edited.status, 200, JSON.stringify(edited.body));
  assert.deepEqual([edited.body.provider.name, edited.body.provider.commissionKind, edited.body.provider.commissionValue, edited.body.provider.paysInDays], ['[Provider A]', 'pounds', 2500, 28]);

  for (const bad of [{ name: '' }, { name: 'x'.repeat(61) }, { commissionKind: 'percent', commissionValue: 10001 }, { commissionKind: 'shares' }, { commissionValue: -1 }, { paysInDays: 366 }, { accessoriesInside: 'no' }]) {
    const r = await own(`/api/c2w/providers/${a.id}`, { method: 'PUT', body: bad });
    assert.equal(r.status, 400, `${JSON.stringify(bad)} refused`);
  }

  // Staff see the provider, its days and its checks, but no commission.
  const joList = await as(jo)('/api/c2w/providers');
  assert.equal(joList.status, 200);
  const joA = joList.body.providers.find((p) => p.id === a.id);
  assert.equal(joA.paysInDays, 28);
  assert.ok(!('commissionKind' in joA) && !('commissionValue' in joA), 'no commission for Jo');
  assert.ok(!JSON.stringify(joList.body).includes('2500'));
  for (const write of [['POST', '/api/c2w/providers', { name: '[Provider C]' }], ['PUT', `/api/c2w/providers/${a.id}`, { name: '[Renamed]' }], ['POST', `/api/c2w/providers/${a.id}/retire`, {}]]) {
    const r = await as(jo)(write[1], { method: write[0], body: write[2] });
    assert.equal(r.status, 403, `${write[0]} ${write[1]} is the Owner’s`);
  }

  // Retired: gone from the list to pick from, still listed for Settings, never deleted.
  const retired = await own(`/api/c2w/providers/${b.id}/retire`, { method: 'POST', body: {} });
  assert.equal(retired.status, 200, JSON.stringify(retired.body));
  assert.ok(retired.body.provider.retiredAt);
  assert.deepEqual((await own('/api/c2w/providers')).body.providers.map((p) => p.id), [a.id]);
  const all = (await own('/api/c2w/providers?retired=1')).body.providers;
  assert.deepEqual(all.map((p) => [p.id, p.retiredAt !== null]), [[a.id, false], [b.id, true]]);
  assert.equal((await own(`/api/c2w/providers/${b.id}`, { method: 'PUT', body: { name: '[Back]' } })).status, 409, 'a retired provider isn’t edited');

  // Another shop can't see or change them.
  assert.deepEqual((await as(other)('/api/c2w/providers?retired=1')).body.providers, []);
  assert.equal((await as(other)(`/api/c2w/providers/${a.id}`, { method: 'PUT', body: { name: '[Theirs]' } })).status, 404);
  assert.equal((await as(other)(`/api/c2w/providers/${a.id}/retire`, { method: 'POST', body: {} })).status, 404);
});
