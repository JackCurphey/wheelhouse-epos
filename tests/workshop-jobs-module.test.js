// WP-0.4: the workshop helpers other areas call live in server/workshop/jobs.js
// (split plan §4.1, the shared-helpers table). Moved, not copied: server.js
// imports them and keeps no copy of its own that could drift. And jobs.js
// imports nothing from server.js, or the two would load each other.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');

const MOVED = [
  'requestedOf', 'serializeWorkshopJob', 'WORKSHOP_JOB_SELECT', 'TIME_RE', 'resolveJobMechanicId',
  'addMinutesToTime', 'timeToMinutes', 'resolveJobTimes', 'CLEAR_REQUEST', 'capacityRefusal',
  'refusal', 'SLOT_GONE', 'sendQuoteResult', 'parseWorkingDays', 'currentShopToday',
  'currentShopTimeZone', 'toCapacitySettings', 'LIVE_STATES_SQL',
];
const defines = (source, name) =>
  new RegExp(`^(export )?((async )?function ${name}\\b|const ${name}\\b)`, 'm').test(source);

test('server/workshop/jobs.js exports each shared workshop helper', () => {
  const jobs = read('server/workshop/jobs.js');
  const missing = MOVED.filter((name) =>
    !new RegExp(`^export ((async )?function ${name}\\b|const ${name}\\b)`, 'm').test(jobs));
  assert.deepEqual(missing, []);
});

test('server/server.js keeps no copy of a moved helper', () => {
  const server = read('server/server.js');
  assert.deepEqual(MOVED.filter((name) => defines(server, name)), []);
});

test('server/workshop/jobs.js imports nothing from server.js', () => {
  const jobs = read('server/workshop/jobs.js');
  // Any form: `from '../server.js'`, a bare `import '../server.js'`, or import().
  assert.ok(!/['"]\.\.\/server\.js['"]/.test(jobs), 'jobs.js imports ../server.js');
});
