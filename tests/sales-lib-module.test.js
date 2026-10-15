// WP-0.4: the sale helpers the till, orders, customers, the Shopify webhook,
// the dispatcher and shutdown all call live in server/lib/sales.js (split
// plan §4.1, the shared-helpers table). Moved, not copied: server.js imports
// them and keeps no copy of its own that could drift. And sales.js imports
// nothing from server.js, or the two would load each other.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');

const EXPORTED = [
  'serializeSale', 'SALE_SELECT', 'resolveCashierId', 'loadDocumentLine', 'createSale',
  'pendingShopifyPushes', 'runRequestWithPushSlotCleanup', 'firePendingShopifyPushes',
];
// Private to sales.js: only the exported helpers above use them.
const PRIVATE = ['resolveGroupDiscount', 'registerPendingShopifyPushSlot', 'pendingPushSlotRequestStorage'];
const defines = (source, name) =>
  new RegExp(`^(export )?((async )?function ${name}\\b|const ${name}\\b)`, 'm').test(source);

test('server/lib/sales.js exports each shared sale helper', () => {
  assert.ok(existsSync(path.join(ROOT, 'server/lib/sales.js')), 'server/lib/sales.js does not exist');
  const sales = read('server/lib/sales.js');
  const missing = EXPORTED.filter((name) =>
    !new RegExp(`^export ((async )?function ${name}\\b|const ${name}\\b)`, 'm').test(sales));
  assert.deepEqual(missing, []);
  assert.deepEqual(PRIVATE.filter((name) => !defines(sales, name)), []);
});

test('server/server.js keeps no copy of a moved sale helper', () => {
  const server = read('server/server.js');
  assert.deepEqual([...EXPORTED, ...PRIVATE].filter((name) => defines(server, name)), []);
});

test('server/server.js imports the sale helpers and re-exports what tests import', () => {
  const server = read('server/server.js');
  assert.ok(/from '\.\/lib\/sales\.js'/.test(server), 'server.js does not import ./lib/sales.js');
  const reexport = server.match(/^export \{([^}]*)\};$/m);
  const names = reexport ? reexport[1].split(',').map((n) => n.trim()) : [];
  const expected = ['loadDocumentLine', 'createSale', 'pendingShopifyPushes', 'runRequestWithPushSlotCleanup', 'firePendingShopifyPushes'];
  assert.deepEqual(expected.filter((n) => !names.includes(n)), []);
});

test('server/lib/sales.js imports nothing from server.js', () => {
  assert.ok(existsSync(path.join(ROOT, 'server/lib/sales.js')), 'server/lib/sales.js does not exist');
  const sales = read('server/lib/sales.js');
  assert.ok(!/['"]\.\.\/server\.js['"]/.test(sales), 'sales.js imports ../server.js');
});
