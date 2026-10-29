// Migration 105 (openspec/changes/workshop-lock-server, design 1): which
// workshop computer a signed-in session belongs to. Run from empty, then onto
// a database that already has a session and a workshop computer, then again.
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
const FILE = '105_session_workshop_computer.sql';
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

test('105 records which workshop computer a session belongs to, none for older sessions', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig105_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  // Everything before 105, from empty.
  await withClient(url.href, async (c) => {
    await c.query('CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    for (const f of LATER) await c.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
  });
  migrate(env);
  let ids;
  await withClient(url.href, async (c) => {
    const { rows: [shop] } = await c.query("INSERT INTO shops (name, slug) VALUES ('North Street Cycles', 'north-street-cycles') RETURNING id");
    const { rows: [jack] } = await c.query("INSERT INTO logins (shop_id, name, email, password_hash, is_owner) VALUES ($1, 'Jack Lewis', 'jack@example.test', 'x', true) RETURNING id", [shop.id]);
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shop.id)]);
    const { rows: [site] } = await c.query("INSERT INTO sites (name, code) VALUES ('Bolton', 'B') RETURNING id");
    const { rows: [work] } = await c.query("INSERT INTO workshop_computers (site_id, browser_token_hash) VALUES ($1, 'w1') RETURNING id", [site.id]);
    // A session from before 105.
    await c.query("INSERT INTO sessions (token, login_id, expires_at) VALUES ('s1', $1, now() + interval '1 day')", [jack.id]);
    ids = { shop: shop.id, work: work.id };
    await c.query('DELETE FROM schema_migrations WHERE filename = ANY($1)', [LATER]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    assert.equal((await c.query("SELECT workshop_computer_id FROM sessions WHERE token = 's1'")).rows[0].workshop_computer_id, null);
    await c.query("UPDATE sessions SET workshop_computer_id = $1 WHERE token = 's1'", [ids.work]);
    await assert.rejects(c.query("UPDATE sessions SET workshop_computer_id = 999999 WHERE token = 's1'"), /foreign key/i);
  });
  // Run again on a database that already has it: it runs, and everything stays.
  await withClient(url.href, (c) => c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]));
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    assert.equal((await c.query("SELECT workshop_computer_id FROM sessions WHERE token = 's1'")).rows[0].workshop_computer_id, ids.work);
  });
});
