// Migrations 117 and 118 (openspec/changes/stock-per-shop): every business has a first
// shop, existing stock is at its oldest, and older lines say their shop. From empty, onto
// a database holding three businesses' stock, under the app role, then run again.
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
const FILE = '117_stock_per_shop.sql';
const LINES = '118_older_stock_lines_shop.sql';
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
const inShop = (c, id) => c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(id)]);
const one = async (c, sql, args) => (await c.query(sql, args)).rows[0];

test('117 and 118 give every business a first shop, its stock and older lines their shop, and run twice', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig117_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  await withClient(url.href, async (c) => {
    await c.query('CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    for (const f of LATER) await c.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
  });
  migrate(env);

  const ids = {};
  await withClient(url.href, async (c) => {
    const shop = async (n, slug) => (await one(c, 'INSERT INTO shops (name, slug) VALUES ($1, $2) RETURNING id', [n, slug])).id;
    ids.none = await shop('North Street Cycles', 'north-street');
    ids.number = await shop('123 ☆', 'no-letters');
    ids.two = await shop('[Two shops]', 'two-shops');
    await inShop(c, ids.none);
    ids.pads = (await one(c, "INSERT INTO products (name, stock_qty) VALUES ('Shimano brake pads', 6) RETURNING id")).id;
    ids.under = (await one(c, "INSERT INTO products (name, stock_qty) VALUES ('[Under]', -2) RETURNING id")).id;
    ids.empty = (await one(c, "INSERT INTO products (name, stock_qty) VALUES ('[Empty]', 0) RETURNING id")).id;
    ids.line = (await one(c, "INSERT INTO stock_movements (product_id, change_qty, type) VALUES ($1, -1, 'sale') RETURNING id", [ids.pads])).id;
    ids.login = (await one(c, "INSERT INTO logins (shop_id, name, email, password_hash) VALUES ($1, '[Owner]', 'o@example.test', 'x') RETURNING id", [ids.none])).id;
    ids.take = (await one(c, "INSERT INTO stock_takes (kind, target, started_by_login_id) VALUES ('whole_shop', '', $1) RETURNING id", [ids.login])).id;
    await inShop(c, ids.two);
    ids.bolton = (await one(c, "INSERT INTO sites (name, code) VALUES ('Bolton', 'B') RETURNING id")).id;
    ids.second = (await one(c, "INSERT INTO sites (name, code) VALUES ('[Second site]', 'S') RETURNING id")).id;
    ids.till = (await one(c, "INSERT INTO tills (site_id, code, token_hash) VALUES ($1, 'S1', 'x') RETURNING id", [ids.second])).id;
    ids.theirs = (await one(c, "INSERT INTO products (name, stock_qty) VALUES ('[Product]', 4) RETURNING id")).id;
    ids.tillSale = (await one(c,
      `INSERT INTO till_sales (client_id, site_id, till_id, receipt_number, vat_pence, total_pence, made_offline, till_clock_at)
       VALUES (gen_random_uuid(), $1, $2, 1, 0, 100, false, now()) RETURNING id`, [ids.second, ids.till])).id;
    ids.sold = (await one(c, "INSERT INTO stock_movements (product_id, change_qty, type, till_sale_id) VALUES ($1, -1, 'till_sale', $2) RETURNING id", [ids.theirs, ids.tillSale])).id;
    ids.plain = (await one(c, "INSERT INTO stock_movements (product_id, change_qty, type) VALUES ($1, 5, 'intake') RETURNING id", [ids.theirs])).id;
    ids.kept = (await one(c, "INSERT INTO stock_movements (product_id, change_qty, type, site_id) VALUES ($1, 1, 'intake', $2) RETURNING id", [ids.theirs, ids.second])).id;
    await c.query('DELETE FROM schema_migrations WHERE filename = ANY($1)', [LATER]);
  });

  const out = migrate(env);
  assert.match(out, new RegExp(`Applied migration: ${FILE}`));
  assert.match(out, new RegExp(`Applied migration: ${LINES}`));

  const holds = async (c) => {
    // A business with none gets one, named after it, with its first letter.
    await inShop(c, ids.none);
    const sites = (await c.query('SELECT id, name, code FROM sites')).rows;
    assert.deepEqual(sites.map((s) => [s.name, s.code]), [['North Street Cycles', 'N']]);
    const first = sites[0].id;
    // Stock at that shop, below zero included; a product at nothing has no row.
    assert.deepEqual((await c.query('SELECT product_id, site_id, qty FROM product_stock ORDER BY qty DESC')).rows,
      [{ product_id: ids.pads, site_id: first, qty: 6 }, { product_id: ids.under, site_id: first, qty: -2 }]);
    assert.equal((await one(c, 'SELECT stock_qty FROM products WHERE id = $1', [ids.pads])).stock_qty, 6);
    assert.equal((await one(c, 'SELECT site_id FROM stock_movements WHERE id = $1', [ids.line])).site_id, first);
    assert.equal((await one(c, 'SELECT site_id FROM stock_takes WHERE id = $1', [ids.take])).site_id, first);
    // A name with no letter still gets a code.
    await inShop(c, ids.number);
    assert.deepEqual((await c.query('SELECT name, code FROM sites')).rows, [{ name: '123 ☆', code: 'A' }]);
    // Shops already there are left alone; stock goes to the oldest; a till sale's line
    // is the till's shop, a line that says already keeps it, any other the oldest.
    await inShop(c, ids.two);
    assert.deepEqual((await c.query('SELECT name FROM sites ORDER BY id')).rows.map((s) => s.name), ['Bolton', '[Second site]']);
    assert.deepEqual((await c.query('SELECT site_id, qty FROM product_stock')).rows, [{ site_id: ids.bolton, qty: 4 }]);
    const site = async (id) => (await one(c, 'SELECT site_id FROM stock_movements WHERE id = $1', [id])).site_id;
    assert.deepEqual([await site(ids.sold), await site(ids.plain), await site(ids.kept)], [ids.second, ids.bolton, ids.second]);
  };
  await withClient(url.href, holds);

  // The key for links can't be used to read a whole business's products (design 5).
  await withClient(url.href, async (c) => {
    const { rows: keys } = await c.query("SELECT indexdef FROM pg_indexes WHERE tablename = 'products' AND indexdef LIKE '%UNIQUE%(id, shop_id)%'");
    assert.equal(keys.length, 1);
    const { rows: leading } = await c.query("SELECT indexname FROM pg_indexes WHERE tablename = 'products' AND indexdef LIKE '%(shop_id, id)%'");
    assert.deepEqual(leading, []);
  });

  // Each business's stock is its own, and can't point at another's.
  await withClient(url.href, async (c) => {
    await inShop(c, ids.none);
    assert.equal((await one(c, 'SELECT count(*)::int AS n FROM product_stock WHERE product_id = $1', [ids.theirs])).n, 0, 'read');
    assert.equal((await c.query('UPDATE product_stock SET qty = 99 WHERE product_id = $1', [ids.theirs])).rowCount, 0, 'changed');
    assert.equal((await c.query('DELETE FROM product_stock WHERE product_id = $1', [ids.theirs])).rowCount, 0, 'deleted');
    const mine = (await one(c, 'SELECT id FROM sites')).id;
    await assert.rejects(c.query('INSERT INTO product_stock (site_id, product_id, qty) VALUES ($1, $2, 1)', [ids.bolton, ids.empty]), /foreign key/i, 'another business’s shop');
    await assert.rejects(c.query('INSERT INTO product_stock (site_id, product_id, qty) VALUES ($1, $2, 1)', [mine, ids.theirs]), /foreign key/i, 'another business’s product');
    await assert.rejects(c.query('INSERT INTO product_stock (shop_id, site_id, product_id, qty) VALUES ($1, $2, $3, 1)', [ids.two, ids.bolton, ids.theirs]), /row-level security/i, 'a row for another business');
  });

  // Run again, with stock since moved to another shop: nothing doubles.
  await withClient(url.href, async (c) => {
    await inShop(c, ids.two);
    await c.query('DELETE FROM product_stock WHERE product_id = $1', [ids.theirs]);
    await c.query('INSERT INTO product_stock (site_id, product_id, qty) VALUES ($1, $2, 4)', [ids.second, ids.theirs]);
    await c.query('DELETE FROM schema_migrations WHERE filename = ANY($1)', [[FILE, LINES]]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    await inShop(c, ids.two);
    assert.deepEqual((await c.query('SELECT site_id, qty FROM product_stock')).rows, [{ site_id: ids.second, qty: 4 }]);
    await c.query('DELETE FROM product_stock WHERE product_id = $1', [ids.theirs]);
    await c.query('INSERT INTO product_stock (site_id, product_id, qty) VALUES ($1, $2, 4)', [ids.bolton, ids.theirs]);
    await holds(c);
  });
});
