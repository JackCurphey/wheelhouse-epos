// Migration 084 (openspec/changes/customer-account-server, Jack's option 2 of
// 26 Oct): customers.email_from_customer, false for every customer already
// there (where their email came from isn't known), set by an online booking.
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
const FILE = '084_customer_email_from_customer.sql';

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

test('084 marks no existing customer’s email as their own', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig084_${process.pid}`;
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
  await withClient(url.href, async (c) => {
    const { rows: [shop] } = await c.query("INSERT INTO shops (name, slug) VALUES ('North Street Cycles', 'north-street-cycles') RETURNING id");
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shop.id)]);
    await c.query("INSERT INTO customers (name, email) VALUES ('Maya Patel', 'maya@example.test')");
    await c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    const { rows: [col] } = await c.query("SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'email_from_customer'");
    assert.deepEqual([col.data_type, col.is_nullable, col.column_default], ['boolean', 'NO', 'false']);
    await c.query("SELECT set_config('app.current_shop_id', (SELECT id::text FROM shops LIMIT 1), false)");
    const { rows: [maya] } = await c.query("SELECT email_from_customer FROM customers WHERE email = 'maya@example.test'");
    assert.equal(maya.email_from_customer, false);
  });
});
