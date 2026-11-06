// Migration 121 (openspec/changes/product-editing): a number answer kept as whole
// ten-thousandths too, held equal by the database, for searching under row-level security.
// From empty, under the app role, then run again. Placeholders throughout.
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
const FILE = '121_product_detail_keys.sql';
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
const one = async (c, sql, args) => (await c.query(sql, args)).rows[0];

test('121 keeps a number answer’s key equal to it, and runs twice', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig121_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    const shop = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Shop]', 's') RETURNING id")).id;
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shop)]);
    const cat = (await one(c, "INSERT INTO product_categories (name, path) VALUES ('Bearings', 'Bearings') RETURNING id")).id;
    const detail = (await one(c, "INSERT INTO category_details (category_id, name, kind, unit) VALUES ($1, 'Outer diameter', 'number', 'mm') RETURNING id", [cat])).id;
    const product = (await one(c, "INSERT INTO products (name, category) VALUES ('[Bearing]', 'Bearings') RETURNING id")).id;
    const put = (n, key) => c.query('INSERT INTO product_details (product_id, detail_id, value_number, value_key) VALUES ($1, $2, $3, $4)', [product, detail, n, key]);
    await assert.rejects(put('30', 30), /check/i, 'a key that isn’t the number');
    await assert.rejects(put('30.00001', 300000), /check/i, 'more than four places');
    await assert.rejects(put('30', null), /check/i, 'a number with no key');
    await put('30.5', 305000);
    await c.query("INSERT INTO product_details (product_id, detail_id, value_text) VALUES ($1, (SELECT id FROM category_details WHERE id = $2), NULL) ON CONFLICT DO NOTHING", [product, detail]);
    await c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    const { rows } = await c.query("SELECT indexname FROM pg_indexes WHERE tablename = 'product_details' AND indexname LIKE 'idx_product_details_detail_%' ORDER BY 1");
    assert.deepEqual(rows.map((r) => r.indexname), ['idx_product_details_detail_key', 'idx_product_details_detail_text']);
    const { rows: groups } = await c.query("SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_product_groups_shop'");
    assert.match(groups[0]?.indexdef ?? '', /\(shop_id, category, name\)/, 'a business’s products with sizes read by its own index');
  });
});
