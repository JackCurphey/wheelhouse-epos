// Migration 082 (openspec/changes/staff-signin-workos design 5): a login's
// WorkOS id, unique, and each session's WorkOS session. Nothing is dropped:
// a login and session from before 082 are untouched.
//
// As tests/migration-075.test.js: a throwaway database migrated without 082,
// a login and session written, then 082 applied.
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
const FILE = '082_staff_signin_workos.sql';

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

test('082 adds the WorkOS ids and leaves an existing login and session as they were', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig082_${process.pid}`;
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
  const before = await withClient(url.href, async (c) => {
    const { rows: [shop] } = await c.query("INSERT INTO shops (name, slug) VALUES ('North Street Cycles', 'north-street-cycles') RETURNING id");
    const { rows: [login] } = await c.query(
      "INSERT INTO logins (shop_id, name, email, password_hash, is_owner) VALUES ($1, 'Owner', 'owner@example.com', 'salt:hash', true) RETURNING *", [shop.id]);
    await c.query("INSERT INTO sessions (token, login_id, expires_at) VALUES ('t1', $1, now() + interval '30 days')", [login.id]);
    return login;
  });
  await withClient(url.href, (c) => c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]));
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));

  await withClient(url.href, async (c) => {
    const { rows: columns } = await c.query(
      `SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name IN ('workos_user_id', 'workos_session_id') ORDER BY table_name`);
    assert.deepEqual(columns.map((r) => [r.table_name, r.column_name, r.data_type, r.is_nullable]), [
      ['logins', 'workos_user_id', 'text', 'YES'],
      ['sessions', 'workos_session_id', 'text', 'YES'],
    ]);
    const { rows: [login] } = await c.query('SELECT * FROM logins WHERE id = $1', [before.id]);
    assert.equal(login.password_hash, 'salt:hash');
    assert.equal(login.email, 'owner@example.com');
    assert.equal(login.workos_user_id, null);
    const { rows: [session] } = await c.query("SELECT * FROM sessions WHERE token = 't1'");
    assert.equal(session.login_id, before.id);
    assert.equal(session.workos_session_id, null);

    // One WorkOS person, one login.
    await c.query("UPDATE logins SET workos_user_id = 'user_01' WHERE id = $1", [before.id]);
    const { rows: [other] } = await c.query(
      "INSERT INTO logins (shop_id, name, email, password_hash) VALUES ($1, 'Second', 'second@example.com', 'salt:hash') RETURNING id", [before.shop_id]);
    await assert.rejects(c.query("UPDATE logins SET workos_user_id = 'user_01' WHERE id = $1", [other.id]), /unique|duplicate/i);
  });
});
