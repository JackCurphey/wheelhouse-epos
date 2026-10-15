// WP-0.4: the online booking pages' customer accounts and the routes they read
// live in server/routes/portal.js, Mark's file (split plan §4.1), with the
// customer cookie helpers and the sign-in limiters only they use. Bookings and
// booking links are still in server.js until the next move.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
const FILE = 'server/routes/portal.js';

const ROUTES = [
  "'POST', '/api/portal/:shopSlug/signup'", "'POST', '/api/portal/:shopSlug/login'",
  "'POST', '/api/portal/:shopSlug/logout'", "'GET', '/api/portal/:shopSlug/me'",
  "'GET', '/api/portal/:shopSlug/mechanics'", "'GET', '/api/portal/:shopSlug/services'",
  "'GET', '/api/portal/:shopSlug/terms'", "'GET', '/api/portal/:shopSlug/availability'",
  "'GET', '/api/portal/:shopSlug/bikes'", "'POST', '/api/portal/:shopSlug/bikes'",
];
const HELPERS = ['setCustomerSessionCookie', 'clearCustomerSessionCookie', 'portalLoginLimiter', 'portalSignupLimiter'];
const defines = (source, name) =>
  new RegExp(`^(export )?((async )?function ${name}\\b|const ${name}\\b)`, 'm').test(source);

test('server/routes/portal.js registers the customer account and read routes', () => {
  assert.ok(existsSync(path.join(ROOT, FILE)), `${FILE} does not exist`);
  const portal = read(FILE);
  assert.deepEqual(ROUTES.filter((r) => !portal.includes(`route(${r}`)), []);
  assert.deepEqual(HELPERS.filter((name) => !defines(portal, name)), []);
});

test('server/server.js keeps none of them', () => {
  const server = read('server/server.js');
  assert.deepEqual(ROUTES.filter((r) => server.includes(`route(${r}`)), []);
  assert.deepEqual(HELPERS.filter((name) => defines(server, name)), []);
});

test('the portal routes are registered, and import nothing from server.js', () => {
  assert.match(read('server/routes/index.js'), /import \* as portal from '\.\/portal\.js'/);
  assert.ok(existsSync(path.join(ROOT, FILE)), `${FILE} does not exist`);
  assert.ok(!/['"]\.\.\/server\.js['"]/.test(read(FILE)), 'portal.js imports ../server.js');
});
