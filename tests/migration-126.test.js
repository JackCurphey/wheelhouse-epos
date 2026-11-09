// Migration 126 (openspec/changes/finish-customers, design 1 and 7): store credit and account
// entries, a customer's account and limit, Ways to pay, how a privacy request came. Each
// business's own. From empty, under the app role, then run again. Placeholders throughout.
import '../server/load-env.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createAppDatabase, dropDatabase, adminUrlFrom, appRoleFrom } from '../scripts/dev/new-db.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATE = path.join(ROOT, 'server/migrations/run-migrations.js');
const FILE = '126_customer_money.sql';

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

test('126 keeps money entries to their business, never zero, once undone, and runs twice', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig126_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    const shop = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Shop]', 's1') RETURNING id")).id;
    const otherShop = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Other shop]', 's2') RETURNING id")).id;
    await asShop(c, shop);
    const customer = (await one(c, "INSERT INTO customers (name) VALUES ('Maya Patel') RETURNING id, account_opened_at, account_limit_pence"));
    assert.deepEqual([customer.account_opened_at, customer.account_limit_pence], [null, null]);
    const added = await one(c, "INSERT INTO store_credit_entries (customer_id, change_pence, kind, reason) VALUES ($1, 500, 'added', '[reason]') RETURNING id, shop_id, created_at", [customer.id]);
    assert.equal(added.shop_id, shop);
    await assert.rejects(c.query("INSERT INTO store_credit_entries (customer_id, change_pence, kind) VALUES ($1, 0, 'added')", [customer.id]), /check/i);
    await assert.rejects(c.query("INSERT INTO store_credit_entries (customer_id, change_pence, kind) VALUES ($1, 5, 'gift')", [customer.id]), /check/i);
    await c.query("INSERT INTO store_credit_entries (customer_id, change_pence, kind, undoes_entry_id) VALUES ($1, -500, 'undo', $2)", [customer.id, added.id]);
    await assert.rejects(c.query("INSERT INTO store_credit_entries (customer_id, change_pence, kind, undoes_entry_id) VALUES ($1, -500, 'undo', $2)", [customer.id, added.id]), /idx_store_credit_entries_undoes/);

    await c.query("INSERT INTO account_entries (customer_id, change_pence, kind) VALUES ($1, 12000, 'opening')", [customer.id]);
    await c.query("INSERT INTO account_entries (customer_id, change_pence, kind, received_on, reference) VALUES ($1, -2000, 'bank_transfer', '2026-09-01', '[reference]')", [customer.id]);
    await assert.rejects(c.query("INSERT INTO account_entries (customer_id, change_pence, kind) VALUES ($1, 100, 'cheque')", [customer.id]), /check/i);

    const settings = await one(c, 'INSERT INTO payment_settings DEFAULT VALUES RETURNING store_credit_on, accounts_on, account_limit_pence');
    assert.deepEqual(settings, { store_credit_on: false, accounts_on: false, account_limit_pence: null });
    await assert.rejects(c.query('INSERT INTO payment_settings DEFAULT VALUES'), /idx_payment_settings_shop/);

    const req = await one(c, "INSERT INTO privacy_requests (customer_id, kind, source, how) VALUES ($1, 'copy', 'shop', 'in_person') RETURNING how", [customer.id]);
    assert.equal(req.how, 'in_person');
    await assert.rejects(c.query("INSERT INTO privacy_requests (customer_id, kind, source, how) VALUES ($1, 'copy', 'shop', 'pigeon')", [customer.id]), /check/i);

    await asShop(c, otherShop);
    for (const table of ['store_credit_entries', 'account_entries', 'payment_settings']) {
      assert.equal((await c.query(`SELECT 1 FROM ${table}`)).rowCount, 0, `another business never reads ${table}`);
    }
    await assert.rejects(c.query("INSERT INTO store_credit_entries (shop_id, customer_id, change_pence, kind) VALUES ($1, $2, 5, 'added')", [shop, customer.id]), /row-level security/i);

    await asShop(c, shop);
    await c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
});
