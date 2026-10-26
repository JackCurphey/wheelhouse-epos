// Migration 093 (openspec/changes/adjust-stock design 1): a stock movement
// records its reason and who made it. Run from empty, then onto a database
// that already has a product and a stock movement, which keep as they were.
import '../server/load-env.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createAppDatabase, dropDatabase, adminUrlFrom, appRoleFrom } from '../scripts/dev/new-db.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATE = path.join(ROOT, 'server/migrations/run-migrations.js');
const FILE = '093_stock_movement_reason.sql';

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

test('093 adds a reason and who to stock movements, and keeps older lines', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig093_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  // Everything up to 093, then a product with a stock movement, then 093.
  await withClient(url.href, async (c) => {
    await c.query('CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    await c.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [FILE]);
  });
  migrate(env);
  let older;
  await withClient(url.href, async (c) => {
    const { rows: [shop] } = await c.query("INSERT INTO shops (name, slug) VALUES ('North Street Cycles', 'north-street-cycles') RETURNING id");
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shop.id)]);
    const { rows: [p] } = await c.query("INSERT INTO products (name, category, price, stock_qty) VALUES ('Shimano brake pads', '[Category]', 28, 6) RETURNING id");
    ({ rows: [older] } = await c.query("INSERT INTO stock_movements (product_id, change_qty, type, note) VALUES ($1, 6, 'intake', 'Initial stock') RETURNING id", [p.id]));
    await c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    const { rows: [shop] } = await c.query('SELECT id FROM shops LIMIT 1');
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shop.id)]);
    const { rows: [kept] } = await c.query('SELECT change_qty, note, reason, login_id FROM stock_movements WHERE id = $1', [older.id]);
    assert.deepEqual(kept, { change_qty: 6, note: 'Initial stock', reason: null, login_id: null });
    const { rows: [jack] } = await c.query("INSERT INTO logins (shop_id, name, email, password_hash, is_owner) VALUES ($1, 'Jack Lewis', 'jack@example.test', 'x', true) RETURNING id", [shop.id]);
    const { rows: [p] } = await c.query('SELECT id FROM products LIMIT 1');
    for (const reason of ['damaged', 'lost_stolen', 'used_workshop', 'faulty_return', 'found', 'other']) {
      await c.query("INSERT INTO stock_movements (product_id, change_qty, type, reason, note, login_id) VALUES ($1, -1, 'adjustment', $2, '', $3)", [p.id, reason, jack.id]);
    }
    await assert.rejects(c.query("INSERT INTO stock_movements (product_id, change_qty, type, reason) VALUES ($1, -1, 'adjustment', 'bored')", [p.id]), /check/i, 'only the drawn reasons');
    await assert.rejects(c.query("INSERT INTO stock_movements (product_id, change_qty, type, login_id) VALUES ($1, -1, 'adjustment', 999999)", [p.id]), /foreign key/i, 'who is a real login');
    // Run again: the shared dev database already ran it as 089.
    await c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`), 'safe to run twice');
  await withClient(url.href, async (c) => {
    const { rows } = await c.query("SELECT conname FROM pg_constraint WHERE conrelid = 'stock_movements'::regclass AND (conname LIKE '%reason%' OR conname LIKE '%login_id%')");
    assert.equal(rows.length, 2, `one check and one foreign key, not doubled: ${rows.map((r) => r.conname)}`);
  });
});
