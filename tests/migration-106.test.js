// Migration 106 (openspec/changes/unclosed-day, the contract): a float
// check can be the count for an earlier day nobody closed (for_day), and a
// close keeps the cash banked for still-earlier days after its count
// (carried_pence). Run from empty, then onto a database that already has a
// float check and a close, then again.
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
const FILE = '106_unclosed_day.sql';
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
const CHECK = 'INSERT INTO float_checks (day, login_id, expected_pence, counted_pence, for_day) VALUES ($1, $2, 15000, $3, $4) RETURNING id';

test('106 lets a count be an earlier day\'s, once, and keeps what a close carried', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig106_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  // Everything before 106, from empty.
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
    // A check and a close from before 106.
    const { rows: [check] } = await c.query("INSERT INTO float_checks (day, login_id, expected_pence) VALUES ('2026-08-30', $1, 15000) RETURNING id", [jack.id]);
    const { rows: [close] } = await c.query(
      `INSERT INTO day_closes (day, login_id, float_check_id, float_start_pence, cash_pence, paid_outs_pence, expected_pence, counted_pence,
         float_pence, banked_pence, takings_pence, card_pence, other_pence)
       VALUES ('2026-08-30', $1, $2, 15000, 0, 0, 15000, 15000, 15000, 0, 0, 0, 0) RETURNING id`, [jack.id, check.id]);
    ids = { shop: shop.id, jack: jack.id, check: check.id, close: close.id };
    await c.query('DELETE FROM schema_migrations WHERE filename = ANY($1)', [LATER]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  const rules = async () => withClient(url.href, async (c) => {
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(ids.shop)]);
    // Older rows: a normal check and a close that carried nothing.
    assert.equal((await c.query('SELECT for_day FROM float_checks WHERE id = $1', [ids.check])).rows[0].for_day, null);
    assert.equal((await c.query('SELECT carried_pence FROM day_closes WHERE id = $1', [ids.close])).rows[0].carried_pence, 0);
    await c.query('BEGIN');
    try {
      // A count made on 1 Sep for 31 Aug is kept; a look can't be a day's count,
      // nor can a count for the same day or a later one, nor two for one day.
      await c.query(CHECK, ['2026-09-01', ids.jack, 15500, '2026-08-31']);
      await c.query('SAVEPOINT s');
      await assert.rejects(c.query(CHECK, ['2026-09-02', ids.jack, null, '2026-09-01']), /check constraint/i);
      await c.query('ROLLBACK TO SAVEPOINT s');
      await assert.rejects(c.query(CHECK, ['2026-09-02', ids.jack, 15000, '2026-09-02']), /check constraint/i);
      await c.query('ROLLBACK TO SAVEPOINT s');
      await assert.rejects(c.query(CHECK, ['2026-09-02', ids.jack, 15000, '2026-08-31']), /unique|duplicate/i);
      await c.query('ROLLBACK TO SAVEPOINT s');
    } finally {
      await c.query('ROLLBACK');
    }
  });
  await rules();
  // Run again on a database that already has it: it runs, and the rules stay.
  await withClient(url.href, (c) => c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]));
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await rules();
});
