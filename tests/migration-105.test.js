// Migration 105 (openspec/changes/to-return, design 1): when an item set
// aside at booking in was returned, and by whom. Run from empty, then onto a
// database that already has a problem recorded, then again.
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
const FILE = '105_returned_items.sql';
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

test('105 records when an item set aside was returned and by whom, none for older ones', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig105_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  // Everything before 105, from empty.
  await withClient(url.href, async (c) => {
    await c.query('CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    for (const f of LATER) await c.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
  });
  migrate(env);
  let ids;
  await withClient(url.href, async (c) => {
    const { rows: [shop] } = await c.query("INSERT INTO shops (name, slug) VALUES ('North Street Cycles', 'north-street-cycles') RETURNING id");
    const { rows: [jack] } = await c.query("INSERT INTO logins (shop_id, name, email, password_hash, is_owner) VALUES ($1, 'Jack Lewis', 'jack@example.test', 'x', true) RETURNING id", [shop.id]);
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shop.id)]);
    const { rows: [product] } = await c.query("INSERT INTO products (sku, name, category, price, cost, stock_qty, updated_at) VALUES ('[Supplier code]', '[Product]', 'Parts', 28, 28, 0, now()) RETURNING id");
    // A problem from before 105: damaged, not on an order.
    const { rows: [old] } = await c.query("INSERT INTO delivery_problems (product_id, kind, qty) VALUES ($1, 'damaged', 1) RETURNING id", [product.id]);
    ids = { shop: shop.id, jack: jack.id, old: old.id };
    await c.query('DELETE FROM schema_migrations WHERE filename = ANY($1)', [LATER]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(ids.shop)]);
    assert.deepEqual((await c.query('SELECT returned_at, returned_by_login_id FROM delivery_problems WHERE id = $1', [ids.old])).rows[0], { returned_at: null, returned_by_login_id: null });
    await c.query("UPDATE delivery_problems SET returned_at = '2026-09-01T10:00:00Z', returned_by_login_id = $1 WHERE id = $2", [ids.jack, ids.old]);
    await assert.rejects(c.query('UPDATE delivery_problems SET returned_by_login_id = 999999 WHERE id = $1', [ids.old]), /foreign key/i);
  });
  // Run again on a database that already has it: it runs, and everything stays.
  await withClient(url.href, (c) => c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]));
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(ids.shop)]);
    const row = (await c.query('SELECT returned_at, returned_by_login_id FROM delivery_problems WHERE id = $1', [ids.old])).rows[0];
    assert.equal(row.returned_by_login_id, ids.jack);
    assert.equal(row.returned_at.toISOString(), '2026-09-01T10:00:00.000Z');
  });
});
