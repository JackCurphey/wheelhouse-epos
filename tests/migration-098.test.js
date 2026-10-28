// Migration 098 (openspec/changes/stock-take design 1): stock takes, who is
// counting, and each person's count of each product, kept per shop. Run from
// empty, then onto a database that already has a shop, then again.
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
const FILE = '098_stock_takes.sql';
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
const asShop = (c, id) => c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(id)]);

test('098 adds stock takes and their counts, and keeps each shop to its own', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig098_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  // Every migration before 098 from empty, then a shop, then 098 onto it.
  await withClient(url.href, async (c) => {
    await c.query('CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    for (const f of LATER) await c.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
  });
  migrate(env);
  const ids = {};
  await withClient(url.href, async (c) => {
    const { rows: [shop] } = await c.query("INSERT INTO shops (name, slug) VALUES ('North Street Cycles', 'north-street-cycles') RETURNING id");
    const { rows: [jack] } = await c.query("INSERT INTO logins (shop_id, name, email, password_hash) VALUES ($1, 'Jack Lewis', 'jack@example.test', 'x') RETURNING id", [shop.id]);
    await asShop(c, shop.id);
    const { rows: [pads] } = await c.query("INSERT INTO products (name, sku) VALUES ('Shimano brake pads', 'B05S-RX') RETURNING id");
    Object.assign(ids, { shop: shop.id, jack: jack.id, pads: pads.id });
    await c.query('DELETE FROM schema_migrations WHERE filename = ANY($1)', [LATER]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    await asShop(c, ids.shop);
    const take = (kind, target = '', ids2 = null) => c.query('INSERT INTO stock_takes (kind, target, product_ids, started_by_login_id) VALUES ($1, $2, $3, $4) RETURNING *', [kind, target, ids2, ids.jack]);
    const { rows: [area] } = await take('area', 'Wall 3');
    assert.equal(area.shop_id, ids.shop);
    assert.equal(area.status, 'counting');
    assert.ok(area.started_at instanceof Date);
    await take('whole_shop');
    await take('category', 'Drivetrain › Derailleurs');
    await take('below_zero', '', [ids.pads]);
    await assert.rejects(take('cupboard', 'x'), /check/i, 'a known kind');
    await assert.rejects(take('area', ''), /check/i, 'an area is named');
    await assert.rejects(take('whole_shop', 'x'), /check/i, 'the whole shop has no name');
    await assert.rejects(take('area', 'x'.repeat(61)), /check/i, 'up to 60 characters');
    await assert.rejects(c.query("UPDATE stock_takes SET status = 'applied' WHERE id = $1", [area.id]), /check/i, 'only counting, until applying is built');
    const line = (qty) => c.query('INSERT INTO stock_take_counts (stock_take_id, product_id, login_id, qty) VALUES ($1, $2, $3, $4) RETURNING *', [area.id, ids.pads, ids.jack, qty]);
    const { rows: [l] } = await line(2);
    assert.equal(l.shop_id, ids.shop);
    assert.ok(l.first_counted_at instanceof Date && l.last_counted_at instanceof Date);
    await assert.rejects(line(1), /unique|duplicate/i, 'one line a person a product');
    await c.query('DELETE FROM stock_take_counts');
    await assert.rejects(line(0), /check/i, 'at least 1');
    await assert.rejects(line(100001), /check/i, 'at most 100,000');
    await line(2);
    await c.query('INSERT INTO stock_take_counters (stock_take_id, login_id) VALUES ($1, $2)', [area.id, ids.jack]);
    await assert.rejects(c.query('INSERT INTO stock_take_counters (stock_take_id, login_id) VALUES ($1, $2)', [area.id, ids.jack]), /unique|duplicate|primary/i);
    ids.take = area.id;
    // Another shop sees none of it, and can't count against this shop's take.
    const { rows: [other] } = await c.query("INSERT INTO shops (name, slug) VALUES ('Other Cycles', 'other-cycles') RETURNING id");
    await asShop(c, other.id);
    for (const table of ['stock_takes', 'stock_take_counts', 'stock_take_counters']) {
      assert.equal((await c.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n, 0, table);
    }
    const { rows: [theirs] } = await c.query("INSERT INTO logins (shop_id, name, email, password_hash) VALUES ($1, '[Owner]', 'owner@example.test', 'x') RETURNING id", [other.id]);
    await assert.rejects(c.query('INSERT INTO stock_take_counters (stock_take_id, login_id) VALUES ($1, $2)', [ids.take, theirs.id]), /foreign key/i, 'not another shop’s take');
    const { rows: [theirPads] } = await c.query("INSERT INTO products (name) VALUES ('[Product]') RETURNING id");
    await assert.rejects(c.query('INSERT INTO stock_take_counts (stock_take_id, product_id, login_id, qty) VALUES ($1, $2, $3, 1)', [ids.take, theirPads.id, theirs.id]), /foreign key/i, 'no count against another shop’s take');
  });
  // Run again on a database that already has it: what was kept stays.
  await withClient(url.href, (c) => c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]));
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    await asShop(c, ids.shop);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM stock_takes')).rows[0].n, 4);
    assert.equal((await c.query('SELECT qty FROM stock_take_counts')).rows[0].qty, 2);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM stock_take_counters')).rows[0].n, 1);
  });
});
