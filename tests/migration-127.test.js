// Migration 127 (finish-customers; Jack's 9 Nov answer to the bike question, option 3): a
// "Bikes" or "E-bikes" mark on a category, and every category the old name rule matched marked
// "Bikes" in a business that has marked none. From empty, under the app role, then run again.
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
const FILE = '127_bike_categories.sql';
import { readFileSync } from 'node:fs';
const SQL = readFileSync(path.join(ROOT, 'server/migrations', FILE), 'utf8');

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

test('127 marks a category Bikes or E-bikes, marks what the old name rule matched, business by business, and runs twice', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig127_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    const shop = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Shop]', 's1') RETURNING id")).id;
    const marked = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Other shop]', 's2') RETURNING id")).id;
    const add = async (n, parent = null) => (await one(c, 'INSERT INTO product_categories (name, path, parent_id) VALUES ($1, $1, $2) RETURNING id', [n, parent])).id;
    await asShop(c, shop);
    const bikes = await add('Bikes');
    await add('E-bikes', bikes);
    for (const n of ['Road bikes', 'Kids’ bikes', 'Bike', 'Bike parts', 'Bike lights', 'Bikesheds', 'Drivetrain']) await add(n);
    await assert.rejects(c.query("UPDATE product_categories SET bike_kind = 'trikes' WHERE id = $1", [bikes]), /check/i);
    await asShop(c, marked);
    const theirs = await add('Bikes');
    const ebikes = await add('[Electric]');
    await c.query("UPDATE product_categories SET bike_kind = 'ebikes' WHERE id = $1", [ebikes]);

    // The migration's own words, run on businesses that already have categories, then again.
    await c.query("SELECT set_config('app.current_shop_id', '', false)");
    await c.query(SQL);
    await c.query(SQL);
    await asShop(c, shop);
    const kinds = Object.fromEntries((await c.query('SELECT name, bike_kind FROM product_categories ORDER BY id')).rows.map((r) => [r.name, r.bike_kind]));
    assert.deepEqual(kinds, { Bikes: 'bikes', 'E-bikes': 'bikes', 'Road bikes': 'bikes', 'Kids’ bikes': 'bikes', Bike: 'bikes', 'Bike parts': null, 'Bike lights': null, Bikesheds: null, Drivetrain: null });
    await asShop(c, marked);
    const mine = Object.fromEntries((await c.query('SELECT id, bike_kind FROM product_categories')).rows.map((r) => [r.id, r.bike_kind]));
    assert.deepEqual(mine, { [theirs]: null, [ebikes]: 'ebikes' }, 'a business that has marked one is left as it is');
  });
  assert.doesNotMatch(migrate(env), new RegExp(`Applied migration: ${FILE}`));
});
