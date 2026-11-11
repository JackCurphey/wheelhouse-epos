// The test-server helper (tests/helpers/liveServer.js) picks a free port, lets
// it go, then starts the server on it. Dozens of test files start servers at
// once, so another process can take the port in between. Two things went wrong
// (11 Nov): the new server died with "listen EADDRINUSE" and every test in the
// file failed as "server exited early" (all 20 in give-pin-at-till, once in
// about ten full runs); and, worse, the helper counted any answer on that port
// as "started", so a file could run against another file's server.
//
// These tests hand the helper a port that is already taken, by a stand-in that
// answers every request, as another test's server would.
import '../server/load-env.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { startLiveServer } from './helpers/liveServer.js';

// On every address, as a Wheelhouse server listens, or on 127.0.0.1 only, as
// tests' own small stand-in servers do. On a Mac the second can share a port
// with a server on every address, and then takes its 127.0.0.1 requests.
// `body` lets it pass for another Wheelhouse test server, which answers /app.js
// with the same file as ours.
const APP_JS = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
function standIn(host, body = 'not this test’s server') {
  return new Promise((resolve) => {
    const s = createServer((req, res) => res.end(req.url === '/app.js' ? body : 'not this test’s server'));
    if (host) s.listen(0, host, () => resolve(s));
    else s.listen(0, () => resolve(s));
  });
}

async function freePort() {
  const s = await standIn('127.0.0.1');
  const { port } = s.address();
  await new Promise((r) => s.close(r));
  return port;
}

for (const [where, host, body] of [
  ['by another server on every address', undefined, undefined],
  ['by another Wheelhouse test server, which serves the same app.js', undefined, APP_JS],
  ['on 127.0.0.1 only (a test’s stand-in)', '127.0.0.1', undefined],
]) {
  test(`a port taken in the gap ${where}: the server starts on another, and the helper talks only to its own server`, async () => {
    const taken = await standIn(host, body);
    const takenPort = taken.address().port;
    const offered = [takenPort];
    let live;
    try {
      live = await startLiveServer({ pickPort: async () => offered.shift() ?? freePort() });
      assert.notEqual(new URL(live.baseUrl).port, String(takenPort), 'it used the taken port');
      assert.equal(await (await fetch(`${live.baseUrl}/no-such-page`)).text() === 'not this test’s server', false, 'it is talking to the other server');
    } finally {
      await live?.stop();
      await new Promise((r) => taken.close(r));
    }
  });
}

test('a server that dies at start for another reason still fails at once, naming the exit', async () => {
  await assert.rejects(
    startLiveServer({ env: { DATABASE_URL: 'postgres://nobody@127.0.0.1:1/none' }, timeoutMs: 20000 }),
    /server exited early with code 1/,
  );
});
