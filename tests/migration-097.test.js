// Migration 097 (openspec/changes/pins-and-checkin, the contract): the PIN
// Wheelhouse has just offered someone, today's PIN check-ins kept per shop,
// and who checked the float. Run from empty, then onto a database that
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
const FILE = '097_pins_and_checkin.sql';
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

test('097 adds PIN offers, check-ins kept per shop, and who checked the float', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig097_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  // Every migration before 097 from empty, then a shop, then 097 onto it.
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
    const { rows: [jack] } = await c.query("INSERT INTO logins (shop_id, name, email, password_hash) VALUES ($1, 'Jack Lewis', 'jack@example.test', 'x') RETURNING id", [shop.id]);
    Object.assign(ids, { jo: jo.id, jack: jack.id });
    await c.query('DELETE FROM schema_migrations WHERE filename = ANY($1)', [LATER]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    await inShop(c, ids.shop);
    // An offer is kept hashed, with when it was made.
    await c.query("UPDATE employees SET pin_offer_hash = 'pbkdf2-sha256$1$aa$bb', pin_offer_at = now() WHERE id = $1", [ids.jo]);
    const checkin = (token, day = '2026-09-01') => c.query('INSERT INTO pin_checkins (employee_id, login_id, token_hash, day) VALUES ($1, $2, $3, $4) RETURNING *', [ids.jo, ids.jack, token, day]);
    const { rows: [made] } = await checkin('hash-1');
    assert.equal(made.shop_id, ids.shop);
    assert.ok(made.checked_in_at instanceof Date);
    assert.equal(made.ended_at, null);
    await assert.rejects(checkin('hash-1'), /unique|duplicate/i, 'a token is one check-in');
    // Who checked the float.
    const { rows: [fc] } = await c.query("INSERT INTO float_checks (day, login_id, employee_id, expected_pence, counted_pence) VALUES ('2026-09-01', $1, $2, 15000, NULL) RETURNING employee_id", [ids.jack, ids.jo]);
    assert.equal(fc.employee_id, ids.jo);
    // Another shop sees none of the check-ins.
    const { rows: [other] } = await c.query("INSERT INTO shops (name, slug) VALUES ('Other Cycles', 'other-cycles') RETURNING id");
    ids.other = other.id;
    await inShop(c, other.id);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM pin_checkins')).rows[0].n, 0);
    await assert.rejects(c.query('INSERT INTO pin_checkins (shop_id, employee_id, login_id, token_hash, day) VALUES ($1, $2, $3, $4, $5)', [ids.shop, ids.jo, ids.jack, 'hash-2', '2026-09-01']), /row-level security/i, 'not into another shop');
    // Deleting a person takes their check-ins and leaves the float check, unnamed.
    await inShop(c, ids.shop);
    await c.query('DELETE FROM employees WHERE id = $1', [ids.jo]);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM pin_checkins')).rows[0].n, 0);
    assert.equal((await c.query('SELECT employee_id FROM float_checks')).rows[0].employee_id, null);
    await c.query('INSERT INTO employees (id, name) VALUES ($1, $2)', [ids.jo, 'Jo Taylor']);
    await checkin('hash-3');
  });
  // Run again on a database that already has it: it runs without failing,
  // and what was kept stays.
  await withClient(url.href, (c) => c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]));
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    await inShop(c, ids.shop);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM pin_checkins')).rows[0].n, 1);
    await inShop(c, ids.other);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM pin_checkins')).rows[0].n, 0);
  });
});
