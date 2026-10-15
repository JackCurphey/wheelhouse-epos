// WP-0.4: customers, their groups and their bikes live in
// server/routes/customers.js, Mark's file (split plan §4.1), with the helpers
// only they use. Moved, not copied: server.js keeps none of them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
const FILE = 'server/routes/customers.js';

const ROUTES = [
  "'GET', '/api/customer-groups'", "'POST', '/api/customer-groups'", "'PUT', '/api/customer-groups/:id'",
  "'DELETE', '/api/customer-groups/:id'", "'GET', '/api/customers'", "'GET', '/api/customers/:id'",
  "'GET', '/api/customers/:id/sales'", "'POST', '/api/customers'", "'PUT', '/api/customers/:id'",
  "'DELETE', '/api/customers/:id'", "'GET', '/api/customers/:id/bikes'", "'POST', '/api/customers/:id/bikes'",
  "'PUT', '/api/bikes/:id'", "'DELETE', '/api/bikes/:id'", "'GET', '/api/bikes/:id/jobs'",
];
const HELPERS = [
  'serializeCustomerGroup', 'resolveDiscountPercent', 'groupsForCustomer', 'groupsByCustomerId',
  'setCustomerGroups', 'resolveGroupIds', 'serializeCustomer', 'listCustomers',
];
const defines = (source, name) =>
  new RegExp(`^(export )?((async )?function ${name}\\b|const ${name}\\b)`, 'm').test(source);

test('server/routes/customers.js registers the customer, group and bike routes', () => {
  assert.ok(existsSync(path.join(ROOT, FILE)), `${FILE} does not exist`);
  const customers = read(FILE);
  assert.deepEqual(ROUTES.filter((r) => !customers.includes(`route(${r}`)), []);
  assert.deepEqual(HELPERS.filter((name) => !defines(customers, name)), []);
});

test('server/server.js keeps none of them', () => {
  const server = read('server/server.js');
  assert.deepEqual(ROUTES.filter((r) => server.includes(`route(${r}`)), []);
  assert.deepEqual(HELPERS.filter((name) => defines(server, name)), []);
});

test('the customer routes are registered, and import nothing from server.js', () => {
  assert.match(read('server/routes/index.js'), /import \* as customers from '\.\/customers\.js'/);
  assert.ok(existsSync(path.join(ROOT, FILE)), `${FILE} does not exist`);
  assert.ok(!/['"]\.\.\/server\.js['"]/.test(read(FILE)), 'customers.js imports ../server.js');
});
