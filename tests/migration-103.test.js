// Migration 103 (openspec/changes/trust-pin-workshop, the contract): trust
// PIN and the workshop computer's time on the shop's row, and whether each
// check-in was made by a tap. Run from empty, then onto a database that
// already has a shop and a check-in, then again.
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
const FILE = '103_trust_pin.sql';
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

test('103 adds trust PIN, off, the time, 10 minutes, and a tap on each check-in', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig103_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  // Everything before 103, from empty.
  await withClient(url.href, async (c) => {
    await c.query('CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    for (const f of LATER) await c.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
  });
  migrate(env);
  let ids;
  await withClient(url.href, async (c) => {
    const { rows: [shop] } = await c.query("INSERT INTO shops (name, slug) VALUES ('North Street Cycles', 'north-street-cycles') RETURNING id");
    const { rows: [jack] } = await c.query("INSERT INTO logins (shop_id, name, email, password_hash) VALUES ($1, 'Jack Lewis', 'jack@example.test', 'x') RETURNING id", [shop.id]);
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shop.id)]);
    const { rows: [alex] } = await c.query("INSERT INTO employees (name) VALUES ('Alex Morgan') RETURNING id");
    // A check-in from before 103: made by typing a PIN.
    const { rows: [old] } = await c.query("INSERT INTO pin_checkins (employee_id, login_id, token_hash, day) VALUES ($1, $2, 'h1', '2026-09-01') RETURNING id", [alex.id, jack.id]);
    ids = { shop: shop.id, jack: jack.id, alex: alex.id, old: old.id };
    await c.query('DELETE FROM schema_migrations WHERE filename = ANY($1)', [LATER]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    // Off, and 10 minutes, to start.
    assert.deepEqual((await c.query('SELECT trust_pin, workshop_idle_minutes FROM shops WHERE id = $1', [ids.shop])).rows[0], { trust_pin: false, workshop_idle_minutes: 10 });
    for (const m of [5, 15, 30, null]) await c.query('UPDATE shops SET workshop_idle_minutes = $1 WHERE id = $2', [m, ids.shop]);
    for (const m of [0, 7, 60]) await assert.rejects(c.query('UPDATE shops SET workshop_idle_minutes = $1 WHERE id = $2', [m, ids.shop]), /check/i, `${m} isn't offered`);
    await assert.rejects(c.query('UPDATE shops SET trust_pin = NULL WHERE id = $1', [ids.shop]), /null/i);
    await c.query('UPDATE shops SET trust_pin = true, workshop_idle_minutes = 15 WHERE id = $1', [ids.shop]);
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(ids.shop)]);
    // The older check-in was typed, not tapped.
    assert.equal((await c.query('SELECT by_tap FROM pin_checkins WHERE id = $1', [ids.old])).rows[0].by_tap, false);
    await c.query("INSERT INTO pin_checkins (employee_id, login_id, token_hash, day, by_tap) VALUES ($1, $2, 'h2', '2026-09-01', true)", [ids.alex, ids.jack]);
  });
  // Run again on a database that already has it: it runs, and everything stays.
  await withClient(url.href, (c) => c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]));
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    assert.deepEqual((await c.query('SELECT trust_pin, workshop_idle_minutes FROM shops WHERE id = $1', [ids.shop])).rows[0], { trust_pin: true, workshop_idle_minutes: 15 });
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(ids.shop)]);
    assert.deepEqual((await c.query('SELECT by_tap FROM pin_checkins ORDER BY id')).rows, [{ by_tap: false }, { by_tap: true }]);
  });
});
