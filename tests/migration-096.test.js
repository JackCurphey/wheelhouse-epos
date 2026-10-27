// Migration 096 (openspec/changes/close-the-day, the contract): cash taken
// out of the drawer, and one close a shop a day with its figures, kept per
// shop (cash-up decisions 4 and 6). Run from empty, then onto a database
// that already has a shop, then again.
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
const FILE = '096_close_the_day.sql';
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

test('096 adds paid-outs and one close a day, and keeps each shop to its own', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig096_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  // Every migration before 096 from empty, then a shop, then 096 onto it.
  await withClient(url.href, async (c) => {
    await c.query('CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    for (const f of LATER) await c.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
  });
  migrate(env);
  let ids;
  await withClient(url.href, async (c) => {
    const { rows: [shop] } = await c.query("INSERT INTO shops (name, slug) VALUES ('North Street Cycles', 'north-street-cycles') RETURNING id");
    const { rows: [jack] } = await c.query("INSERT INTO logins (shop_id, name, email, password_hash) VALUES ($1, 'Jack Lewis', 'jack@example.test', 'x') RETURNING id", [shop.id]);
    ids = { shop: shop.id, jack: jack.id };
    await c.query('DELETE FROM schema_migrations WHERE filename = ANY($1)', [LATER]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(ids.shop)]);
    const out = (day, amount, reason = '[Shop’s reason]', note = '') => c.query('INSERT INTO paid_outs (day, login_id, amount_pence, reason, note) VALUES ($1, $2, $3, $4, $5) RETURNING *', [day, ids.jack, amount, reason, note]);
    const { rows: [po] } = await out('2026-09-01', 500);
    assert.equal(po.shop_id, ids.shop);
    assert.ok(po.created_at instanceof Date);
    await out('2026-09-01', 250);
    await assert.rejects(out('2026-09-01', 0), /check/i, 'at least 1p');
    await assert.rejects(out('2026-09-01', 10_000_001), /check/i, 'up to £100,000');
    await assert.rejects(out('2026-09-01', 100, ''), /check/i, 'a reason');
    await assert.rejects(out('2026-09-01', 100, 'x'.repeat(101)), /check/i, 'a reason up to 100 characters');
    await assert.rejects(out('2026-09-01', 100, 'x', 'x'.repeat(501)), /check/i, 'a note up to 500 characters');
    const { rows: [fc] } = await c.query("INSERT INTO float_checks (day, login_id, expected_pence, counted_pence) VALUES ('2026-09-01', $1, 15000, NULL) RETURNING id", [ids.jack]);
    const close = (day, counted = 21900, banked = 6900, reason = '') => c.query(
      `INSERT INTO day_closes (day, login_id, float_check_id, float_start_pence, cash_pence, paid_outs_pence, expected_pence, counted_pence,
         reason, float_pence, banked_pence, takings_pence, card_pence, other_pence)
       VALUES ($1, $2, $3, 15000, 7400, 500, 21900, $4, $6, 15000, $5, 7400, 0, 0) RETURNING *`, [day, ids.jack, fc.id, counted, banked, reason]);
    const { rows: [made] } = await close('2026-09-01');
    assert.equal(made.shop_id, ids.shop);
    assert.ok(made.closed_at instanceof Date);
    assert.equal(made.online_pence, 0, 'online money is kept beside the takings');
    assert.equal(made.drawer_cash_pence, 0, 'the drawer\'s cash sales are kept beside the report\'s');
    // Each sale says which close counted it: none until one does, and only a real close.
    const { rows: [sale] } = await c.query("INSERT INTO sales (subtotal, total, payment_method) VALUES (5, 5, 'Cash') RETURNING day_close_id");
    assert.equal(sale.day_close_id, null);
    await c.query('UPDATE sales SET day_close_id = $1', [made.id]);
    await assert.rejects(c.query('UPDATE sales SET day_close_id = 999999'), /foreign key/i, 'a sale is marked only by a real close');
    assert.equal((await c.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'till_sales' AND column_name = 'day_close_id'")).rows[0].n, 1);
    await assert.rejects(close('2026-09-01'), /unique|duplicate/i, 'one close a day');
    await assert.rejects(close('2026-09-02', -1, 0), /check/i, 'a count is never below nothing');
    await assert.rejects(close('2026-09-03', 100, -1), /check/i, 'banking is never below nothing');
    await assert.rejects(close('2026-09-04', 100, 200), /check/i, 'never more banked than counted');
    await assert.rejects(close('2026-09-05', 100, 0, 'x'.repeat(501)), /check/i, 'a reason up to 500 characters');
    // Another shop sees none of it.
    const { rows: [other] } = await c.query("INSERT INTO shops (name, slug) VALUES ('Other Cycles', 'other-cycles') RETURNING id");
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(other.id)]);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM paid_outs')).rows[0].n, 0);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM day_closes')).rows[0].n, 0);
  });
  // Run again on a database that already has it: it runs without failing,
  // and what was kept stays, each shop still seeing only its own.
  await withClient(url.href, (c) => c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]));
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(ids.shop)]);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM paid_outs')).rows[0].n, 2);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM day_closes')).rows[0].n, 1);
    await c.query("SELECT set_config('app.current_shop_id', (SELECT id::text FROM shops WHERE slug = 'other-cycles'), false)");
    assert.equal((await c.query('SELECT count(*)::int AS n FROM paid_outs')).rows[0].n, 0);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM day_closes')).rows[0].n, 0);
  });
});
