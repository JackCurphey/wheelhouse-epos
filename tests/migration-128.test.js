// Migration 128 (finish-customers, design 6; Jack's 9 Nov answers 3 and 4): bike brands with
// their warranty lines, a product's brand and own lines, and a customer's bike's lines. From
// empty, under the app role, each business kept to its own rows, then run again.
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
const FILE = '128_bike_warranty.sql';

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

test('128 adds brands, lines and a bike’s lines, each business its own, and runs twice', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig128_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    const shop = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Shop]', 's1') RETURNING id")).id;
    const other = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Other shop]', 's2') RETURNING id")).id;
    await asShop(c, shop);
    const trek = (await one(c, "INSERT INTO bike_brand_warranties (brand) VALUES ('Trek') RETURNING id")).id;
    await assert.rejects(c.query("INSERT INTO bike_brand_warranties (brand) VALUES (' trek ')"), /unique|duplicate/i, 'listed once, capitals and spaces ignored');
    await c.query("INSERT INTO warranty_lines (brand_warranty_id, part, years) VALUES ($1, 'frame', NULL), ($1, 'components', 2)", [trek]);
    await assert.rejects(c.query("INSERT INTO warranty_lines (brand_warranty_id, part, years) VALUES ($1, 'frame', 5)", [trek]), /unique|duplicate/i, 'each part once');
    for (const years of [0, 51]) await assert.rejects(c.query("INSERT INTO warranty_lines (brand_warranty_id, part, years) VALUES ($1, 'electronics', $2)", [trek, years]), /check/i);
    await assert.rejects(c.query("INSERT INTO warranty_lines (brand_warranty_id, part) VALUES ($1, 'saddle')", [trek]), /check/i);
    const product = (await one(c, "INSERT INTO products (sku, name, price, cost, stock_qty, brand, updated_at) VALUES ('[sku]', 'Trek Domane AL 3', 1, 1, 0, 'Trek', now()) RETURNING id")).id;
    await assert.rejects(c.query("INSERT INTO warranty_lines (brand_warranty_id, product_id, part) VALUES ($1, $2, 'frame')", [trek, product]), /check/i, 'a brand’s or a model’s, not both');
    await c.query("INSERT INTO warranty_lines (product_id, part, years) VALUES ($1, 'frame', NULL)", [product]);
    const customer = (await one(c, "INSERT INTO customers (name) VALUES ('Maya Patel') RETURNING id")).id;
    const bike = (await one(c, "INSERT INTO customer_bikes (customer_id, make, model) VALUES ($1, 'Trek', 'Domane AL 3') RETURNING id, is_ebike, bought_here_on", [customer]));
    assert.equal(bike.is_ebike, false);
    assert.equal(bike.bought_here_on, null);
    await c.query("INSERT INTO bike_warranty_lines (customer_bike_id, part, ends_on) VALUES ($1, 'frame', NULL)", [bike.id]);
    await asShop(c, other);
    assert.equal((await c.query('SELECT 1 FROM bike_brand_warranties UNION ALL SELECT 1 FROM warranty_lines UNION ALL SELECT 1 FROM bike_warranty_lines')).rowCount, 0, 'another business sees none');
    await c.query("INSERT INTO bike_brand_warranties (brand) VALUES ('Trek')");
  });
  assert.doesNotMatch(migrate(env), new RegExp(`Applied migration: ${FILE}`));
});
