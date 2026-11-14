// Migration 154 (openspec/changes/website-buy-online design 1, tasks 1.1–1.3):
// online orders, their lines and their history, each the shop's own under
// row-level security; online_payments taking an order's payment; the bank's
// check and "no answer" statuses; the rest of the Online orders settings; and
// a Show online switch on each category. From empty, under the app role, then
// the migration's own words run twice more over rows already there.
import '../server/load-env.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createAppDatabase, dropDatabase, adminUrlFrom, appRoleFrom } from '../scripts/dev/new-db.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATE = path.join(ROOT, 'server/migrations/run-migrations.js');
const FILE = '154_online_orders.sql';
const SQL = readFileSync(path.join(ROOT, 'server/migrations', FILE), 'utf8');
const TABLES = ['online_orders', 'online_order_lines', 'online_order_events'];

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
const noShop = (c) => c.query("SELECT set_config('app.current_shop_id', '', false)");
// As the runner does: one transaction (the migration locks tables first).
const runSql = async (c) => { await c.query('BEGIN'); await c.query(SQL); await c.query('COMMIT'); };

async function shopWithThings(c, slug) {
  const id = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Shop]', $1) RETURNING id", [slug])).id;
  await asShop(c, id);
  // 'B' stays: a site's code must be one to three capital letters (sites_code_check).
  const site = (await one(c, 'SELECT id FROM sites ORDER BY id LIMIT 1'))?.id
    ?? (await one(c, "INSERT INTO sites (name, code) VALUES ('Bolton', 'B') RETURNING id")).id;
  const customer = (await one(c, "INSERT INTO customers (name, email) VALUES ('Maya Patel', 'maya@example.test') RETURNING id")).id;
  const product = (await one(c, "INSERT INTO products (sku, name, price, stock_qty) VALUES ('B05S-RX', 'Shimano brake pads B05S-RX', 28, 1) RETURNING id")).id;
  return { id, site, customer, product };
}
let codes = 0;
const insert = (c, table, row) => {
  const cols = Object.keys(row);
  return c.query(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`, Object.values(row));
};
const order = (c, s, extra = {}) => {
  codes += 1;
  return insert(c, 'online_orders', { site_id: s.site, customer_id: s.customer, name: 'Maya Patel', email: 'maya@example.test', phone: '07700 900 142',
    total_pence: 2800, card_pence: 2800, order_code: `[code ${codes}]`, request_key_hash: `[key ${codes}]`, ...extra });
};
const payment = (c, extra) => {
  codes += 1;
  return insert(c, 'online_payments', { provider: 'pretend', provider_ref: `[ref ${codes}]`, amount_pence: 2800, request_key_hash: `[pay ${codes}]`, ...extra });
};
const line = (c, orderId, productId, extra = {}) => insert(c, 'online_order_lines', { order_id: orderId, product_id: productId, qty: 1, unit_pence: 2800, ...extra });
const constraintCount = async (c, table) => (await one(c, 'SELECT count(*)::int AS n FROM pg_constraint WHERE conrelid = $1::regclass', [table])).n;
const SETTINGS = 'SELECT buying_online, sells, wallets_on, store_credit_on, remind_days, keep_days, shelf_name, next_order_number FROM online_order_settings';
const STARTING = { sells: 'shelf', wallets_on: true, store_credit_on: true, remind_days: 3, keep_days: 7, shelf_name: null, next_order_number: 1 };

test('154 makes online orders, lines and history the shop’s own, takes order payments, adds the settings and the category switch, and runs twice', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig154_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));

  await withClient(url.href, async (c) => {
    // ---- 1.1 the three tables, each the shop's own ----
    for (const table of TABLES) {
      const rls = await one(c, 'SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = $1', [table]);
      assert.deepEqual(rls, { relrowsecurity: true, relforcerowsecurity: true }, `${table}: row-level security on and forced`);
      const policy = await one(c, 'SELECT qual, with_check FROM pg_policies WHERE tablename = $1 AND policyname = $2', [table, `${table}_shop_isolation`]);
      assert.ok(policy, `${table}: its shop_isolation policy`);
      assert.match(policy.qual, /shop_id = .*app\.current_shop_id/);
      assert.match(policy.with_check, /shop_id = .*app\.current_shop_id/);
    }
    const a = await shopWithThings(c, 's1');
    const b = await shopWithThings(c, 's2');
    await asShop(c, a.id);
    const made = (await order(c, a)).rows[0];
    assert.equal(made.shop_id, a.id);
    assert.equal(made.stage, 'awaiting_payment');
    assert.equal(made.how, 'collect');
    assert.equal(made.number, null, 'no number until it is paid');
    assert.equal(made.credit_pence, 0);
    assert.equal(made.cancelled_by_customer, false);
    await line(c, made.id, a.product);
    await c.query("INSERT INTO online_order_events (order_id, kind) VALUES ($1, 'placed')", [made.id]);
    await assert.rejects(order(c, a, { stage: 'lost' }), /check/i);
    await assert.rejects(order(c, a, { how: 'post' }), /check/i);
    await assert.rejects(order(c, a, { card_pence: 2000 }), /check/i, 'card and credit add up to the total');
    await assert.rejects(order(c, a, { card_pence: -100, credit_pence: 2900 }), /check/i);
    await assert.rejects(order(c, a, { name: '' }), /check/i, 'a name');
    await assert.rejects(order(c, a, { name: 'x'.repeat(61) }), /check/i, 'a name up to 60');
    await assert.rejects(order(c, a, { phone: 'x'.repeat(61) }), /check/i, 'a phone up to 60');
    await assert.rejects(order(c, a, { email: 'x'.repeat(255) }), /check/i, 'an email up to 254');
    await order(c, a, { name: 'x'.repeat(60), phone: null });
    // A line's refund (design 1): when, and why, up to 500 characters.
    const refundable = (await line(c, made.id, a.product)).rows[0];
    assert.deepEqual([refundable.refunded_at, refundable.refund_reason], [null, null]);
    await c.query("UPDATE online_order_lines SET refunded_at = now(), refund_reason = $2 WHERE id = $1", [refundable.id, 'x'.repeat(500)]);
    await assert.rejects(c.query('UPDATE online_order_lines SET refund_reason = $2 WHERE id = $1', [refundable.id, 'x'.repeat(501)]), /check/i);
    await assert.rejects(line(c, made.id, a.product, { qty: 0 }), /check/i);
    await assert.rejects(line(c, made.id, a.product, { unit_pence: -1 }), /check/i);
    await assert.rejects(order(c, a, { request_key_hash: made.request_key_hash }), /unique|duplicate/i, 'one order per Pay');
    await assert.rejects(order(c, a, { order_code: made.order_code }), /unique|duplicate/i);
    // The number comes with payment, never before it; a paid stage needs payment.
    await assert.rejects(c.query('UPDATE online_orders SET number = 1 WHERE id = $1', [made.id]), /check/i);
    await assert.rejects(c.query("UPDATE online_orders SET stage = 'to_get_ready' WHERE id = $1", [made.id]), /check/i);
    await assert.rejects(c.query('UPDATE online_orders SET paid_at = now() WHERE id = $1', [made.id]), /check/i);
    await c.query("UPDATE online_orders SET number = 1, paid_at = now(), stage = 'to_get_ready' WHERE id = $1", [made.id]);
    const second = (await order(c, a)).rows[0];
    await assert.rejects(c.query("UPDATE online_orders SET number = 1, paid_at = now(), stage = 'to_get_ready' WHERE id = $1", [second.id]), /unique|duplicate/i);
    // Another shop sees none of it, and can't name it.
    await asShop(c, b.id);
    for (const table of TABLES) assert.equal((await c.query(`SELECT 1 FROM ${table}`)).rows.length, 0, table);
    await c.query('INSERT INTO online_order_settings DEFAULT VALUES');
    await assert.rejects(c.query("INSERT INTO online_order_events (shop_id, order_id, kind) VALUES ($1, $2, 'placed')", [a.id, made.id]), /row-level security/i);
    await assert.rejects(order(c, b, { customer_id: a.customer }), /foreign key/i);
    await assert.rejects(order(c, b, { site_id: a.site }), /foreign key/i);
    const theirs = (await order(c, b)).rows[0];
    assert.equal(theirs.number, null);
    await c.query("UPDATE online_orders SET number = 1, paid_at = now(), stage = 'to_get_ready' WHERE id = $1", [theirs.id]);
    assert.equal((await one(c, 'SELECT number FROM online_orders WHERE id = $1', [theirs.id])).number, 1, 'each shop counts its own');
    await assert.rejects(line(c, theirs.id, a.product), /foreign key/i);
    await assert.rejects(line(c, made.id, b.product), /foreign key/i);
    await assert.rejects(c.query("INSERT INTO online_order_events (order_id, kind) VALUES ($1, 'placed')", [made.id]), /foreign key/i);
    await assert.rejects(payment(c, { purpose: 'order', online_order_id: made.id }), /foreign key/i);

    // ---- 1.2 online_payments takes an order's payment; two new statuses ----
    await asShop(c, a.id);
    const deposit = (await payment(c, {})).rows[0];
    assert.equal(deposit.purpose, 'deposit');
    assert.equal(deposit.online_order_id, null);
    assert.equal((await payment(c, { purpose: 'order', online_order_id: made.id })).rows[0].online_order_id, made.id);
    await assert.rejects(payment(c, { purpose: 'order' }), /check/i, 'an order payment names its order');
    await assert.rejects(payment(c, { purpose: 'deposit', online_order_id: made.id }), /check/i, 'a deposit names no order');
    await assert.rejects(payment(c, { purpose: 'gift' }), /check/i);
    for (const status of ['checking', 'unknown']) {
      assert.equal((await payment(c, { status })).rows[0].status, status);
      await c.query('INSERT INTO pretend_payments (ref, idempotency_key, amount_pence, status) VALUES ($1, $1, 2800, $2)', [`[pretend ${status}]`, status]);
    }
    await assert.rejects(payment(c, { status: 'maybe' }), /check/i);
    await assert.rejects(c.query("INSERT INTO pretend_payments (ref, idempotency_key, amount_pence, status) VALUES ('[p]', '[p]', 1, 'maybe')"), /check/i);

    // ---- 1.3 the rest of the Online orders settings, and the category switch ----
    await c.query('INSERT INTO online_order_settings DEFAULT VALUES');
    assert.deepEqual(await one(c, SETTINGS), { buying_online: false, ...STARTING });
    const set = (sql) => c.query(`UPDATE online_order_settings SET ${sql}`);
    await assert.rejects(set("sells = 'anywhere'"), /check/i);
    for (const bad of ['remind_days = 0', 'remind_days = 61', 'keep_days = 1', 'keep_days = 91', 'keep_days = 3', 'remind_days = 7',
      'next_order_number = 0', "shelf_name = ''", `shelf_name = '${'x'.repeat(61)}'`]) {
      await assert.rejects(set(bad), /check/i, bad);
    }
    await set(`remind_days = 60, keep_days = 90, shelf_name = '${'x'.repeat(60)}'`);
    assert.equal((await one(c, "INSERT INTO product_categories (name, path) VALUES ('Bearings', 'Bearings') RETURNING show_online")).show_online, true);

    // ---- The migration's own words, twice more, over rows already there ----
    const before = {};
    for (const table of [...TABLES, 'online_payments', 'pretend_payments', 'online_order_settings', 'product_categories']) before[table] = await constraintCount(c, table);
    await c.query("UPDATE product_categories SET show_online = false WHERE path = 'Bearings'");
    await noShop(c);
    await runSql(c);
    await runSql(c);
    await asShop(c, a.id);
    for (const [table, n] of Object.entries(before)) assert.equal(await constraintCount(c, table), n, table);
    assert.deepEqual(await one(c, 'SELECT purpose, online_order_id, status, amount_pence FROM online_payments WHERE id = $1', [deposit.id]),
      { purpose: 'deposit', online_order_id: null, status: 'waiting', amount_pence: 2800 });
    assert.equal((await one(c, 'SELECT remind_days FROM online_order_settings')).remind_days, 60);
    assert.equal((await one(c, "SELECT show_online FROM product_categories WHERE path = 'Bearings'")).show_online, false);
    assert.equal((await c.query('SELECT 1 FROM online_orders')).rows.length, 3);

    // ---- Running it again never takes back a value a later migration added ----
    await c.query('ALTER TABLE online_payments DROP CONSTRAINT online_payments_purpose_check');
    await c.query("ALTER TABLE online_payments ADD CONSTRAINT online_payments_purpose_check CHECK (purpose IN ('deposit', 'order', '[later purpose]'))");
    for (const table of ['online_payments', 'pretend_payments']) {
      await c.query(`ALTER TABLE ${table} DROP CONSTRAINT ${table}_status_check`);
      await c.query(`ALTER TABLE ${table} ADD CONSTRAINT ${table}_status_check
        CHECK (status IN ('waiting', 'held', 'declined', 'taken', 'released', 'refunded', 'checking', 'unknown', '[later status]'))`);
    }
    await noShop(c);
    await runSql(c);
    await asShop(c, a.id);
    assert.equal((await payment(c, { purpose: '[later purpose]', status: '[later status]' })).rows[0].status, '[later status]');
    await c.query("INSERT INTO pretend_payments (ref, idempotency_key, amount_pence, status) VALUES ('[later]', '[later]', 1, '[later status]')");

    // ---- Rows from before 154 get the starting values ----
    await c.query(`ALTER TABLE online_order_settings DROP COLUMN sells, DROP COLUMN wallets_on, DROP COLUMN store_credit_on,
      DROP COLUMN remind_days, DROP COLUMN keep_days, DROP COLUMN shelf_name, DROP COLUMN next_order_number`);
    await c.query('ALTER TABLE product_categories DROP COLUMN show_online');
    await noShop(c);
    await runSql(c);
    await asShop(c, a.id);
    assert.deepEqual(await one(c, SETTINGS), { buying_online: false, ...STARTING });
    assert.equal((await one(c, "SELECT show_online FROM product_categories WHERE path = 'Bearings'")).show_online, true, 'every category starts on the website');
    await asShop(c, b.id);
    assert.deepEqual(await one(c, SETTINGS), { buying_online: false, ...STARTING });
    for (const [table, n] of Object.entries(before)) assert.equal(await constraintCount(c, table), n, `${table}, after the columns came back`);
  });
  assert.doesNotMatch(migrate(env), new RegExp(`Applied migration: ${FILE}`));
});

// Locks taken in one order at the start, each at the strength it will need,
// so the migration never waits for a stronger lock part way through (and
// deadlocks with a request holding a weaker one): every table it alters is
// locked ACCESS EXCLUSIVE before anything else runs.
test('154 locks every table it alters ACCESS EXCLUSIVE before anything else', () => {
  const code = SQL.replace(/--[^\n]*/g, '');
  const statements = code.split(';').map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
  const locks = [];
  for (const statement of statements) {
    const m = statement.match(/^LOCK TABLE (.+) IN (.+) MODE$/i);
    if (!m) break;
    for (const table of m[1].split(',')) locks.push({ table: table.trim(), mode: m[2].toUpperCase() });
  }
  assert.ok(locks.length > 0, 'it starts with its locks');
  const created = ['online_orders', 'online_order_lines', 'online_order_events'];
  // Named straight, or in a DO block's list that it alters one by one.
  const named = [...code.matchAll(/ALTER TABLE (\w+)/gi)].map((m) => m[1]);
  const listed = [...code.matchAll(/ARRAY\[([^\]]+)\][^$]*?ALTER TABLE %I/g)].flatMap((m) => m[1].split(',').map((x) => x.trim().replace(/'/g, '')));
  const altered = [...new Set([...named, ...listed])].filter((t) => !created.includes(t));
  assert.ok(altered.length >= 4, `the tables it alters: ${altered}`);
  for (const table of altered) {
    assert.deepEqual(locks.filter((l) => l.table === table).map((l) => l.mode), ['ACCESS EXCLUSIVE'], table);
  }
  for (const l of locks.filter((x) => !altered.includes(x.table))) assert.equal(l.mode, 'SHARE ROW EXCLUSIVE', l.table);
});

// A database already at 149 (154 not yet run): its deposits stay as they
// are, and it gains 'order', 'checking' and 'unknown'.
test('154 on a database at 149 widens the checks and leaves its deposits alone', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig154_old_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  // Marked as run, so the runner stops at 149; then run by hand below. A
  // later migration built on 154's order tables (160's refunds) can't run
  // without it, so it's marked as run too.
  const later = readdirSync(path.join(ROOT, 'server/migrations'))
    .filter((f) => f.endsWith('.sql') && f > FILE && /\bonline_order/.test(readFileSync(path.join(ROOT, 'server/migrations', f), 'utf8')));
  await withClient(url.href, async (c) => {
    await c.query('CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    for (const f of [FILE, ...later]) await c.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
  });
  migrate({ ...process.env, DATABASE_URL: url.href });
  await withClient(url.href, async (c) => {
    assert.equal((await one(c, "SELECT to_regclass('online_orders') AS t")).t, null, 'at 149');
    const a = await shopWithThings(c, 's1');
    const deposit = (await payment(c, { status: 'held' })).rows[0];
    await assert.rejects(payment(c, { status: 'checking' }), /check/i, 'at 149, no checking yet');
    await assert.rejects(c.query("INSERT INTO pretend_payments (ref, idempotency_key, amount_pence, status) VALUES ('[u]', '[u]', 1, 'unknown')"), /check/i);
    await c.query('INSERT INTO online_order_settings (buying_online) VALUES (true)');
    await noShop(c);
    await runSql(c);
    await asShop(c, a.id);
    assert.deepEqual(await one(c, 'SELECT purpose, online_order_id, status, amount_pence FROM online_payments WHERE id = $1', [deposit.id]),
      { purpose: 'deposit', online_order_id: null, status: 'held', amount_pence: 2800 });
    const made = (await order(c, a)).rows[0];
    assert.equal((await payment(c, { purpose: 'order', online_order_id: made.id, status: 'checking' })).rows[0].status, 'checking');
    await c.query("INSERT INTO pretend_payments (ref, idempotency_key, amount_pence, status) VALUES ('[u]', '[u]', 1, 'unknown')");
    assert.deepEqual(await one(c, SETTINGS), { buying_online: true, ...STARTING });
  });
});
