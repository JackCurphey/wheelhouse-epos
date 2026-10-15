// WP-0.4: the workshop settings routes (opening hours and booking rules, days
// off, capacity, service categories and services) live in
// server/routes/workshop-settings.js, Mark's file (#180, 15 Oct). Moved, not
// copied: server.js registers none of them itself and keeps none of their
// helpers. The shared bits other areas use are in server/lib/uploads.js
// (MAX_SERIAL, UPLOADS_DIR) and server/capacity.js (resolveWorkingDays).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
const FILE = 'server/routes/workshop-settings.js';

const ROUTES = [
  "'GET', '/api/workshop-settings'", "'PUT', '/api/workshop-settings'",
  "'GET', '/api/workshop-unavailability'", "'POST', '/api/workshop-unavailability'",
  "'PUT', '/api/workshop-unavailability/:id'", "'DELETE', '/api/workshop-unavailability/:id'",
  "'GET', '/api/workshop-capacity'",
  "'GET', '/api/workshop-service-categories'", "'POST', '/api/workshop-service-categories'",
  "'PUT', '/api/workshop-service-categories/:id'", "'DELETE', '/api/workshop-service-categories/:id'",
  "'GET', '/api/workshop-services'", "'POST', '/api/workshop-services'",
  "'PUT', '/api/workshop-services/:id'", "'DELETE', '/api/workshop-services/:id'",
];
const HELPERS = [
  'serializeWorkshopSettings', 'clashesFor', 'blockMechanicExists', 'serializeServiceCategory',
  'readCategoryBody', 'serializeWorkshopService', 'readServiceBody', 'readServicePlacement',
  'readQuestionsOrKeep', 'MAX_INCLUDES', 'readIncludes', 'replaceIncludes', 'loadIncludes',
];
const defines = (source, name) =>
  new RegExp(`^(export )?((async )?function ${name}\\b|const ${name}\\b)`, 'm').test(source);

test('server/routes/workshop-settings.js registers all 15 settings routes', () => {
  assert.ok(existsSync(path.join(ROOT, FILE)), `${FILE} does not exist`);
  const settings = read(FILE);
  assert.deepEqual(ROUTES.filter((r) => !settings.includes(`route(${r}`)), []);
  assert.deepEqual(HELPERS.filter((name) => !defines(settings, name)), []);
});

test('server/server.js keeps none of the settings routes or their helpers', () => {
  const server = read('server/server.js');
  assert.deepEqual(ROUTES.filter((r) => server.includes(`route(${r}`)), []);
  assert.deepEqual(HELPERS.filter((name) => defines(server, name)), []);
});

test('the settings routes are registered, and import nothing from server.js', () => {
  assert.match(read('server/routes/index.js'), /import \* as workshopSettings from '\.\/workshop-settings\.js'/);
  assert.ok(existsSync(path.join(ROOT, FILE)), `${FILE} does not exist`);
  assert.ok(!/['"]\.\.\/server\.js['"]/.test(read(FILE)), 'workshop-settings.js imports ../server.js');
});
