// Migration 094 (openspec/changes/receive-without-order, migration 094): who
// booked stock in (stock_movements.login_id, the column jack/adjust-stock's
// 093 also adds, added only when missing), and a delivery problem without an
// order, kept with its supplier. Run from empty, then onto a database that
// already has a problem on an order, then again.
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
const FILE = '094_receive_without_order.sql';

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

test('094 records who booked stock in and keeps a problem without an order, per shop', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig094_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  // Everything up to 094, then a shop with a problem on an order, then 094.
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
    await c.query("INSERT INTO delivery_problems (purchase_order_id, purchase_order_item_id, product_id, kind, qty) VALUES ($1, $2, $3, 'missing', 1)", [o.id, i.id, p.id]);
    ids = { shop: shop.id, supplier: s.id, product: p.id, order: o.id, item: i.id };
    await c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));

  const check = async () => withClient(url.href, async (c) => {
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(ids.shop)]);
    // Who booked it in.
    const { rows: [col] } = await c.query("SELECT data_type FROM information_schema.columns WHERE table_name = 'stock_movements' AND column_name = 'login_id'");
    assert.equal(col?.data_type, 'integer');
    // A problem without an order, with its supplier; damaged or wrong only.
    const add = (kind, order = null, item = null, supplier = ids.supplier) => c.query(
      'INSERT INTO delivery_problems (purchase_order_id, purchase_order_item_id, product_id, supplier_id, kind, qty) VALUES ($1, $2, $3, $4, $5, 1) RETURNING *',
      [order, item, ids.product, supplier, kind]);
    const { rows: [d] } = await add('damaged');
    assert.equal(d.shop_id, ids.shop);
    assert.equal(d.supplier_id, ids.supplier);
    await add('wrong_item', null, null, null);
    await assert.rejects(add('missing'), /check/i, 'missing needs an order');
    await assert.rejects(add('damaged', ids.order, null), /check/i, 'an order and its line together');
    await assert.rejects(add('damaged', null, ids.item), /check/i, 'an order and its line together');
    await add('damaged', ids.order, ids.item);
    // Another shop sees none of it.
    await c.query("SELECT set_config('app.current_shop_id', (SELECT id::text FROM shops WHERE slug = 'other-cycles'), false)");
    assert.equal((await c.query('SELECT count(*)::int AS n FROM delivery_problems')).rows[0].n, 0);
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(ids.shop)]);
    return (await c.query('SELECT count(*)::int AS n FROM delivery_problems')).rows[0].n;
  });
  await withClient(url.href, (c) => c.query("INSERT INTO shops (name, slug) VALUES ('Other Cycles', 'other-cycles')"));
  // The problem made before 094 is kept; three more made here.
  assert.equal(await check(), 4);

  // Again, as a shared database or 093 first would: it runs, and nothing is lost.
  await withClient(url.href, (c) => c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]));
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  assert.equal(await check(), 7);
});
