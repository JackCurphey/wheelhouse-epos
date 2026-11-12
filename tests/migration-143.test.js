// Migration 143 (openspec/changes/website-management design 7, task 6.3): a
// shop's link to its own Shopify shop, and the pretend Shopify's records of
// the shops it pretends to be. From empty, under the app role, then run again.
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
const FILE = '143_shopify_link.sql';
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

test('143 makes the Shopify link and the pretend Shopify per shop, each kept to its own shop, and runs twice', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig143_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    const first = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[First shop]', 's1') RETURNING id")).id;
    const second = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Second shop]', 's2') RETURNING id")).id;
    await asShop(c, first);
    const link = await one(c, "INSERT INTO shopify_link (provider, address) VALUES ('pretend', '[your-shop].myshopify.com') RETURNING *");
    assert.equal(link.shop_id, first);
    assert.equal(link.state, 'idle');
    assert.deepEqual(link.to_send, []);
    assert.deepEqual(link.problems, []);
    assert.equal(link.sent_count, 0);
    await assert.rejects(c.query("UPDATE shopify_link SET state = 'maybe'"), /check/i);
    await c.query("INSERT INTO pretend_shopify (address) VALUES ('[your-shop].myshopify.com')");
    const pretend = await one(c, 'SELECT * FROM pretend_shopify');
    assert.deepEqual([pretend.shop_id, pretend.products, pretend.needs_photo, pretend.refuses], [first, [], [], {}]);

    await c.query("SELECT set_config('app.current_shop_id', '', false)");
    await c.query(SQL);
    await c.query(SQL);
    await asShop(c, second);
    assert.equal((await c.query('SELECT 1 FROM shopify_link')).rows.length, 0, 'one shop’s link stays its own');
    assert.equal((await c.query('SELECT 1 FROM pretend_shopify')).rows.length, 0, 'and its pretend Shopify');
    await assert.rejects(c.query(`INSERT INTO shopify_link (shop_id, provider, address) VALUES (${first}, 'pretend', 'x.myshopify.com')`), /row-level security/i);
  });
  assert.doesNotMatch(migrate(env), new RegExp(`Applied migration: ${FILE}`));
});
