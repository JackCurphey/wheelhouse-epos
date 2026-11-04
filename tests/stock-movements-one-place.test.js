// Nothing changes stock or writes a stock line but server/lib/stock.js
// (openspec/changes/stock-movements-say-who, design 1). Reads the server's source, so a
// new writer fails here before it can skip who, shop, cause or the lock limit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server');
const THE_ONE_PLACE = path.join('lib', 'stock.js');
// server/scripts holds the one-off move from the first database, not the running app.
const LEAVE_OUT = new Set(['migrations', 'scripts']);

function sources(dir, found = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!LEAVE_OUT.has(name)) sources(full, found);
    } else if (name.endsWith('.js')) found.push(full);
  }
  return found;
}

// A statement in a template or string, up to its closing quote.
const WRITES = [
  [/INSERT\s+INTO\s+stock_movements/i, 'writes a stock line'],
  [/UPDATE\s+products\b[^`'"]*\bstock_qty\s*=/i, 'changes stock_qty'],
  [/INSERT\s+INTO\s+products\s*\([^)]*\bstock_qty\b/i, 'starts a product with stock'],
];
export function writersIn(source) {
  return WRITES.filter(([pattern]) => pattern.test(source)).map(([, what]) => what);
}

test('the check can see each way of writing stock, and leaves reads and other tables alone', () => {
  assert.deepEqual(writersIn('`INSERT INTO stock_movements (product_id) VALUES (?)`'), ['writes a stock line']);
  assert.deepEqual(writersIn("'UPDATE products SET stock_qty = stock_qty - ?, updated_at = now() WHERE id = ?'"), ['changes stock_qty']);
  assert.deepEqual(writersIn('`UPDATE products p SET name = ?,\n stock_qty = p.stock_qty + v.d FROM x`'), ['changes stock_qty']);
  assert.deepEqual(writersIn('`INSERT INTO products (sku, name, stock_qty) VALUES (?, ?, ?)`'), ['starts a product with stock']);
  assert.deepEqual(writersIn('`INSERT INTO products (sku, name) VALUES (?, ?)`'), []);
  assert.deepEqual(writersIn("'SELECT stock_qty FROM products WHERE id = ?'"), []);
  assert.deepEqual(writersIn('`INSERT INTO supplier_catalogue_items (supplier_id, stock_qty) VALUES (?, ?) ON CONFLICT DO UPDATE SET stock_qty = EXCLUDED.stock_qty`'), []);
  assert.deepEqual(writersIn("'UPDATE products SET name = ? WHERE id = ?'"), []);
});

test('only server/lib/stock.js writes stock', () => {
  const files = sources(SERVER);
  assert.ok(files.length > 50, `read only ${files.length} files: wrong folder?`);
  assert.ok(files.some((f) => f.endsWith(THE_ONE_PLACE)), 'the one place is among what was read');
  const writers = files
    .filter((f) => !f.endsWith(THE_ONE_PLACE))
    .flatMap((f) => writersIn(readFileSync(f, 'utf8')).map((what) => `${path.relative(SERVER, f)} ${what}`));
  assert.deepEqual(writers, []);
  assert.deepEqual(writersIn(readFileSync(path.join(SERVER, THE_ONE_PLACE), 'utf8')), ['writes a stock line', 'changes stock_qty'], 'the check still sees the one place');
});
