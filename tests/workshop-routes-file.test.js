// WP-0.4: the workshop's staff routes live in server/routes/workshop.js (split
// plan §4.1; the file is Jack's, §3). tests/route-list.test.js proves no route
// was lost or added; this proves the moved ones are registered from the
// workshop's file, not still from server.js. The list grows with each move.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');

const MOVED = [
  ['GET', '/api/workshop-jobs'],
  ['GET', '/api/workshop-jobs/:id'],
  ['POST', '/api/workshop-jobs/:id/private-link'],
  ['POST', '/api/workshop-jobs'],
  ['POST', '/api/workshop-jobs/:id/parts'],
  ['PUT', '/api/workshop-jobs/:id/parts/:partId'],
  ['DELETE', '/api/workshop-jobs/:id/parts/:partId'],
  ['PUT', '/api/workshop-jobs/:id'],
  ['POST', '/api/workshop-jobs/:id/accept-change'],
  ['POST', '/api/workshop-jobs/:id/decline-change'],
  ['POST', '/api/workshop-jobs/:id/cancellation-seen'],
  ['GET', '/api/workshop-waiting'],
];
// POST /api/workshop-jobs/:id/<action>, each registered by jobActionRoute.
const ACTIONS = [
  'accept', 'decline', 'request-reschedule', 'cancel', 'expire', 'book-in', 'collect', 'reopen-custody',
  'start', 'await-parts', 'parts-arrived', 'hold', 'resume', 'finish', 'reopen-work',
];
const registersAction = (source, action) => new RegExp(`^\\s*jobActionRoute\\('${action}',`, 'm').test(source);
const registers = (source, [method, routePath]) =>
  new RegExp(`^\\s*route\\('${method}', '${routePath.replace(/[/:-]/g, '\\$&')}'`, 'm').test(source);

test('the moved workshop routes are registered in server/routes/workshop.js', () => {
  const workshop = read('server/routes/workshop.js');
  assert.deepEqual(MOVED.filter((r) => !registers(workshop, r)), []);
});

test('server/server.js no longer registers a moved workshop route', () => {
  const server = read('server/server.js');
  assert.deepEqual(MOVED.filter((r) => registers(server, r)), []);
});

test('each job action is registered in server/routes/workshop.js, none in server.js', () => {
  const workshop = read('server/routes/workshop.js');
  const server = read('server/server.js');
  assert.deepEqual(ACTIONS.filter((a) => !registersAction(workshop, a)), []);
  assert.deepEqual(ACTIONS.filter((a) => registersAction(server, a)), []);
  assert.ok(!/^\s*(async )?function jobActionRoute\b/m.test(server), 'server.js still defines jobActionRoute');
});

test('server/routes/index.js registers the workshop area', () => {
  assert.match(read('server/routes/index.js'), /^import \* as workshop from '\.\/workshop\.js';$/m);
  assert.match(read('server/routes/index.js'), /ROUTE_AREAS = \[[^\]]*\bworkshop\b/);
});
