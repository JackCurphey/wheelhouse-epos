// Migration 123 (openspec/changes/restock-list, design 1): an order line's job, and when each
// person last opened the restock list, each business's own. From empty, under the app role,
// then run again. Placeholders throughout.
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
const FILE = '123_restock.sql';

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

test('123 gives an order line its job and keeps each person’s last look at the restock list, and runs twice', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig123_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    const shop = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Shop]', 's1') RETURNING id")).id;
    const otherShop = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Other shop]', 's2') RETURNING id")).id;
    await asShop(c, shop);
    const login = (await one(c, "INSERT INTO logins (shop_id, email, name, password_hash) VALUES ($1, 'owner@example.test', '[Owner]', '') RETURNING id", [shop])).id;
    const supplier = (await one(c, "INSERT INTO suppliers (name, adapter_type, config) VALUES ('[Supplier]', 'mock_csv', '{}') RETURNING id")).id;
    const product = (await one(c, "INSERT INTO products (name, category) VALUES ('[Product]', 'Parts') RETURNING id")).id;
    const job = (await one(c, "INSERT INTO workshop_jobs (title, job_date) VALUES ('[Job]', '2026-09-19') RETURNING id")).id;
    const order = (await one(c, 'INSERT INTO purchase_orders (supplier_id) VALUES ($1) RETURNING id', [supplier])).id;
    const line = await one(c, "INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, qty_ordered, unit_cost, workshop_job_id) VALUES ($1, $2, '[Product]', 1, 0, $3) RETURNING workshop_job_id", [order, product, job]);
    assert.equal(line.workshop_job_id, job);

    await c.query("INSERT INTO restock_seen (login_id, seen_keys) VALUES ($1, ARRAY['low:1'])", [login]);
    const seen = await one(c, 'SELECT shop_id, seen_keys, seen_at FROM restock_seen WHERE login_id = $1', [login]);
    assert.equal(seen.shop_id, shop);
    assert.deepEqual(seen.seen_keys, ['low:1']);
    assert.ok(seen.seen_at instanceof Date);

    await asShop(c, otherShop);
    assert.equal((await c.query('SELECT 1 FROM restock_seen')).rowCount, 0, 'another business never reads it');
    await assert.rejects(c.query("INSERT INTO restock_seen (login_id, shop_id, seen_keys) VALUES ($1, $2, '{}')", [login, shop]), /row-level security/i);

    await asShop(c, shop);
    await c.query('DELETE FROM workshop_jobs WHERE id = $1', [job]);
    assert.equal((await one(c, 'SELECT workshop_job_id FROM purchase_order_items WHERE purchase_order_id = $1', [order])).workshop_job_id, null, 'a removed job leaves the line');
    await c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
});
