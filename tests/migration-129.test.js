// Migration 129 (finish-account design 8): a service reminder's booking codes,
// a sign-in email waiting for its code, and the shop's privacy notice. From
// empty, under the app role, each shop kept to its own codes, then run again.
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
const FILE = '129_account_links.sql';

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

test('129 adds reminder booking codes, a pending sign-in email and the privacy notice, and runs twice', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig129_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    const shop = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Shop]', 's1') RETURNING id")).id;
    const other = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Other shop]', 's2') RETURNING id")).id;
    await asShop(c, shop);
    const customer = (await one(c, "INSERT INTO customers (name) VALUES ('Maya Patel') RETURNING id")).id;
    const bike = (await one(c, "INSERT INTO customer_bikes (customer_id, make, model) VALUES ($1, 'Trek', 'Domane AL 3') RETURNING id", [customer])).id;
    await c.query("INSERT INTO reminder_book_codes (code_hash, customer_id, bike_id) VALUES ('h1', $1, $2)", [customer, bike]);
    await assert.rejects(c.query("INSERT INTO reminder_book_codes (code_hash, customer_id) VALUES ('h1', $1)", [customer]), /unique|duplicate/i, 'one row per code');
    // A removed bike leaves the code, with no bike.
    await c.query('DELETE FROM customer_bikes WHERE id = $1', [bike]);
    assert.equal((await one(c, "SELECT bike_id FROM reminder_book_codes WHERE code_hash = 'h1'")).bike_id, null);
    // A login's pending email, and the shop's notice, each with its limit.
    const login = (await one(c, "INSERT INTO customer_logins (shop_id, customer_id, email) VALUES ($1, $2, 'maya@example.test') RETURNING id, pending_email, pending_email_at", [shop, customer]));
    assert.deepEqual([login.pending_email, login.pending_email_at], [null, null]);
    await c.query("UPDATE customer_logins SET pending_email = 'm.patel@example.test', pending_email_at = now() WHERE id = $1", [login.id]);
    await assert.rejects(c.query('UPDATE customer_logins SET pending_email = $1 WHERE id = $2', ['x'.repeat(255), login.id]), /check/i);
    assert.equal((await one(c, 'SELECT privacy_notice FROM shops WHERE id = $1', [shop])).privacy_notice, null);
    await c.query("UPDATE shops SET privacy_notice = '[The shop’s privacy notice]' WHERE id = $1", [shop]);
    await assert.rejects(c.query('UPDATE shops SET privacy_notice = $1 WHERE id = $2', ['x'.repeat(20001), shop]), /check/i);
    await assert.rejects(c.query("UPDATE shops SET privacy_notice = '' WHERE id = $1", [shop]), /check/i);
    await asShop(c, other);
    assert.equal((await c.query('SELECT 1 FROM reminder_book_codes')).rowCount, 0, 'another shop sees none');
  });
  assert.doesNotMatch(migrate(env), new RegExp(`Applied migration: ${FILE}`));
});
