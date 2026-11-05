// Migration 120 (openspec/changes/sizes-and-colours): a product's sizes and colours, each
// its own row in products, joined in a group (Jack's answer 5, 4 Nov). From empty, onto
// two businesses' products, under the app role, then run again. Placeholders throughout.
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
const FILE = '120_sizes_and_colours.sql';
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
const one = async (c, sql, args) => (await c.query(sql, args)).rows[0];

test('120 adds groups, sizes and colours, leaves every product as it was, and runs twice', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig120_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  await withClient(url.href, async (c) => {
    await c.query('CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    for (const f of LATER) await c.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
  });
  migrate(env);

  const ids = {};
  await withClient(url.href, async (c) => {
    ids.a = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Shop A]', 'a') RETURNING id")).id;
    ids.b = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Shop B]', 'b') RETURNING id")).id;
    await inShop(c, ids.a);
    ids.plain = (await one(c, "INSERT INTO products (name, sku, stock_qty) VALUES ('[Product]', '[Code]', 4) RETURNING id")).id;
    await c.query('DELETE FROM schema_migrations WHERE filename = ANY($1)', [LATER]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));

  const holds = async (c) => {
    await inShop(c, ids.a);
    assert.deepEqual(await one(c, 'SELECT name, sku, stock_qty, group_id, size, colour FROM products WHERE id = $1', [ids.plain]),
      { name: '[Product]', sku: '[Code]', stock_qty: 4, group_id: null, size: null, colour: null });
  };
  await withClient(url.href, holds);

  await withClient(url.href, async (c) => {
    await inShop(c, ids.b);
    const theirs = (await one(c, "INSERT INTO product_groups (name) VALUES ('[Their group]') RETURNING id")).id;
    await inShop(c, ids.a);
    const group = (await one(c, "INSERT INTO product_groups (name, category) VALUES ('[Product with sizes]', '[Category]') RETURNING id")).id;
    const size = (s, colour) => c.query('INSERT INTO products (name, group_id, size, colour) VALUES ($1, $2, $3, $4) RETURNING id', ['[Product with sizes]', group, s, colour]);
    await size('M', '[Colour 1]');
    await size('L', '[Colour 1]');
    await size('M', null);
    // Each size and colour once in a group, whatever its case.
    await assert.rejects(size('m', '[colour 1]'), /unique|duplicate/i);
    // In a group, a size or a colour; out of one, neither.
    await assert.rejects(size(null, null), /check/i);
    await assert.rejects(c.query("INSERT INTO products (name, size) VALUES ('[X]', 'M')"), /check/i);
    await assert.rejects(size(' ', '[Colour 2]'), /check/i);
    // Another business's group can't be read, changed or pointed at.
    assert.equal((await one(c, 'SELECT count(*)::int AS n FROM product_groups WHERE id = $1', [theirs])).n, 0);
    assert.equal((await c.query("UPDATE product_groups SET name = 'x' WHERE id = $1", [theirs])).rowCount, 0);
    assert.equal((await c.query('DELETE FROM product_groups WHERE id = $1', [theirs])).rowCount, 0);
    await assert.rejects(c.query("INSERT INTO products (name, group_id, size) VALUES ('[X]', $1, 'M')", [theirs]), /foreign key/i);
    await assert.rejects(c.query("INSERT INTO product_groups (shop_id, name) VALUES ($1, '[X]')", [ids.b]), /row-level security/i);
    await assert.rejects(c.query("INSERT INTO product_groups (name) VALUES ('  ')"), /check/i);
    // A group with sizes in it can't go.
    await assert.rejects(c.query('DELETE FROM product_groups WHERE id = $1', [group]), /foreign key/i);
    await c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    await holds(c);
    assert.equal((await one(c, 'SELECT count(*)::int AS n FROM products WHERE group_id IS NOT NULL')).n, 3, 'sizes kept on a second run');
  });
});
