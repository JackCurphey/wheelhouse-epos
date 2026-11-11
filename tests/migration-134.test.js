// Migration 134 (openspec/changes/reports-ready-made, design 4): when the
// shop's VAT quarter starts, one nullable column on shops. From empty, null to
// start, 1, 2 or 3 kept and anything else refused, then run again.
import '../server/load-env.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { createAppDatabase, dropDatabase, adminUrlFrom, appRoleFrom } from '../scripts/dev/new-db.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATE = path.join(ROOT, 'server/migrations/run-migrations.js');
const FILE = '134_vat_quarter.sql';
const SQL = readFileSync(path.join(ROOT, 'server/migrations', FILE), 'utf8');

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
const one = async (c, sql, args) => (await c.query(sql, args)).rows[0];

test('134 adds the VAT quarter start month to shops, null to start, 1 to 3 only, and runs twice', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig134_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    const shop = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Shop]', 's1') RETURNING id, vat_quarter_start_month"));
    assert.equal(shop.vat_quarter_start_month, null);
    for (const month of [1, 2, 3]) {
      const row = await one(c, 'UPDATE shops SET vat_quarter_start_month = $1 WHERE id = $2 RETURNING vat_quarter_start_month', [month, shop.id]);
      assert.equal(row.vat_quarter_start_month, month);
    }
    for (const month of [0, 4, 12, -1]) {
      await assert.rejects(c.query('UPDATE shops SET vat_quarter_start_month = $1 WHERE id = $2', [month, shop.id]), /check constraint/);
    }
    const type = await one(c, "SELECT data_type FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'vat_quarter_start_month'");
    assert.equal(type.data_type, 'smallint');
    // The migration's own words, run twice more on a shop that has said: nothing fails, the answer stays.
    await c.query('UPDATE shops SET vat_quarter_start_month = 2 WHERE id = $1', [shop.id]);
    await c.query(SQL);
    await c.query(SQL);
    assert.equal((await one(c, 'SELECT vat_quarter_start_month FROM shops WHERE id = $1', [shop.id])).vat_quarter_start_month, 2);
    const checks = await one(c, "SELECT count(*)::int AS n FROM pg_constraint WHERE conrelid = 'shops'::regclass AND pg_get_constraintdef(oid) LIKE '%vat_quarter_start_month%'");
    assert.equal(checks.n, 1);
  });
  // Run again: nothing new to apply, nothing fails.
  assert.doesNotMatch(migrate(env), new RegExp(`Applied migration: ${FILE}`));
});
