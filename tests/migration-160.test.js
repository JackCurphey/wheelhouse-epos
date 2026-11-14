// Migration 160 (openspec/changes/website-buy-online design 1 and 6, task
// 5.0): an online order's refunds and their lines, each the shop's own under
// row-level security; a store credit entry naming its order; a stock line
// naming the refund that put the stock back. From empty, under the app role,
// then the migration's own words run twice more over rows already there.
import '../server/load-env.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createAppDatabase, dropDatabase, adminUrlFrom, appRoleFrom } from '../scripts/dev/new-db.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATE = path.join(ROOT, 'server/migrations/run-migrations.js');
const FILE = '160_online_order_refunds.sql';
const SQL = readFileSync(path.join(ROOT, 'server/migrations', FILE), 'utf8');
const TABLES = ['online_order_refunds', 'online_order_refund_lines'];

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
const runSql = async (c) => { await c.query('BEGIN'); await c.query(SQL); await c.query('COMMIT'); };
const insert = (c, table, row) => {
  const cols = Object.keys(row);
  return c.query(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`, Object.values(row));
};
const constraintCount = async (c, table) => (await one(c, 'SELECT count(*)::int AS n FROM pg_constraint WHERE conrelid = $1::regclass', [table])).n;

let codes = 0;
/** A shop with a paid order of one line, and the sale it became. */
async function shopWithOrder(c, slug) {
  const id = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Shop]', $1) RETURNING id", [slug])).id;
  await asShop(c, id);
  const site = (await one(c, 'SELECT id FROM sites ORDER BY id LIMIT 1'))?.id
    ?? (await one(c, "INSERT INTO sites (name, code) VALUES ('Bolton', 'B') RETURNING id")).id;
  const customer = (await one(c, "INSERT INTO customers (name, email) VALUES ('Maya Patel', 'maya@example.test') RETURNING id")).id;
  const product = (await one(c, "INSERT INTO products (sku, name, price, stock_qty) VALUES ('B05S-RX', 'Shimano brake pads B05S-RX', 28, 1) RETURNING id")).id;
  const sale = (await one(c, "INSERT INTO sales (subtotal, total, payment_method) VALUES (28, 28, 'Paid online') RETURNING id")).id;
  codes += 1;
  const order = (await insert(c, 'online_orders', { site_id: site, customer_id: customer, name: 'Maya Patel', email: 'maya@example.test',
    total_pence: 2800, card_pence: 2800, order_code: `[code ${codes}]`, request_key_hash: `[key ${codes}]`,
    number: 1, paid_at: new Date(), stage: 'to_get_ready', sale_id: sale })).rows[0].id;
  const line = (await insert(c, 'online_order_lines', { order_id: order, product_id: product, qty: 1, unit_pence: 2800 })).rows[0].id;
  return { id, customer, product, sale, order, line };
}
const refund = (c, s, extra = {}) => insert(c, 'online_order_refunds', {
  order_id: s.order, sale_id: s.sale, kind: 'shop_cancel', card_pence: 2800, card_refund_state: 'owed', reason: '[reason]', ...extra,
});

test('160 makes an order’s refunds and their lines the shop’s own, names orders on store credit and refunds on stock, and runs twice', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig160_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));

  await withClient(url.href, async (c) => {
    for (const table of TABLES) {
      const rls = await one(c, 'SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = $1', [table]);
      assert.deepEqual(rls, { relrowsecurity: true, relforcerowsecurity: true }, `${table}: row-level security on and forced`);
      const policy = await one(c, 'SELECT qual, with_check FROM pg_policies WHERE tablename = $1 AND policyname = $2', [table, `${table}_shop_isolation`]);
      assert.ok(policy, `${table}: its shop_isolation policy`);
      assert.match(policy.qual, /shop_id = .*app\.current_shop_id/);
      assert.match(policy.with_check, /shop_id = .*app\.current_shop_id/);
    }
    const a = await shopWithOrder(c, 's1');
    const b = await shopWithOrder(c, 's2');

    // ---- A refund: why, how much each way, and the card part owed then made ----
    await asShop(c, a.id);
    const owed = (await refund(c, a)).rows[0];
    assert.deepEqual([owed.shop_id, owed.credit_pence, owed.employee_id, owed.card_refunded_at], [a.id, 0, null, null]);
    assert.ok(owed.created_at);
    await c.query("UPDATE online_order_refunds SET card_refund_state = 'made', card_refunded_at = now() WHERE id = $1", [owed.id]);
    await assert.rejects(c.query("UPDATE online_order_refunds SET card_refund_state = 'owed' WHERE id = $1", [owed.id]), /check/i, 'owed has no refunded time');
    await assert.rejects(c.query('UPDATE online_order_refunds SET card_refunded_at = NULL WHERE id = $1', [owed.id]), /check/i, 'made has its time');
    const credit = (await refund(c, a, { kind: 'customer_cancel', card_pence: 0, credit_pence: 500, card_refund_state: null })).rows[0];
    assert.equal(credit.card_refund_state, null, 'no card part, no state');
    await refund(c, a, { kind: 'cant_supply', card_pence: 2300, credit_pence: 500 });
    await assert.rejects(refund(c, a, { kind: 'changed_mind' }), /check/i);
    await assert.rejects(refund(c, a, { card_pence: 0, card_refund_state: null }), /check/i, 'something goes back');
    await assert.rejects(refund(c, a, { card_pence: -1 }), /check/i);
    await assert.rejects(refund(c, a, { credit_pence: -1 }), /check/i);
    await assert.rejects(refund(c, a, { card_refund_state: null }), /check/i, 'a card part has a state');
    await assert.rejects(refund(c, a, { card_pence: 0, credit_pence: 500 }), /check/i, 'no card part has no state');
    await assert.rejects(refund(c, a, { card_pence: 0, credit_pence: 500, card_refund_state: null, card_refunded_at: new Date() }), /check/i, 'no card part, no refunded time');
    await assert.rejects(refund(c, a, { card_refund_state: 'maybe' }), /check/i);
    await assert.rejects(refund(c, a, { reason: 'x'.repeat(501) }), /check/i);
    await refund(c, a, { reason: 'x'.repeat(500) });

    // ---- Its lines: which of the order's lines, how many, each once ----
    await insert(c, 'online_order_refund_lines', { refund_id: owed.id, order_line_id: a.line, qty: 1 });
    await assert.rejects(insert(c, 'online_order_refund_lines', { refund_id: owed.id, order_line_id: a.line, qty: 1 }), /unique|duplicate/i);
    await assert.rejects(insert(c, 'online_order_refund_lines', { refund_id: credit.id, order_line_id: a.line, qty: 0 }), /check/i);

    // ---- Store credit names its order; stock names the refund ----
    const spent = (await insert(c, 'store_credit_entries', { customer_id: a.customer, change_pence: -500, kind: 'spent', online_order_id: a.order })).rows[0];
    assert.equal(spent.online_order_id, a.order);
    assert.equal((await insert(c, 'store_credit_entries', { customer_id: a.customer, change_pence: 500, kind: 'added' })).rows[0].online_order_id, null);
    const back = (await insert(c, 'stock_movements', { product_id: a.product, change_qty: 1, type: 'return', online_order_refund_id: owed.id })).rows[0];
    assert.equal(back.online_order_refund_id, owed.id);
    await assert.rejects(insert(c, 'store_credit_entries', { customer_id: a.customer, change_pence: 1, kind: 'refund', online_order_id: 999999 }), /foreign key/i);
    await assert.rejects(insert(c, 'stock_movements', { product_id: a.product, change_qty: 1, type: 'return', online_order_refund_id: 999999 }), /foreign key/i);

    // ---- Another shop sees none of it, and can't name it ----
    await asShop(c, b.id);
    for (const table of TABLES) assert.equal((await c.query(`SELECT 1 FROM ${table}`)).rows.length, 0, table);
    await assert.rejects(refund(c, { ...b, order: a.order }), /foreign key/i, 'another shop’s order');
    await assert.rejects(refund(c, { ...b, sale: a.sale }), /foreign key/i, 'another shop’s sale');
    await assert.rejects(c.query("INSERT INTO online_order_refunds (shop_id, order_id, sale_id, kind, credit_pence) VALUES ($1, $2, $3, 'shop_cancel', 1)", [a.id, a.order, a.sale]), /row-level security/i);
    const theirs = (await refund(c, b)).rows[0];
    await assert.rejects(insert(c, 'online_order_refund_lines', { refund_id: theirs.id, order_line_id: a.line, qty: 1 }), /foreign key/i, 'another shop’s line');
    await assert.rejects(insert(c, 'online_order_refund_lines', { refund_id: owed.id, order_line_id: b.line, qty: 1 }), /foreign key/i, 'another shop’s refund');
    await assert.rejects(insert(c, 'store_credit_entries', { customer_id: b.customer, change_pence: 1, kind: 'refund', online_order_id: a.order }), /foreign key/i);
    await assert.rejects(insert(c, 'stock_movements', { product_id: b.product, change_qty: 1, type: 'return', online_order_refund_id: owed.id }), /foreign key/i);

    // ---- The migration's own words, twice more, over rows already there ----
    const tables = [...TABLES, 'store_credit_entries', 'stock_movements', 'online_order_lines'];
    const before = {};
    for (const table of tables) before[table] = await constraintCount(c, table);
    await noShop(c);
    await runSql(c);
    await runSql(c);
    await asShop(c, a.id);
    for (const [table, n] of Object.entries(before)) assert.equal(await constraintCount(c, table), n, table);
    assert.equal((await c.query('SELECT 1 FROM online_order_refunds')).rows.length, 4);
    assert.equal((await one(c, 'SELECT online_order_id FROM store_credit_entries WHERE id = $1', [spent.id])).online_order_id, a.order);
    assert.equal((await one(c, 'SELECT online_order_refund_id FROM stock_movements WHERE id = $1', [back.id])).online_order_refund_id, owed.id);
  });
  assert.doesNotMatch(migrate(env), new RegExp(`Applied migration: ${FILE}`));
});

// As 154: every table it alters is locked ACCESS EXCLUSIVE before anything
// else runs, and every other table it locks only SHARE ROW EXCLUSIVE.
test('160 locks every table it alters ACCESS EXCLUSIVE before anything else', () => {
  const code = SQL.replace(/--[^\n]*/g, '');
  const statements = code.split(';').map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
  const locks = [];
  for (const statement of statements) {
    const m = statement.match(/^LOCK TABLE (.+) IN (.+) MODE$/i);
    if (!m) break;
    for (const table of m[1].split(',')) locks.push({ table: table.trim(), mode: m[2].toUpperCase() });
  }
  assert.ok(locks.length > 0, 'it starts with its locks');
  const altered = [...new Set([...code.matchAll(/ALTER TABLE (\w+)/gi)].map((m) => m[1]))].filter((x) => !TABLES.includes(x));
  assert.deepEqual(altered.sort(), ['stock_movements', 'store_credit_entries']);
  for (const table of altered) assert.deepEqual(locks.filter((l) => l.table === table).map((l) => l.mode), ['ACCESS EXCLUSIVE'], table);
  for (const l of locks.filter((x) => !altered.includes(x.table))) assert.equal(l.mode, 'SHARE ROW EXCLUSIVE', l.table);
});
