// Migration 109 (openspec/changes/delete-account, design 1): when a privacy
// request was cancelled, when a customer was deleted, and at most one open
// deletion request per customer. Run from empty, then again onto a database
// that already has requests.
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
const FILE = '109_delete_account.sql';
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
const ask = (c, customer, kind = 'delete') => c.query("INSERT INTO privacy_requests (customer_id, kind, source) VALUES ($1, $2, 'account') RETURNING id", [customer, kind]);

test('109: a cancelled request, a deleted customer, one open deletion request each; runs twice', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig109_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  assert.ok(LATER.includes(FILE), `${FILE} exists`);
  // Everything before 109, from empty, with a request already logged.
  await withClient(url.href, async (c) => {
    await c.query('CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    for (const f of LATER) await c.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
  });
  migrate(env);
  const ids = await withClient(url.href, async (c) => {
    const { rows: [shop] } = await c.query("INSERT INTO shops (name, slug) VALUES ('North Street Cycles', 'north-street-cycles') RETURNING id");
    await asShop(c, shop.id);
    const { rows: [maya] } = await c.query("INSERT INTO customers (name) VALUES ('Maya Patel') RETURNING id");
    const { rows: [old] } = await ask(c, maya.id);
    await c.query('DELETE FROM schema_migrations WHERE filename = ANY($1)', [LATER]);
    return { shop: shop.id, maya: maya.id, old: old.id };
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    await asShop(c, ids.shop);
    // The request from before is still the one open request.
    assert.deepEqual((await c.query('SELECT cancelled_at FROM privacy_requests WHERE id = $1', [ids.old])).rows[0], { cancelled_at: null });
    await assert.rejects(ask(c, ids.maya), /unique|duplicate/i, 'a second open deletion request');
    await ask(c, ids.maya, 'copy');
    // Cancelled, then asked again: a new open one.
    await c.query('UPDATE privacy_requests SET cancelled_at = now() WHERE id = $1', [ids.old]);
    const { rows: [again] } = await ask(c, ids.maya);
    await assert.rejects(ask(c, ids.maya), /unique|duplicate/i);
    // Done: another may be asked.
    await c.query('UPDATE privacy_requests SET done_at = now() WHERE id = $1', [again.id]);
    await ask(c, ids.maya);
    await c.query('UPDATE customers SET deleted_at = now(), active = 0 WHERE id = $1', [ids.maya]);
    assert.ok((await c.query('SELECT deleted_at FROM customers WHERE id = $1', [ids.maya])).rows[0].deleted_at instanceof Date);
  });
  // Run again on a database that already has it.
  await withClient(url.href, (c) => c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]));
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    await asShop(c, ids.shop);
    assert.equal((await c.query("SELECT count(*)::int AS n FROM privacy_requests WHERE kind = 'delete'")).rows[0].n, 3);
    await assert.rejects(ask(c, ids.maya), /unique|duplicate/i, 'still one open deletion request');
  });
});
