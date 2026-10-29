// Migration 101 (openspec/changes/workshop-computer, the contract): workshop
// computers, kept to their shop by row-level security, and which workshop
// computer a check-in was made on and when it was last used. Run from empty,
// then onto a database that already has a shop with a check-in, then again.
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
const FILE = '101_workshop_computers.sql';
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

test('101 adds workshop computers, kept to their shop, and the workshop computer and last use of a check-in', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig101_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  // Every migration before 101 from empty, then two shops, then 101 onto them.
  await withClient(url.href, async (c) => {
    await c.query('CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    for (const f of LATER) await c.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
  });
  migrate(env);
  const ids = {};
  await withClient(url.href, async (c) => {
    for (const [key, slug] of [['shop', 'north-street-cycles'], ['other', 'other-cycles']]) {
      const { rows: [shop] } = await c.query("INSERT INTO shops (name, slug) VALUES ('North Street Cycles', $1) RETURNING id", [slug]);
      ids[key] = shop.id;
    }
    await inShop(c, ids.shop);
    const { rows: [site] } = await c.query("INSERT INTO sites (name, code) VALUES ('Bolton', 'B') RETURNING id");
    const { rows: [alex] } = await c.query("INSERT INTO employees (name, is_mechanic) VALUES ('Alex Morgan', 1) RETURNING id");
    const { rows: [jack] } = await c.query("INSERT INTO logins (shop_id, name, email, password_hash) VALUES ($1, 'Jack Lewis', 'jack@example.test', 'x') RETURNING id", [ids.shop]);
    await c.query("INSERT INTO pin_checkins (employee_id, login_id, token_hash, day) VALUES ($1, $2, 'checkin-1', '2026-09-01')", [alex.id, jack.id]);
    Object.assign(ids, { site: site.id, alex: alex.id, jack: jack.id });
    await c.query('DELETE FROM schema_migrations WHERE filename = ANY($1)', [LATER]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    await inShop(c, ids.shop);
    // A check-in made before belongs to no workshop computer and has no last use.
    assert.deepEqual((await c.query('SELECT workshop_computer_id, last_active_at FROM pin_checkins')).rows[0], { workshop_computer_id: null, last_active_at: null });
    // A workshop computer: the request's shop, a name or none, one browser key each.
    const { rows: [w] } = await c.query("INSERT INTO workshop_computers (site_id, name, browser_token_hash) VALUES ($1, NULL, 'browser-hash-1') RETURNING id, shop_id, active", [ids.site]);
    assert.deepEqual([w.shop_id, w.active], [ids.shop, true]);
    await assert.rejects(c.query("INSERT INTO workshop_computers (site_id, browser_token_hash) VALUES ($1, 'browser-hash-1')", [ids.site]), /unique|duplicate/i, 'a browser key is one workshop computer');
    await assert.rejects(c.query("INSERT INTO workshop_computers (site_id, name, browser_token_hash) VALUES ($1, $2, 'browser-hash-2')", [ids.site, 'x'.repeat(61)]), /check/i, 'a name up to 60 characters');
    await assert.rejects(c.query("INSERT INTO workshop_computers (site_id, browser_token_hash) VALUES ($1, NULL)", [ids.site]), /null/i, 'always a browser key');
    // A check-in on it, last used now.
    const { rows: [made] } = await c.query("INSERT INTO pin_checkins (employee_id, login_id, token_hash, day, workshop_computer_id, last_active_at) VALUES ($1, $2, 'checkin-2', '2026-09-01', $3, now()) RETURNING workshop_computer_id, last_active_at", [ids.alex, ids.jack, w.id]);
    assert.equal(made.workshop_computer_id, w.id);
    assert.ok(made.last_active_at instanceof Date);
    await assert.rejects(
      c.query("INSERT INTO pin_checkins (employee_id, login_id, token_hash, day, workshop_computer_id) VALUES ($1, $2, 'checkin-3', '2026-09-01', 999999)", [ids.alex, ids.jack]),
      /foreign key/i, 'only a workshop computer that exists',
    );
    // A check-in is on a till or a workshop computer, never both (the review, 29 Oct).
    const { rows: [till] } = await c.query("INSERT INTO tills (site_id, code, name, token_hash) VALUES ($1, 'B1', NULL, 'till-hash-1') RETURNING id", [ids.site]);
    await assert.rejects(
      c.query("INSERT INTO pin_checkins (employee_id, login_id, token_hash, day, till_id, workshop_computer_id) VALUES ($1, $2, 'checkin-4', '2026-09-01', $3, $4)", [ids.alex, ids.jack, till.id, w.id]),
      /check constraint/i, 'never both',
    );
    // Another shop sees none, and can't add one to this shop.
    await inShop(c, ids.other);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM workshop_computers')).rows[0].n, 0, 'row-level security');
    await assert.rejects(c.query("INSERT INTO workshop_computers (shop_id, site_id, browser_token_hash) VALUES ($1, $2, 'browser-hash-3')", [ids.shop, ids.site]), /row-level security/i);
    // Deleting it leaves its check-ins, with no workshop computer.
    await inShop(c, ids.shop);
    await c.query('DELETE FROM workshop_computers WHERE id = $1', [w.id]);
    assert.deepEqual((await c.query('SELECT workshop_computer_id FROM pin_checkins ORDER BY id')).rows.map((r) => r.workshop_computer_id), [null, null]);
  });
  // Run again on a database that already has it: it runs without failing,
  // and what was kept stays.
  await withClient(url.href, (c) => c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]));
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    await inShop(c, ids.shop);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM pin_checkins')).rows[0].n, 2);
    assert.equal((await c.query("SELECT count(*)::int AS n FROM pin_checkins WHERE last_active_at IS NOT NULL")).rows[0].n, 1);
  });
});
