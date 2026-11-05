// Migration 119 (openspec/changes/category-tree): the category tree, built from the text
// products already have, a business at a time, under the app role, then run again.
// Drivetrain › Derailleurs and Bearings as drawn; the rest placeholders.
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
const FILE = '119_category_tree.sql';
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

test('119 builds each business’s tree from its products’ text, tidies only untidy text, and runs twice', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig119_${process.pid}`;
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
    ids.a = (await one(c, "INSERT INTO shops (name, slug) VALUES ('North Street Cycles', 'north-street') RETURNING id")).id;
    ids.b = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Other shop]', 'other') RETURNING id")).id;
    await inShop(c, ids.a);
    const product = async (category) => (await one(c, 'INSERT INTO products (name, category) VALUES ($1, $1) RETURNING id', [category])).id;
    ids.derailleur = await product('Drivetrain › Derailleurs');
    ids.chain = await product('Drivetrain');
    ids.bearing = await product('Bearings');
    ids.untidy = await product('  Drivetrain ›  Derailleurs ');
    ids.empty = await product(' › ');
    ids.none = await product('Uncategorised');
    ids.lower = await product('bearings');
    ids.inside = await product('Uncategorised › Tyres');
    ids.login = (await one(c, "INSERT INTO logins (shop_id, name, email, password_hash) VALUES ($1, '[Owner]', 'o119@example.test', 'x') RETURNING id", [ids.a])).id;
    ids.take = (await one(c, "INSERT INTO stock_takes (kind, target, started_by_login_id) VALUES ('category', '  Drivetrain ›  Derailleurs ', $1) RETURNING id", [ids.login])).id;
    ids.done = (await one(c, "INSERT INTO stock_takes (kind, target, started_by_login_id, status, applied_at, applied_by_login_id) VALUES ('category', '  Drivetrain ›  Derailleurs ', $1, 'applied', now(), $1) RETURNING id", [ids.login])).id;
    await inShop(c, ids.b);
    ids.theirs = await product('Bearings');
    await c.query('DELETE FROM schema_migrations WHERE filename = ANY($1)', [LATER]);
  });

  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));

  const holds = async (c) => {
    await inShop(c, ids.a);
    const tree = (await c.query(`SELECT c.name, c.path, p.path AS parent FROM product_categories c
      LEFT JOIN product_categories p ON p.id = c.parent_id ORDER BY c.path COLLATE "C"`)).rows;
    assert.deepEqual(tree, [
      { name: 'Bearings', path: 'Bearings', parent: null },
      { name: 'Drivetrain', path: 'Drivetrain', parent: null },
      { name: 'Derailleurs', path: 'Drivetrain › Derailleurs', parent: 'Drivetrain' },
      { name: 'Tyres', path: 'Tyres', parent: null },
      { name: 'bearings', path: 'bearings', parent: null },
    ]);
    const text = async (id) => (await one(c, 'SELECT category FROM products WHERE id = $1', [id])).category;
    // Untidy text is tidied to its category's path; nothing else is touched.
    assert.equal(await text(ids.untidy), 'Drivetrain › Derailleurs');
    assert.equal(await text(ids.empty), 'Uncategorised');
    assert.equal(await text(ids.none), 'Uncategorised');
    assert.equal(await text(ids.lower), 'bearings');
    // "Uncategorised" inside a path isn't a category: the rest of the path is.
    assert.equal(await text(ids.inside), 'Tyres');
    // A count running on untidy text follows its products; one applied keeps what it said.
    const target = async (id) => (await one(c, 'SELECT target FROM stock_takes WHERE id = $1', [id])).target;
    assert.equal(await target(ids.take), 'Drivetrain › Derailleurs');
    assert.equal(await target(ids.done), '  Drivetrain ›  Derailleurs ');
    // A count's category can be longer than 60 characters; an area's can't.
    const long = 'Components › Drivetrain › Derailleurs › Rear derailleurs › 12-speed';
    await c.query('BEGIN');
    await c.query("INSERT INTO stock_takes (kind, target, started_by_login_id) VALUES ('category', $1, $2)", [long, ids.login]);
    await c.query('ROLLBACK');
    await assert.rejects(c.query("INSERT INTO stock_takes (kind, target, started_by_login_id) VALUES ('area', $1, $2)", ['x'.repeat(61), ids.login]), /check/i);
    await inShop(c, ids.b);
    assert.deepEqual((await c.query('SELECT name, path FROM product_categories')).rows, [{ name: 'Bearings', path: 'Bearings' }]);
  };
  await withClient(url.href, holds);

  // Each business's categories, details and answers are its own, and can't point at another's.
  await withClient(url.href, async (c) => {
    await inShop(c, ids.b);
    const theirs = (await one(c, 'SELECT id FROM product_categories')).id;
    const theirDetail = (await one(c, "INSERT INTO category_details (category_id, name, kind, unit, position) VALUES ($1, 'Inner diameter', 'number', 'mm', 0) RETURNING id", [theirs])).id;
    await inShop(c, ids.a);
    const mine = (await one(c, "SELECT id FROM product_categories WHERE path = 'Bearings'")).id;
    for (const [table, id] of [['product_categories', theirs], ['category_details', theirDetail]]) {
      assert.equal((await one(c, `SELECT count(*)::int AS n FROM ${table} WHERE id = $1`, [id])).n, 0, `${table} read`);
      assert.equal((await c.query(`UPDATE ${table} SET name = 'x' WHERE id = $1`, [id])).rowCount, 0, `${table} changed`);
      assert.equal((await c.query(`DELETE FROM ${table} WHERE id = $1`, [id])).rowCount, 0, `${table} deleted`);
    }
    await assert.rejects(c.query("INSERT INTO product_categories (parent_id, name, path) VALUES ($1, '[Child]', 'Bearings › [Child]')", [theirs]), /foreign key/i, 'a parent that’s another business’s');
    await assert.rejects(c.query("INSERT INTO category_details (category_id, name, kind) VALUES ($1, '[Detail]', 'text')", [theirs]), /foreign key/i, 'a detail on another business’s category');
    await assert.rejects(c.query('INSERT INTO product_details (product_id, detail_id, value_number) VALUES ($1, $2, 30)', [ids.bearing, theirDetail]), /foreign key/i, 'an answer to another business’s detail');
    const detail = (await one(c, "INSERT INTO category_details (category_id, name, kind, unit, position) VALUES ($1, 'Outer diameter', 'number', 'mm', 0) RETURNING id", [mine])).id;
    await assert.rejects(c.query('INSERT INTO product_details (product_id, detail_id, value_number) VALUES ($1, $2, 30)', [ids.theirs, detail]), /foreign key/i, 'an answer for another business’s product');
    await assert.rejects(c.query("INSERT INTO product_categories (shop_id, name, path) VALUES ($1, '[X]', '[X]')", [ids.b]), /row-level security/i);
    // A kind it doesn't know, or a unit or choices that don't go with its kind.
    await assert.rejects(c.query("INSERT INTO category_details (category_id, name, kind) VALUES ($1, '[D]', 'date')", [mine]), /check/i);
    await assert.rejects(c.query("INSERT INTO category_details (category_id, name, kind, unit) VALUES ($1, '[D]', 'text', 'mm')", [mine]), /check/i);
    await assert.rejects(c.query("INSERT INTO category_details (category_id, name, kind, choices) VALUES ($1, '[D]', 'number', '{a}')", [mine]), /check/i);
    // A path is one category's.
    await assert.rejects(c.query("INSERT INTO product_categories (name, path) VALUES ('Bearings', 'Bearings')"), /unique/i);
    // Removing a detail takes its answers.
    await c.query('INSERT INTO product_details (product_id, detail_id, value_number) VALUES ($1, $2, 30)', [ids.bearing, detail]);
    await c.query('DELETE FROM category_details WHERE id = $1', [detail]);
    assert.equal((await one(c, 'SELECT count(*)::int AS n FROM product_details WHERE product_id = $1', [ids.bearing])).n, 0);
  });

  // Run again: nothing doubles, and a product added since keeps its own.
  await withClient(url.href, async (c) => {
    await inShop(c, ids.a);
    await c.query("INSERT INTO products (name, category) VALUES ('[Since]', '[New] › [Child]')");
    await c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    await inShop(c, ids.a);
    assert.equal((await one(c, "SELECT count(*)::int AS n FROM product_categories WHERE path IN ('Bearings', 'Drivetrain', 'Drivetrain › Derailleurs')")).n, 3);
    assert.equal((await one(c, "SELECT count(*)::int AS n FROM product_categories WHERE path IN ('[New]', '[New] › [Child]')")).n, 2);
    await c.query("DELETE FROM product_categories WHERE path LIKE '[New]%' AND parent_id IS NOT NULL");
    await c.query("DELETE FROM product_categories WHERE path = '[New]'");
    await c.query("UPDATE products SET category = 'Uncategorised' WHERE name = '[Since]'");
    await holds(c);
  });
});
