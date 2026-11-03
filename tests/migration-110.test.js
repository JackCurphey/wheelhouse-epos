// Migration 110 (openspec/changes/delivery-booked-in, design 1): a delivery and
// its lines are kept. Run from empty, onto a database that already has an item
// set aside, then again.
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
const FILE = '110_deliveries.sql';
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

test('110 keeps a delivery and its lines, leaves older items alone, and is safe to run twice', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig110_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  // Everything before 110, from empty.
  await withClient(url.href, async (c) => {
    await c.query('CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    for (const f of LATER) await c.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
  });
  migrate(env);
  let ids;
  await withClient(url.href, async (c) => {
    const { rows: [shop] } = await c.query("INSERT INTO shops (name, slug) VALUES ('North Street Cycles', 'north-street-cycles') RETURNING id");
    const { rows: [other] } = await c.query("INSERT INTO shops (name, slug) VALUES ('[Other shop]', 'other-shop') RETURNING id");
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shop.id)]);
    const { rows: [product] } = await c.query("INSERT INTO products (sku, name, category, price, cost, stock_qty, updated_at) VALUES ('[Supplier code]', '[Product]', 'Parts', 28, 28, 0, now()) RETURNING id");
    // An item set aside from before 110.
    const { rows: [old] } = await c.query("INSERT INTO delivery_problems (product_id, kind, qty) VALUES ($1, 'damaged', 1) RETURNING id", [product.id]);
    ids = { shop: shop.id, other: other.id, product: product.id, old: old.id };
    await c.query('DELETE FROM schema_migrations WHERE filename = ANY($1)', [LATER]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(ids.shop)]);
    assert.deepEqual((await c.query('SELECT delivery_id, unit_cost FROM delivery_problems WHERE id = $1', [ids.old])).rows[0], { delivery_id: null, unit_cost: null });
    const { rows: [d] } = await c.query('INSERT INTO deliveries (booked_in_at) VALUES (now()) RETURNING id, supplier_id, booked_by_login_id');
    assert.equal(d.supplier_id, null, 'no supplier is allowed');
    assert.equal(d.booked_by_login_id, null);
    await c.query('INSERT INTO delivery_lines (delivery_id, product_id, qty, unit_cost) VALUES ($1, $2, 2, 28)', [d.id, ids.product]);
    await assert.rejects(c.query('INSERT INTO delivery_lines (delivery_id, product_id, qty, unit_cost) VALUES ($1, $2, 0, 28)', [d.id, ids.product]), /check/i);
    await assert.rejects(c.query('INSERT INTO delivery_lines (delivery_id, product_id, qty, unit_cost) VALUES (999999, $1, 1, 28)', [ids.product]), /foreign key/i);
    await c.query('UPDATE delivery_problems SET delivery_id = $1, unit_cost = 28 WHERE id = $2', [d.id, ids.old]);
    ids.delivery = d.id;
    // Row-level security holds on both tables. The test connection is the app
    // role, as `FORCE` applies to it: another shop sees neither.
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(ids.other)]);
    assert.equal((await c.query('SELECT id FROM deliveries')).rows.length, 0);
    assert.equal((await c.query('SELECT id FROM delivery_lines')).rows.length, 0);
  });
  // Run again on a database that already has it: it runs, and everything stays.
  await withClient(url.href, (c) => c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]));
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(ids.shop)]);
    assert.equal((await c.query('SELECT qty FROM delivery_lines WHERE delivery_id = $1', [ids.delivery])).rows[0].qty, 2);
    assert.equal((await c.query('SELECT delivery_id FROM delivery_problems WHERE id = $1', [ids.old])).rows[0].delivery_id, ids.delivery);
  });
});
