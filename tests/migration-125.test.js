// Migration 125 (openspec/changes/frame-numbers, design 2): each bike's frame number in stock,
// each business's own, no frame in stock twice. From empty, under the app role, then run again.
// Placeholders throughout.
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
const FILE = '125_stock_frames.sql';

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

test('125 keeps each frame, once in stock, to its business, room for its sale, and runs twice', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig125_${process.pid}`;
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
    const product = (await one(c, "INSERT INTO products (name, category) VALUES ('[Bike]', 'Bikes') RETURNING id")).id;
    const f = await one(c, "INSERT INTO stock_frames (product_id, frame_number, frame_key) VALUES ($1, '[frame 1]', '[FRAME1]') RETURNING shop_id, state, received_at, sold_at, customer_id, customer_bike_id", [product]);
    assert.deepEqual([f.shop_id, f.state, f.sold_at, f.customer_id, f.customer_bike_id], [shop, 'in_stock', null, null, null]);
    assert.ok(f.received_at instanceof Date);
    await assert.rejects(c.query("INSERT INTO stock_frames (product_id, frame_number, frame_key) VALUES ($1, '[frame 1]', '[FRAME1]')", [product]), /idx_stock_frames_in_stock/);
    await assert.rejects(c.query("INSERT INTO stock_frames (product_id, frame_number, frame_key, state) VALUES ($1, '[frame 2]', '[FRAME2]', 'lost')", [product]), /check/i);
    await c.query("UPDATE stock_frames SET state = 'sold', sold_at = now() WHERE frame_key = '[FRAME1]'");
    await c.query("INSERT INTO stock_frames (product_id, frame_number, frame_key) VALUES ($1, '[frame 1]', '[FRAME1]')", [product]);

    await asShop(c, otherShop);
    assert.equal((await c.query('SELECT 1 FROM stock_frames')).rowCount, 0, 'another business never reads it');
    await assert.rejects(c.query("INSERT INTO stock_frames (shop_id, product_id, frame_number, frame_key) VALUES ($1, $2, '[frame 3]', '[FRAME3]')", [shop, product]), /row-level security/i);

    await asShop(c, shop);
    await c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
});
