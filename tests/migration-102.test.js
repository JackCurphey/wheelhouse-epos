// Migration 102 (openspec/changes/stock-warnings-on-today, the contract): the
// amount over which an adjustment shows on Today, on the shop's row; and on
// each stock line its value at cost, whether it is to be seen, and who saw it
// and when (stock control decision 6). Run from empty, then onto a database
// that already has a shop and stock lines, then again.
import '../server/load-env.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createAppDatabase, dropDatabase, adminUrlFrom, appRoleFrom } from '../scripts/dev/new-db.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATE = path.join(ROOT, 'server/migrations/run-migrations.js');
const FILE = '102_stock_warnings.sql';
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

test('102 adds the amount and each stock line’s value and Seen, and keeps each shop to its own', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig102_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  // Everything before 102, from empty.
  await withClient(url.href, async (c) => {
    await c.query('CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    for (const f of LATER) await c.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
  });
  migrate(env);
  let ids;
  await withClient(url.href, async (c) => {
    const { rows: [shop] } = await c.query("INSERT INTO shops (name, slug) VALUES ('North Street Cycles', 'north-street-cycles') RETURNING id");
    const { rows: [jack] } = await c.query("INSERT INTO logins (shop_id, name, email, password_hash) VALUES ($1, 'Jack Lewis', 'jack@example.test', 'x') RETURNING id", [shop.id]);
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shop.id)]);
    const { rows: [pads] } = await c.query("INSERT INTO products (name, price, cost, stock_qty) VALUES ('Shimano brake pads', 28, 14, 6) RETURNING id");
    // A line from before 102: an adjustment made with no value.
    const { rows: [old] } = await c.query("INSERT INTO stock_movements (product_id, change_qty, type, reason, login_id) VALUES ($1, -1, 'adjustment', 'damaged', $2) RETURNING id", [pads.id, jack.id]);
    ids = { shop: shop.id, jack: jack.id, pads: pads.id, old: old.id };
    await c.query('DELETE FROM schema_migrations WHERE filename = ANY($1)', [LATER]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    // Not set until the shop sets it; whole pence from £0 to £100,000.
    assert.equal((await c.query('SELECT stock_adjust_today_over_pence FROM shops WHERE id = $1', [ids.shop])).rows[0].stock_adjust_today_over_pence, null);
    await c.query('UPDATE shops SET stock_adjust_today_over_pence = 5000 WHERE id = $1', [ids.shop]);
    await assert.rejects(c.query('UPDATE shops SET stock_adjust_today_over_pence = -1 WHERE id = $1', [ids.shop]), /check/i);
    await assert.rejects(c.query('UPDATE shops SET stock_adjust_today_over_pence = 10000001 WHERE id = $1', [ids.shop]), /check/i);
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(ids.shop)]);
    // The older line: no value, not to see, not seen.
    const { rows: [old] } = await c.query('SELECT value_pence, to_see, seen_at, seen_by_login_id FROM stock_movements WHERE id = $1', [ids.old]);
    assert.deepEqual(old, { value_pence: null, to_see: false, seen_at: null, seen_by_login_id: null });
    const add = (value) => c.query("INSERT INTO stock_movements (product_id, change_qty, type, reason, login_id, value_pence, to_see) VALUES ($1, -2, 'adjustment', 'damaged', $2, $3, true) RETURNING id", [ids.pads, ids.jack, value]);
    const { rows: [big] } = await add(2800);
    await assert.rejects(add(-1), /check/i, 'never below nothing');
    await c.query('UPDATE stock_movements SET seen_at = now(), seen_by_login_id = $1 WHERE id = $2', [ids.jack, big.id]);
    await assert.rejects(c.query('UPDATE stock_movements SET seen_by_login_id = 999999 WHERE id = $1', [big.id]), /foreign key/i, 'who saw it is a real sign-in');
    // Another shop sees none of it.
    const { rows: [other] } = await c.query("INSERT INTO shops (name, slug) VALUES ('Other Cycles', 'other-cycles') RETURNING id");
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(other.id)]);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM stock_movements WHERE to_see')).rows[0].n, 0);
  });
  // Run again on a database that already has it: it runs without failing,
  // and the amount and the lines stay as they were.
  await withClient(url.href, (c) => c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]));
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    assert.equal((await c.query('SELECT stock_adjust_today_over_pence FROM shops WHERE id = $1', [ids.shop])).rows[0].stock_adjust_today_over_pence, 5000);
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(ids.shop)]);
    // A plain client reads a BIGINT as text; the app's pool reads it as a number (server/db.js).
    const { rows } = await c.query('SELECT value_pence::int AS value_pence, to_see, seen_by_login_id FROM stock_movements WHERE to_see ORDER BY id');
    assert.deepEqual(rows, [{ value_pence: 2800, to_see: true, seen_by_login_id: ids.jack }]);
  });
});
