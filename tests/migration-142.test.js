// Migration 142 (openspec/changes/website-management design 6, task 5.1): a
// payments connection per shop and the Online orders settings. A shop that
// already takes booking deposits is marked connected through the pretend
// provider, the only one there has been; the server's own provider is checked
// when it is read (server/payments/provider.js). From empty, under the app
// role, then run again.
import '../server/load-env.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createAppDatabase, dropDatabase, adminUrlFrom, appRoleFrom } from '../scripts/dev/new-db.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATE = path.join(ROOT, 'server/migrations/run-migrations.js');
const FILE = '142_online_payments_setup.sql';
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
const asShop = (c, id) => c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(id)]);

test('142 makes the payments connection and Online orders settings per shop, marks deposit shops connected, and runs twice', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig142_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    const deposits = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Deposit shop]', 's1') RETURNING id")).id;
    const plain = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Other shop]', 's2') RETURNING id")).id;
    await asShop(c, deposits);
    await c.query('INSERT INTO workshop_settings (deposit_on) VALUES (1)');
    await asShop(c, plain);
    await c.query('INSERT INTO workshop_settings (deposit_on) VALUES (0)');
    await assert.rejects(c.query("INSERT INTO online_payment_account (provider, status) VALUES ('pretend', 'maybe')"), /check/i);

    // The migration's own words, on shops that already have settings, then again.
    await c.query("SELECT set_config('app.current_shop_id', '', false)");
    await c.query(SQL);
    await c.query(SQL);
    await asShop(c, deposits);
    const account = await one(c, 'SELECT shop_id, provider, status, connected_at, test_paid_at FROM online_payment_account');
    assert.equal(account.shop_id, deposits);
    assert.equal(account.provider, 'pretend');
    assert.equal(account.status, 'connected');
    assert.ok(account.connected_at !== null);
    assert.equal(account.test_paid_at, null);
    assert.equal((await c.query('SELECT 1 FROM online_payment_account')).rows.length, 1, 'only its own row');
    await asShop(c, plain);
    assert.equal((await c.query('SELECT 1 FROM online_payment_account')).rows.length, 0, 'a shop without deposits isn’t connected');
    await c.query('INSERT INTO online_order_settings DEFAULT VALUES');
    assert.equal((await one(c, 'SELECT buying_online FROM online_order_settings')).buying_online, false);
    await asShop(c, deposits);
    assert.equal((await c.query('SELECT 1 FROM online_order_settings')).rows.length, 0, 'one shop’s settings stay its own');
  });
  assert.doesNotMatch(migrate(env), new RegExp(`Applied migration: ${FILE}`));
});
