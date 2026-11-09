// Migration 124 (openspec/changes/bulk-price-change, design 1): a bulk price change, each
// business's own, and the batch on each price line it wrote. From empty, under the app role,
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
const FILE = '124_price_change_batches.sql';

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


test('124 records a bulk change, ties its price lines to it, keeps it to its business, and runs twice', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig124_${process.pid}`;
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
    const product = (await one(c, "INSERT INTO products (name, category) VALUES ('[Product]', 'Parts') RETURNING id")).id;
    const batch = await one(c, "INSERT INTO price_change_batches (login_id, who_name) VALUES ($1, '[Owner]') RETURNING id, shop_id, created_at, undone_at", [login]);
    assert.equal(batch.shop_id, shop);
    assert.ok(batch.created_at instanceof Date);
    assert.equal(batch.undone_at, null);
    const line = await one(c, "INSERT INTO product_price_changes (product_id, field, was_pence, now_pence, batch_id) VALUES ($1, 'price', 2800, 3099, $2) RETURNING batch_id", [product, batch.id]);
    assert.equal(line.batch_id, batch.id);
    await assert.rejects(c.query("INSERT INTO product_price_changes (product_id, field, was_pence, now_pence, batch_id) VALUES ($1, 'price', 1, 2, 999999)", [product]), /foreign key/i);

    await asShop(c, otherShop);
    assert.equal((await c.query('SELECT 1 FROM price_change_batches')).rowCount, 0, 'another business never reads it');
    await assert.rejects(c.query('INSERT INTO price_change_batches (shop_id) VALUES ($1)', [shop]), /row-level security/i);
    await assert.rejects(c.query("INSERT INTO product_price_changes (product_id, field, was_pence, now_pence, batch_id) VALUES ($1, 'price', 1, 2, $2)", [product, batch.id]), /row-level security|foreign key/i);

    await asShop(c, shop);
    await c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
});
