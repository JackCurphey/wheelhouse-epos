// tests/serverImport.test.js
//
// server/server.js exports functions (serializeX, etc.) that other test
// files import directly. If importing the module also boots a real HTTP
// listener, every test file that imports it opens its own server and holds
// the event loop open - `node --test` hangs, or parallel test files collide
// on the same port. This guards that importing the module alone starts no
// listener; only running it directly (node server/server.js) may.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';

test('importing server/server.js starts no listener', async () => {
  await import('../server/server.js');
  const activeServers = process._getActiveHandles().filter(
    (h) => h.constructor && h.constructor.name === 'Server'
  );
  assert.equal(activeServers.length, 0, 'importing the module must not start a listener');
});
