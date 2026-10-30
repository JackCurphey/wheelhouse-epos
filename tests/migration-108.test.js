// Migration 108 (openspec/changes/your-data-copy, design 1): the privacy
// requests log, kept to its shop. Run from empty, then again onto a database
// that already has a request logged.
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
const FILE = '108_privacy_requests.sql';
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
const asShop = (c, id) => c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(id)]);

test('108 logs privacy requests per shop, and runs twice', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig108_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  assert.ok(LATER.includes(FILE), `${FILE} exists`);
  // Everything before 108, from empty.
  await withClient(url.href, async (c) => {
    await c.query('CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    for (const f of LATER) await c.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
  });
  migrate(env);
  await withClient(url.href, (c) => c.query('DELETE FROM schema_migrations WHERE filename = ANY($1)', [LATER]));
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  const ids = await withClient(url.href, async (c) => {
    const { rows: [north] } = await c.query("INSERT INTO shops (name, slug) VALUES ('North Street Cycles', 'north-street-cycles') RETURNING id");
    const { rows: [other] } = await c.query("INSERT INTO shops (name, slug) VALUES ('Elsewhere Cycles', 'elsewhere-cycles') RETURNING id");
    await asShop(c, north.id);
    const { rows: [maya] } = await c.query("INSERT INTO customers (name) VALUES ('Maya Patel') RETURNING id");
    // The sign-in that asked, so Undo of a merge can send it back with that sign-in (review of #587).
    const { rows: [login] } = await c.query("INSERT INTO customer_logins (shop_id, customer_id, email, password_hash) VALUES ($1, $2, 'maya@example.test', '') RETURNING id", [north.id, maya.id]);
    const { rows: [req] } = await c.query("INSERT INTO privacy_requests (customer_id, customer_login_id, kind, source, done_at) VALUES ($1, $2, 'copy', 'account', now()) RETURNING id, asked_at, done_at, customer_login_id", [maya.id, login.id]);
    assert.equal(req.customer_login_id, login.id);
    await assert.rejects(c.query("INSERT INTO privacy_requests (customer_id, customer_login_id, kind, source) VALUES ($1, 999999, 'copy', 'account')", [maya.id]), /foreign key/i);
    // Written for another shop: refused.
    await assert.rejects(c.query("INSERT INTO privacy_requests (shop_id, customer_id, kind, source) VALUES ($1, $2, 'copy', 'account')", [other.id, maya.id]), /row-level security/i);
    assert.ok(req.asked_at instanceof Date);
    // Only the drawn kinds and sources.
    await assert.rejects(c.query("INSERT INTO privacy_requests (customer_id, kind, source) VALUES ($1, 'sell', 'account')", [maya.id]), /check/i);
    await assert.rejects(c.query("INSERT INTO privacy_requests (customer_id, kind, source) VALUES ($1, 'copy', 'email')", [maya.id]), /check/i);
    // A delete request from the shop, still open.
    await c.query("INSERT INTO privacy_requests (customer_id, kind, source) VALUES ($1, 'delete', 'shop')", [maya.id]);
    // Another shop sees none of it.
    await asShop(c, other.id);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM privacy_requests')).rows[0].n, 0);
    return { north: north.id, maya: maya.id, req: req.id, login: login.id };
  });
  // Run again on a database that already has it: it runs, and everything stays.
  await withClient(url.href, (c) => c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]));
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    await asShop(c, ids.north);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM privacy_requests')).rows[0].n, 2);
    // The log outlives the customer record (design 1).
    assert.equal((await c.query('SELECT customer_login_id FROM privacy_requests WHERE id = $1', [ids.req])).rows[0].customer_login_id, ids.login);
    await c.query('DELETE FROM customer_logins WHERE id = $1', [ids.login]);
    await c.query('DELETE FROM customers WHERE id = $1', [ids.maya]);
    assert.deepEqual((await c.query('SELECT customer_id, customer_login_id FROM privacy_requests WHERE id = $1', [ids.req])).rows[0], { customer_id: null, customer_login_id: null });
  });
});
