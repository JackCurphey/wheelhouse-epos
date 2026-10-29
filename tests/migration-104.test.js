// Migration 104 (openspec/changes/tills-list, design 1): who registered each
// till and workshop computer, for the Tills list's "registered [date] by
// [name]". Run from empty, then onto a database that already has a till and
// a workshop computer, then again.
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
const FILE = '104_tills_registered_by.sql';
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

test('104 records who registered a till and a workshop computer, none for older ones', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig104_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  // Everything before 104, from empty.
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
    // A till and a workshop computer from before 104.
    const { rows: [till] } = await c.query("INSERT INTO tills (site_id, code, token_hash) VALUES ($1, 'B1', 't1') RETURNING id", [site.id]);
    const { rows: [work] } = await c.query("INSERT INTO workshop_computers (site_id, browser_token_hash) VALUES ($1, 'w1') RETURNING id", [site.id]);
    ids = { shop: shop.id, jack: jack.id, site: site.id, till: till.id, work: work.id };
    await c.query('DELETE FROM schema_migrations WHERE filename = ANY($1)', [LATER]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(ids.shop)]);
    assert.equal((await c.query('SELECT registered_by_login_id FROM tills WHERE id = $1', [ids.till])).rows[0].registered_by_login_id, null);
    assert.equal((await c.query('SELECT registered_by_login_id FROM workshop_computers WHERE id = $1', [ids.work])).rows[0].registered_by_login_id, null);
    await c.query('UPDATE tills SET registered_by_login_id = $1 WHERE id = $2', [ids.jack, ids.till]);
    await c.query('UPDATE workshop_computers SET registered_by_login_id = $1 WHERE id = $2', [ids.jack, ids.work]);
    await assert.rejects(c.query('UPDATE tills SET registered_by_login_id = 999999 WHERE id = $1', [ids.till]), /foreign key/i);
  });
  // Run again on a database that already has it: it runs, and everything stays.
  await withClient(url.href, (c) => c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]));
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(ids.shop)]);
    assert.equal((await c.query('SELECT registered_by_login_id FROM tills WHERE id = $1', [ids.till])).rows[0].registered_by_login_id, ids.jack);
    assert.equal((await c.query('SELECT registered_by_login_id FROM workshop_computers WHERE id = $1', [ids.work])).rows[0].registered_by_login_id, ids.jack);
  });
});
