// Migration 098 (openspec/changes/whos-in-and-first-pin, the contract): when
// a sign-in was last asked for its first PIN, and when a person's PIN was
// last cleared. Run from empty, then onto a database that already has a
// shop, then again.
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
const FILE = '098_first_pin.sql';
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

test('098 adds when a sign-in was asked and when a PIN was cleared', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig098_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  // Every migration before 098 from empty, then a shop, then 098 onto it.
  await withClient(url.href, async (c) => {
    await c.query('CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    for (const f of LATER) await c.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
  });
  migrate(env);
  const ids = {};
  await withClient(url.href, async (c) => {
    const { rows: [shop] } = await c.query("INSERT INTO shops (name, slug) VALUES ('North Street Cycles', 'north-street-cycles') RETURNING id");
    ids.shop = shop.id;
    await inShop(c, shop.id);
    const { rows: [jo] } = await c.query("INSERT INTO employees (name, is_cashier) VALUES ('Jo Taylor', 1) RETURNING id");
    const { rows: [login] } = await c.query("INSERT INTO logins (shop_id, name, email, password_hash, employee_id) VALUES ($1, 'Jo Taylor', 'jo@example.test', 'x', $2) RETURNING id", [shop.id, jo.id]);
    Object.assign(ids, { jo: jo.id, login: login.id });
    await c.query('DELETE FROM schema_migrations WHERE filename = ANY($1)', [LATER]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  const read = (c) => c.query('SELECT l.till_pin_asked_at, e.pin_cleared_at FROM logins l JOIN employees e ON e.id = l.employee_id WHERE l.id = $1', [ids.login]);
  await withClient(url.href, async (c) => {
    await inShop(c, ids.shop);
    assert.deepEqual((await read(c)).rows[0], { till_pin_asked_at: null, pin_cleared_at: null }, 'nobody asked or cleared yet');
    await c.query('UPDATE logins SET till_pin_asked_at = now() WHERE id = $1', [ids.login]);
    await c.query('UPDATE employees SET pin_cleared_at = now() WHERE id = $1', [ids.jo]);
  });
  // Run again: it runs without failing, and what was kept stays.
  await withClient(url.href, (c) => c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]));
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    await inShop(c, ids.shop);
    const row = (await read(c)).rows[0];
    assert.ok(row.till_pin_asked_at instanceof Date && row.pin_cleared_at instanceof Date);
  });
});
