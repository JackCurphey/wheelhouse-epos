// WP-0.4: sales and the quotes and orders that become them live in
// server/routes/sales.js, Mark's file (split plan §4.1), with the helpers only
// they use. shopDayWindow, which the sales list and the dashboard share, is in
// server/lib/sales.js. The Shopify order and refund webhooks stay in
// server.js, where the dispatcher calls them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
const FILE = 'server/routes/sales.js';

const ROUTES = [
  "'GET', '/api/sales'", "'GET', '/api/sales/:id'", "'POST', '/api/sales'",
  "'GET', '/api/sale-documents'", "'GET', '/api/sale-documents/:id'", "'POST', '/api/sale-documents'",
  "'PUT', '/api/sale-documents/:id'", "'PUT', '/api/sale-documents/:id/items'", "'POST', '/api/sale-documents/:id/convert'",
];
const HELPERS = ['serializeSaleDocument', 'DOC_SELECT', 'DOC_KINDS'];
const defines = (source, name) =>
  new RegExp(`^(export )?((async )?function ${name}\\b|const ${name}\\b)`, 'm').test(source);

test('server/routes/sales.js registers the sales and sale-document routes', () => {
  assert.ok(existsSync(path.join(ROOT, FILE)), `${FILE} does not exist`);
  const sales = read(FILE);
  assert.deepEqual(ROUTES.filter((r) => !sales.includes(`route(${r}`)), []);
  assert.deepEqual(HELPERS.filter((name) => !defines(sales, name)), []);
});

test('server/server.js keeps none of them, but keeps the Shopify webhooks', () => {
  const server = read('server/server.js');
  assert.deepEqual(ROUTES.filter((r) => server.includes(`route(${r}`)), []);
  assert.deepEqual([...HELPERS, 'shopDayWindow'].filter((name) => defines(server, name)), []);
  assert.ok(defines(server, 'processShopifyOrderWebhook') && defines(server, 'processShopifyRefundWebhook'));
  assert.ok(/^export async function shopDayWindow\b/m.test(read('server/lib/sales.js')));
});

test('the sales routes are registered, and import nothing from server.js', () => {
  assert.match(read('server/routes/index.js'), /import \* as salesRoutes from '\.\/sales\.js'/);
  assert.ok(existsSync(path.join(ROOT, FILE)), `${FILE} does not exist`);
  assert.ok(!/['"]\.\.\/server\.js['"]/.test(read(FILE)), 'sales.js imports ../server.js');
});
