// Migration 090 (openspec/changes/receive-delivery, the contract): what was
// wrong with a delivery (receiving decision 9) — damaged, wrong item or
// missing, how many and a note — kept per shop. Run from empty, then onto a
// database that already has a shop with an order.
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
const FILE = '090_delivery_problems.sql';

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

test('090 adds delivery problems and keeps each shop to its own', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig090_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  await withClient(url.href, async (c) => {
    await c.query('CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    await c.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [FILE]);
  });
  migrate(env);
  let ids;
  await withClient(url.href, async (c) => {
    const { rows: [shop] } = await c.query("INSERT INTO shops (name, slug) VALUES ('North Street Cycles', 'north-street-cycles') RETURNING id");
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shop.id)]);
    const { rows: [s] } = await c.query("INSERT INTO suppliers (name, adapter_type, config) VALUES ('[Supplier]', 'mock_csv', '{}') RETURNING id");
    const { rows: [p] } = await c.query("INSERT INTO products (sku, name, category, price) VALUES ('B05S-RX', 'Shimano brake pads', 'Parts', 28) RETURNING id");
    const { rows: [o] } = await c.query("INSERT INTO purchase_orders (supplier_id, status) VALUES ($1, 'ordered') RETURNING id", [s.id]);
    const { rows: [i] } = await c.query("INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, product_sku, qty_ordered) VALUES ($1, $2, 'Shimano brake pads', 'B05S-RX', 2) RETURNING id", [o.id, p.id]);
    ids = { shop: shop.id, product: p.id, order: o.id, item: i.id };
    await c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(ids.shop)]);
    const add = (kind, qty, note = '') => c.query('INSERT INTO delivery_problems (purchase_order_id, purchase_order_item_id, product_id, kind, qty, note) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [ids.order, ids.item, ids.product, kind, qty, note]);
    const { rows: [d] } = await add('damaged', 1, 'box crushed');
    assert.equal(d.shop_id, ids.shop);
    assert.ok(d.created_at instanceof Date);
    await add('wrong_item', 1);
    await add('missing', 1);
    await assert.rejects(add('lost', 1), /check/i, 'damaged, wrong item or missing only');
    await assert.rejects(add('damaged', 0), /check/i, 'at least one');
    // Another shop sees none of it.
    const { rows: [other] } = await c.query("INSERT INTO shops (name, slug) VALUES ('Other Cycles', 'other-cycles') RETURNING id");
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(other.id)]);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM delivery_problems')).rows[0].n, 0);
  });
});
