// Migration 145 (cycle-to-work design 4): an order's hold, recorded as when the
// bike was put aside and when it was let go. From empty, under the app role, a
// quote made with a hold date before it counts as held, then run again.
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
const FILE = '145_c2w_holds.sql';

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

test('145 records when an order’s bike was held and released, counts older holds as held, and runs twice', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig145_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    const cols = (await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'c2w_orders' AND column_name IN ('held_at', 'released_at') ORDER BY column_name")).rows;
    assert.deepEqual(cols.map((r) => [r.column_name, r.data_type]), [['held_at', 'timestamp with time zone'], ['released_at', 'timestamp with time zone']]);

    // A quote with a hold date, as pull request 3 made them, then the backfill run again.
    const shop = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Shop]', 's1') RETURNING id")).id;
    await asShop(c, shop);
    const customer = (await one(c, "INSERT INTO customers (name) VALUES ('Maya Patel') RETURNING id")).id;
    const provider = (await one(c, "INSERT INTO c2w_providers (name) VALUES ('[Provider]') RETURNING id")).id;
    const product = (await one(c, "INSERT INTO products (sku, name, price, cost, stock_qty) VALUES ('[sku]', '[Bike]', 1, 0, 1) RETURNING id")).id;
    const held = (await one(c, "INSERT INTO c2w_orders (customer_id, provider_id, product_id, quote_number, total_pence, customer_code, quote_given_at, hold_until) VALUES ($1, $2, $3, 1, 1, '[code 1]', '2026-09-01T09:00:00Z', '2026-09-08') RETURNING id", [customer, provider, product])).id;
    await c.query("INSERT INTO c2w_orders (customer_id, provider_id, product_id, quote_number, total_pence, customer_code) VALUES ($1, $2, $3, 2, 1, '[code 2]')", [customer, provider, product]);
    assert.equal((await one(c, 'SELECT held_at FROM c2w_orders WHERE id = $1', [held])).held_at, null);
    // Run the whole file again over them: it adds nothing twice and fills in the old hold.
    await c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`), 'runs a second time');
  await withClient(url.href, async (c) => {
    await asShop(c, (await one(c, "SELECT id FROM shops WHERE slug = 's1'")).id);
    const rows = (await c.query('SELECT quote_number, held_at, released_at FROM c2w_orders ORDER BY quote_number')).rows;
    assert.equal(rows[0].held_at?.toISOString(), '2026-09-01T09:00:00.000Z', 'a quote with a hold date was held when given');
    assert.equal(rows[1].held_at, null, 'one without a hold date was never held');
    assert.equal(rows[0].released_at, null);
    const idx = await one(c, "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_c2w_orders_held'");
    assert.match(idx.indexdef, /WHERE \(\(held_at IS NOT NULL\) AND \(frame_id IS NULL\)\)/);
  });
  assert.doesNotMatch(migrate(env), new RegExp(`Applied migration: ${FILE}`), 'already applied');
});
