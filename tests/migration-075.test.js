// Migration 075 (openspec/changes/wp-1-6-sales-in-pence, task 2.1, step A′,
// Jack's side): the workshop's own amounts gain pence beside their pounds,
// backfilled with ROUND(pounds * 100), as 073 did for orders: a service's
// price, a quote line's unit amount, and a booked service's price (null
// stays null). A quote line's quantity is a count, not money, so it stays as
// it is. Then the totals check is clean.
//
// As tests/migration-073.test.js: a throwaway database migrated without 075,
// the workshop's amounts written the way the app writes them, then 075 applied.
import '../server/load-env.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createAppDatabase, dropDatabase, adminUrlFrom, appRoleFrom } from '../scripts/dev/new-db.mjs';
import { checkMoneyTotals, formatReport } from '../scripts/ci/check-money-totals.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATE = path.join(ROOT, 'server/migrations/run-migrations.js');
const FILE = '075_workshop_amounts_in_pence.sql';

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

// One shop's workshop amounts in pounds: three services (one with pennies,
// one free), a job with two booked services (one priced, one not), and a quote
// with two lines (one with a quantity of 1.5).
async function writePoundsWorkshop(client, name) {
  const { rows: [shop] } = await client.query('INSERT INTO shops (name, slug) VALUES ($1, $2) RETURNING id', [name, name.toLowerCase().replace(/\W+/g, '-')]);
  await client.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shop.id)]);
  const one = async (sql, params) => (await client.query(sql, params)).rows[0];
  const standard = (await one("INSERT INTO workshop_services (name, price) VALUES ('Standard service', 65) RETURNING id")).id;
  const gears = (await one("INSERT INTO workshop_services (name, price) VALUES ('Gear adjustment', 33.33) RETURNING id")).id;
  const free = (await one("INSERT INTO workshop_services (name, price) VALUES ('Safety check', 0) RETURNING id")).id;
  const job = (await one("INSERT INTO workshop_jobs (title, job_date) VALUES ('Standard service', '2026-10-13') RETURNING id")).id;
  await client.query('INSERT INTO workshop_job_services (workshop_job_id, service_id, booked_price, position) VALUES ($1, $2, 65, 0), ($1, $3, NULL, 1)', [job, standard, gears]);
  const quote = (await one('INSERT INTO workshop_quotes (workshop_job_id) VALUES ($1) RETURNING id', [job])).id;
  const pads = (await one("INSERT INTO workshop_quote_lines (workshop_quote_id, kind, description, unit_amount) VALUES ($1, 'part', 'Brake pads', 24.50) RETURNING id", [quote])).id;
  const labour = (await one("INSERT INTO workshop_quote_lines (workshop_quote_id, kind, description, quantity, unit_amount) VALUES ($1, 'labour', 'True the wheel', 1.5, 33.33) RETURNING id", [quote])).id;
  return { shop: shop.id, standard, gears, free, job, pads, labour };
}

test('075 adds pence beside the workshop’s pounds, backfills them, and leaves the totals check clean', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig075_${process.pid}`;
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
  const seeded = await withClient(url.href, async (c) => [await writePoundsWorkshop(c, 'North Street Cycles'), await writePoundsWorkshop(c, 'Second Shop')]);
  await withClient(url.href, (c) => c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]));
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));

  await withClient(url.href, async (c) => {
    const { rows: columns } = await c.query(
      `SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name IN ('workshop_services', 'workshop_quote_lines', 'workshop_job_services')
          AND column_name LIKE '%\\_pence' ORDER BY table_name, column_name`
    );
    assert.deepEqual(columns.map((r) => [r.table_name, r.column_name, r.data_type, r.is_nullable, r.column_default]), [
      ['workshop_job_services', 'booked_price_pence', 'integer', 'YES', null],
      ['workshop_quote_lines', 'unit_amount_pence', 'integer', 'NO', '0'],
      ['workshop_services', 'price_pence', 'integer', 'NO', '0'],
    ]);
    for (const s of seeded) {
      await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(s.shop)]);
      const prices = (await c.query('SELECT id, price_pence FROM workshop_services WHERE shop_id = $1 ORDER BY id', [s.shop])).rows;
      assert.deepEqual(prices.map((r) => [r.id, r.price_pence]), [[s.standard, 6500], [s.gears, 3333], [s.free, 0]]);
      const booked = (await c.query('SELECT service_id, booked_price_pence FROM workshop_job_services WHERE workshop_job_id = $1 ORDER BY position', [s.job])).rows;
      assert.deepEqual(booked.map((r) => [r.service_id, r.booked_price_pence]), [[s.standard, 6500], [s.gears, null]]);
      const lines = (await c.query('SELECT id, unit_amount_pence, quantity::text AS quantity FROM workshop_quote_lines WHERE id = ANY($1::int[]) ORDER BY id', [[s.pads, s.labour]])).rows;
      assert.deepEqual(lines.map((r) => [r.id, r.unit_amount_pence, r.quantity]), [[s.pads, 2450, '1.00'], [s.labour, 3333, '1.50']]);
    }
    const result = await checkMoneyTotals(c);
    assert.deepEqual(result.mismatches, [], formatReport(result));
  });
});
