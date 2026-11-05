// Nothing changes stock or writes a stock line but server/lib/stock.js
// (openspec/changes/stock-movements-say-who, design 1). Reads the server's source, so a
// new writer fails here before it can skip who, shop, cause or the lock limit.
//
// It sees INSERT, UPDATE, DELETE, TRUNCATE and MERGE, and an INSERT's ON CONFLICT DO UPDATE.
// A guard for honest mistakes, not a proof. What still gets past it: SQL built up from
// variables so "products" and "stock_qty" never appear near each other (only `SET ${...}`
// on products is caught); a table name in a variable, as removing a shop's DELETE FROM
// ${table} and server/scripts/migrate-to-postgres.js's one-off copy do;
// anything outside server/, and functions or triggers in migrations.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server');
const THE_ONE_PLACE = path.join('lib', 'stock.js');
const LEAVE_OUT = new Set(['migrations']);
const READS = /\.(js|mjs|cjs|ts)$/;
// Each known exception, by file and what it does, and why.
const KNOWN = new Map([
  // Removing a whole shop clears its lines; no stock is left to be wrong.
  [`remove-shop.js:deletes stock lines`, true],
  // Marking a line Seen on Today (seen_at, seen_by_login_id): never its stock figures.
  [`routes/today.js:changes a stock line`, true],
]);

function sources(dir, found = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!LEAVE_OUT.has(name) && name !== 'node_modules') sources(full, found);
    } else if (READS.test(name)) found.push(full);
  }
  return found;
}

// One way of spelling a table: quotes, a schema or ONLY make no difference.
const table = (name) => `(?:ONLY\\s+)?(?:"?public"?\\.)?"?${name}"?(?![\\w"])`;
// Strings joined with + read as one, and quoted names as plain.
const flatten = (source) => source
  .replace(/(['"`])\s*\+\s*\n?\s*(['"`])/g, ' ')
  .replace(/"(\w+)"/g, '$1');

export function writersIn(raw) {
  const source = flatten(raw);
  const found = [];
  const statements = (start) => [...source.matchAll(new RegExp(start, 'gi'))].map((m) => source.slice(m.index, m.index + 600).split(/\bWHERE\b|\bRETURNING\b|`|;/i)[0]);
  if (new RegExp(`INSERT\\s+INTO\\s+${table('stock_movements')}`, 'i').test(source)) found.push('writes a stock line');
  if (new RegExp(`DELETE\\s+FROM\\s+${table('stock_movements')}`, 'i').test(source)) found.push('deletes stock lines');
  if (new RegExp(`UPDATE\\s+${table('stock_movements')}`, 'i').test(source)) found.push('changes a stock line');
  // TRUNCATE and MERGE, for one of these tables (TRUNCATE can name several).
  const truncates = (name) => new RegExp(`TRUNCATE\\s+(?:TABLE\\s+)?(?:[^;\`'"]*,\\s*)?${table(name)}`, 'i').test(source);
  const merges = (name) => new RegExp(`MERGE\\s+INTO\\s+${table(name)}`, 'i').test(source);
  if (truncates('stock_movements') || merges('stock_movements')) found.push('deletes stock lines');
  // A shop's figure (stock-per-shop): any write at all.
  if (new RegExp(`(?:INSERT\\s+INTO|UPDATE|DELETE\\s+FROM)\\s+${table('product_stock')}`, 'i').test(source) || truncates('product_stock') || merges('product_stock')) found.push('changes a shop’s stock');
  // Changing stock: stock_qty anywhere in what's set, or a SET the source can't show.
  // An INSERT's ON CONFLICT DO UPDATE too, and any MERGE or TRUNCATE of products.
  const changesOnClash = [...source.matchAll(new RegExp(`INSERT\\s+INTO\\s+${table('products')}`, 'gi'))]
    .some((m) => /\bON\s+CONFLICT\b[^`;]*?\bDO\s+UPDATE\s+SET\b[^`;]*?(?:\bstock_qty\b|\$\{)/i.test(source.slice(m.index, m.index + 1200).split(/`|;/)[0]));
  if (changesOnClash || merges('products') || truncates('products') || statements(`UPDATE\\s+${table('products')}`).some((s) => /\bstock_qty\b/i.test(s) || /\bSET\s+\$\{/i.test(s))) found.push('changes stock_qty');
  // Starting stock: a column list with stock_qty, or none at all.
  for (const m of source.matchAll(new RegExp(`INSERT\\s+INTO\\s+${table('products')}\\s*(\\([^)]*\\))?`, 'gi'))) {
    if (!m[1] || /\bstock_qty\b/i.test(m[1])) { found.push('starts a product with stock'); break; }
  }
  return found;
}

test('the check sees each way of writing stock', () => {
  const sees = (what, sql) => assert.deepEqual(writersIn(sql), [what], sql);
  for (const sql of [
    '`INSERT INTO stock_movements (product_id) VALUES (?)`',
    '`insert into "stock_movements" (product_id) VALUES (?)`',
    '`INSERT INTO public.stock_movements (product_id) VALUES (?)`',
    "'INSERT INTO ' + 'stock_movements (product_id) VALUES (?)'",
  ]) sees('writes a stock line', sql);
  for (const sql of [
    "'UPDATE products SET stock_qty = stock_qty - ?, updated_at = now() WHERE id = ?'",
    '`UPDATE products p SET name = ?,\n stock_qty = p.stock_qty + v.d FROM x`',
    '`UPDATE "products" SET stock_qty = 1`',
    '`UPDATE public.products SET stock_qty = 1`',
    '`UPDATE ONLY products SET stock_qty = 1`',
    '`UPDATE products SET "stock_qty" = 1`',
    '`UPDATE products SET (stock_qty) = (1)`',
    "`UPDATE products SET name = 'x', stock_qty = 1`",
    '`UPDATE products SET ${column} = 1`',
    "'UPDATE products ' + 'SET stock_qty = 1'",
  ]) sees('changes stock_qty', sql);
  for (const sql of [
    '`INSERT INTO products (sku, name, stock_qty) VALUES (?, ?, ?)`',
    '`INSERT INTO "products" (sku, stock_qty) VALUES (?, ?)`',
    '`INSERT INTO public.products (sku, stock_qty) VALUES (?, ?)`',
    '`INSERT INTO products SELECT * FROM old_products`',
  ]) sees('starts a product with stock', sql);
  for (const sql of [
    '`INSERT INTO product_stock (site_id, product_id, qty) VALUES (?, ?, ?)`',
    '`insert into "product_stock" (qty) VALUES (?)`',
    '`UPDATE product_stock SET qty = qty + 1`',
    '`UPDATE public.product_stock SET qty = 1`',
    '`DELETE FROM product_stock WHERE site_id = ?`',
  ]) sees('changes a shop’s stock', sql);
  for (const sql of [
    '`TRUNCATE product_stock`',
    '`TRUNCATE TABLE ONLY public.product_stock`',
    '`truncate sites, "product_stock" cascade`',
    '`MERGE INTO product_stock s USING v ON s.product_id = v.id WHEN MATCHED THEN UPDATE SET qty = 1`',
  ]) sees('changes a shop’s stock', sql);
  for (const sql of [
    '`MERGE INTO products p USING v ON p.id = v.id WHEN MATCHED THEN UPDATE SET stock_qty = 1`',
    '`merge into public.products p USING v ON p.id = v.id WHEN MATCHED THEN UPDATE SET name = v.name`',
    '`TRUNCATE products`',
    '`INSERT INTO products (sku) VALUES (?) ON CONFLICT (sku) DO UPDATE SET stock_qty = EXCLUDED.stock_qty`',
    '`INSERT INTO products (sku) VALUES (?) ON CONFLICT (sku) DO UPDATE SET name = ?, "stock_qty" = products.stock_qty + 1`',
    "'INSERT INTO products (sku) VALUES (?) ' + 'ON CONFLICT (sku) DO UPDATE SET stock_qty = 1'",
    '`INSERT INTO products (sku) SELECT sku FROM v WHERE sku <> ? ON CONFLICT (sku)\n DO UPDATE SET stock_qty = 1`',
    '`INSERT INTO products (sku) VALUES (?) ON CONFLICT (sku) DO UPDATE SET ${column} = 1`',
  ]) sees('changes stock_qty', sql);
  sees('deletes stock lines', '`DELETE FROM stock_movements WHERE id = ?`');
  sees('deletes stock lines', '`TRUNCATE stock_movements`');
  sees('deletes stock lines', '`MERGE INTO stock_movements m USING v ON m.id = v.id WHEN MATCHED THEN DELETE`');
  sees('changes a stock line', '`UPDATE stock_movements SET change_qty = 1`');
});

test('the check leaves reads and other tables alone', () => {
  for (const sql of [
    '`INSERT INTO products (sku, name) VALUES (?, ?)`',
    "'SELECT stock_qty FROM products WHERE id = ?'",
    '`INSERT INTO supplier_catalogue_items (supplier_id, stock_qty) VALUES (?, ?) ON CONFLICT DO UPDATE SET stock_qty = EXCLUDED.stock_qty`',
    "'UPDATE products SET name = ? WHERE id = ?'",
    "'UPDATE products SET name = ? WHERE stock_qty < 0'",
    "'UPDATE products_archive SET stock_qty = 1'",
    "'SELECT qty FROM product_stock WHERE site_id = ?'",
    '`INSERT INTO products (sku) VALUES (?) ON CONFLICT (sku) DO UPDATE SET name = EXCLUDED.name`',
    '`INSERT INTO products (sku) VALUES (?) ON CONFLICT DO NOTHING`',
    "'TRUNCATE products_archive'",
    "'MERGE INTO products_archive a USING v ON a.id = v.id WHEN MATCHED THEN UPDATE SET stock_qty = 1'",
    "'SELECT p.id FROM products p LEFT JOIN product_stock s ON s.product_id = p.id'",
  ]) assert.deepEqual(writersIn(sql), [], sql);
});

test('only server/lib/stock.js writes stock, apart from the named exceptions', () => {
  const files = sources(SERVER);
  assert.ok(files.length > 50, `read only ${files.length} files: wrong folder?`);
  assert.ok(files.some((f) => f.endsWith(THE_ONE_PLACE)), 'the one place is among what was read');
  assert.ok(files.some((f) => f.endsWith('.mjs')), 'and what isn’t plain .js');
  const writers = files
    .filter((f) => !f.endsWith(THE_ONE_PLACE))
    .flatMap((f) => writersIn(readFileSync(f, 'utf8')).map((what) => `${path.relative(SERVER, f)}:${what}`));
  assert.deepEqual(writers.filter((w) => !KNOWN.has(w)), []);
  assert.deepEqual([...KNOWN.keys()].filter((k) => !writers.includes(k)), [], 'an exception that’s gone comes off the list');
  assert.deepEqual(writersIn(readFileSync(path.join(SERVER, THE_ONE_PLACE), 'utf8')), ['writes a stock line', 'changes a shop’s stock', 'changes stock_qty'], 'the check still sees the one place');
});

test('marking a line Seen is the only change to a stock line, and never its figures', () => {
  const today = readFileSync(path.join(SERVER, 'routes', 'today.js'), 'utf8');
  const sets = [...today.matchAll(/UPDATE\s+stock_movements\s+\w*\s*SET\s+([^`]*?)\s+WHERE/gi)].map((m) => m[1]);
  assert.equal(sets.length, 1, 'one such statement');
  assert.doesNotMatch(sets[0], /change_qty|product_id|value_pence/);
});

test('server.js still loads its settings before anything can read them', () => {
  const [first] = readFileSync(path.join(SERVER, 'server.js'), 'utf8').match(/^import .*$/m);
  assert.match(first, /load-env\.js/, 'load-env has to stay the first import, or db.js connects with no settings');
});
