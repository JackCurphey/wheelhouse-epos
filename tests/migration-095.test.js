// Migration 095 (openspec/changes/opening-float-check, the contract): the
// shop's float and one float check a day, kept per shop (opening the shop
// decision 2; cash-up decision 4). Run from empty, then onto a database that
// already has a shop, then again.
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
const FILE = '095_float_checks.sql';
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

test('095 adds the float and float checks, one a day, and keeps each shop to its own', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig095_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  await withClient(url.href, async (c) => {
    await c.query('CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    for (const f of LATER) await c.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
  });
  migrate(env);
  let ids;
  await withClient(url.href, async (c) => {
    const { rows: [shop] } = await c.query("INSERT INTO shops (name, slug) VALUES ('North Street Cycles', 'north-street-cycles') RETURNING id");
    const { rows: [jo] } = await c.query("INSERT INTO logins (shop_id, name, email, password_hash) VALUES ($1, 'Jo Taylor', 'jo@example.test', 'x') RETURNING id", [shop.id]);
    const { rows: [jack] } = await c.query("INSERT INTO logins (shop_id, name, email, password_hash) VALUES ($1, 'Jack Lewis', 'jack@example.test', 'x') RETURNING id", [shop.id]);
    ids = { shop: shop.id, jo: jo.id, jack: jack.id };
    await c.query('DELETE FROM schema_migrations WHERE filename = ANY($1)', [LATER]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    // The float is not set until the shop sets it, and is whole pence, never below nothing.
    assert.equal((await c.query('SELECT float_pence FROM shops WHERE id = $1', [ids.shop])).rows[0].float_pence, null);
    await c.query('UPDATE shops SET float_pence = 15000 WHERE id = $1', [ids.shop]);
    await assert.rejects(c.query('UPDATE shops SET float_pence = -1 WHERE id = $1', [ids.shop]), /check/i);
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(ids.shop)]);
    const add = (day, expected, counted, reason = '', login = ids.jo) => c.query('INSERT INTO float_checks (day, login_id, expected_pence, counted_pence, reason) VALUES ($1, $2, $3, $4, $5) RETURNING *', [day, login, expected, counted, reason]);
    const { rows: [looked] } = await add('2026-09-01', 15000, null);
    assert.equal(looked.shop_id, ids.shop);
    assert.ok(looked.checked_at instanceof Date);
    assert.equal(looked.seen_at, null);
    // One a day for the shop, whoever checks.
    await assert.rejects(add('2026-09-01', 15000, 15000, '', ids.jack), /unique|duplicate/i, 'one a day');
    await add('2026-09-02', 15000, 14580, 'change given wrong');
    await assert.rejects(add('2026-09-03', 15000, -5), /check/i, 'never below nothing');
    await assert.rejects(add('2026-09-04', 15000, 1, 'x'.repeat(501)), /check/i, 'a reason up to 500 characters');
    // Another shop sees none of it.
    const { rows: [other] } = await c.query("INSERT INTO shops (name, slug) VALUES ('Other Cycles', 'other-cycles') RETURNING id");
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(other.id)]);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM float_checks')).rows[0].n, 0);
  });
  // Run again on a database that already has it: it runs without failing,
  // the float and the checks stay, and each shop still sees only its own.
  await withClient(url.href, (c) => c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]));
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    assert.equal((await c.query('SELECT float_pence FROM shops WHERE id = $1', [ids.shop])).rows[0].float_pence, 15000);
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(ids.shop)]);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM float_checks')).rows[0].n, 2);
    await c.query("SELECT set_config('app.current_shop_id', (SELECT id::text FROM shops WHERE slug = 'other-cycles'), false)");
    assert.equal((await c.query('SELECT count(*)::int AS n FROM float_checks')).rows[0].n, 0);
  });
});

