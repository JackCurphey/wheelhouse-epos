// Migration 100 (openspec/changes/till-setup, the contract): a till's name
// is optional, and a check-in and a float check record the till they were
// made on. Run from empty, then onto a database that already has a shop
// with a till, check-ins and a float check, then again.
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
const FILE = '100_till_setup.sql';
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

test('100 makes a till name optional and records the till of a check-in and a float check', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig100_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  // Every migration before 100 from empty, then a shop, then 100 onto it.
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
    const { rows: [site] } = await c.query("INSERT INTO sites (name, code) VALUES ('Bolton', 'B') RETURNING id");
    const { rows: [till] } = await c.query("INSERT INTO tills (site_id, code, name, token_hash) VALUES ($1, 'B1', 'Front counter', 'till-hash-1') RETURNING id", [site.id]);
    const { rows: [jo] } = await c.query("INSERT INTO employees (name, is_cashier) VALUES ('Jo Taylor', 1) RETURNING id");
    const { rows: [jack] } = await c.query("INSERT INTO logins (shop_id, name, email, password_hash) VALUES ($1, 'Jack Lewis', 'jack@example.test', 'x') RETURNING id", [shop.id]);
    await c.query("INSERT INTO pin_checkins (employee_id, login_id, token_hash, day) VALUES ($1, $2, 'checkin-1', '2026-09-01')", [jo.id, jack.id]);
    Object.assign(ids, { site: site.id, till: till.id, jo: jo.id, jack: jack.id });
    await c.query('DELETE FROM schema_migrations WHERE filename = ANY($1)', [LATER]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    await inShop(c, ids.shop);
    // A check-in made before tills had names belongs to no till.
    assert.equal((await c.query('SELECT till_id FROM pin_checkins')).rows[0].till_id, null);
    // A till with no name.
    const { rows: [unnamed] } = await c.query("INSERT INTO tills (site_id, code, name, token_hash) VALUES ($1, 'B2', NULL, 'till-hash-2') RETURNING name", [ids.site]);
    assert.equal(unnamed.name, null);
    // A check-in and a float check on Till B1.
    const { rows: [made] } = await c.query("INSERT INTO pin_checkins (employee_id, login_id, token_hash, day, till_id) VALUES ($1, $2, 'checkin-2', '2026-09-01', $3) RETURNING till_id", [ids.jo, ids.jack, ids.till]);
    assert.equal(made.till_id, ids.till);
    const { rows: [fc] } = await c.query("INSERT INTO float_checks (day, login_id, employee_id, expected_pence, counted_pence, till_id) VALUES ('2026-09-01', $1, $2, 15000, NULL, $3) RETURNING till_id", [ids.jack, ids.jo, ids.till]);
    assert.equal(fc.till_id, ids.till);
    await assert.rejects(
      c.query("INSERT INTO pin_checkins (employee_id, login_id, token_hash, day, till_id) VALUES ($1, $2, 'checkin-3', '2026-09-01', 999999)", [ids.jo, ids.jack]),
      /foreign key/i, 'only a till that exists',
    );
    // Deleting a till leaves its check-ins and float check, with no till.
    await c.query('DELETE FROM tills WHERE id = $1', [ids.till]);
    assert.deepEqual((await c.query('SELECT till_id FROM pin_checkins ORDER BY id')).rows.map((r) => r.till_id), [null, null]);
    assert.equal((await c.query('SELECT till_id FROM float_checks')).rows[0].till_id, null);
  });
  // Run again on a database that already has it: it runs without failing,
  // and what was kept stays.
  await withClient(url.href, (c) => c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]));
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    await inShop(c, ids.shop);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM pin_checkins')).rows[0].n, 2);
    assert.equal((await c.query("SELECT name FROM tills WHERE code = 'B2'")).rows[0].name, null);
  });
});
