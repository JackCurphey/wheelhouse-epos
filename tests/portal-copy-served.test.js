// The copy lives in its own browser script (public-portal/copy.js), loaded by
// a <script> tag before portal.js. If the /book static route does not actually
// serve it, portal.js dies on "PortalCopy is not defined" and the whole
// booking portal is a blank page - a failure no unit test over the file
// contents would catch. This boots the real server and asks for it.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let server;

before(async () => {
  server = await startLiveServer();
});

after(async () => {
  if (server) await server.stop();
});

test('GET /book/copy.js serves the portal copy module', async () => {
  const res = await fetch(`${server.baseUrl}/book/copy.js`);
  assert.equal(res.status, 200, '/book/copy.js must be reachable or the portal cannot boot');
  const body = await res.text();
  assert.match(body, /globalThis\.PortalCopy/, 'served file does not define PortalCopy');
});

test('the portal page loads copy.js before portal.js', () => {
  // Order matters: portal.js reads PortalCopy while rendering, so a copy.js
  // tag placed after it would leave the first render undefined.
  const html = readFileSync(path.join(ROOT, 'public-portal/index.html'), 'utf8');
  const copyAt = html.indexOf('/book/copy.js');
  const portalAt = html.indexOf('/book/portal.js');
  assert.ok(copyAt !== -1, 'index.html never loads copy.js');
  assert.ok(portalAt !== -1, 'index.html never loads portal.js');
  assert.ok(copyAt < portalAt, 'copy.js must be loaded before portal.js');
});
