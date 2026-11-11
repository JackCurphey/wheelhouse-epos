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
import net from 'node:net';
import { startLiveServer, testServerEnv } from './helpers/liveServer.js';

// On every address, as a Wheelhouse server listens, or on 127.0.0.1 only, as
// tests' own small stand-in servers do. On a Mac the second can share a port
// with a server on every address, and then takes its 127.0.0.1 requests.
// `kind` makes it pass for another Wheelhouse test server (its /healthz answers
// as ours does), answer everything with 201 (like a test's pretend Twilio), or
// be a bare connection that closes at once (like a test's database relay).
const WHEELHOUSE = (req, res) => {
  if (req.url === '/healthz') { res.setHeader('content-type', 'application/json'); return res.end('{"status":"ok"}'); }
  res.end('not this test’s server');
};
const KINDS = {
  plain: (req, res) => res.end('not this test’s server'),
  wheelhouse: WHEELHOUSE,
  created: (req, res) => { res.statusCode = 201; res.end('{}'); },
};
function standIn(host, kind = 'plain') {
  return new Promise((resolve) => {
    const s = kind === 'relay' ? net.createServer((c) => c.destroy()) : createServer(KINDS[kind]);
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

for (const [where, host, kind] of [
  ['by another server on every address', undefined, 'plain'],
  ['by another Wheelhouse test server, whose /healthz answers as ours does', undefined, 'wheelhouse'],
  ['on 127.0.0.1 only (a test’s stand-in)', '127.0.0.1', 'plain'],
  ['on 127.0.0.1 by one answering everything with 201 (a pretend Twilio)', '127.0.0.1', 'created'],
  ['on 127.0.0.1 by a bare connection that closes (a database relay)', '127.0.0.1', 'relay'],
]) {
  test(`a port taken in the gap ${where}: the server starts on another, and the helper talks only to its own server`, async () => {
    const taken = await standIn(host, kind);
    const began = Date.now();
    const takenPort = taken.address().port;
    const offered = [takenPort];
    let live;
    try {
      live = await startLiveServer({ pickPort: async () => offered.shift() ?? freePort() });
      assert.notEqual(new URL(live.baseUrl).port, String(takenPort), 'it used the taken port');
      assert.ok(Date.now() - began < 20_000, `took ${Date.now() - began} ms: it waited out the taken port instead of trying another`);
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

// The messages timer goes through every shop in the shared database each
// round: hundreds (938 on 11 Nov) at about 6 ms each. Every test server ran it
// every 5 seconds, dozens at once in a full run, for nothing: the tests that
// want it set their own (WH_MESSAGES_TICK_MS 100 or 200), and the rest put their
// messages in as they want them. It also slowed the rounds those tests wait
// for (messaging-engine failed under load, 11 Nov). Off unless a test asks.
test('a test server’s messages timer is off unless the test sets one', () => {
  assert.equal(testServerEnv(4000).WH_MESSAGES_TICK_MS, '3600000');
  assert.equal(testServerEnv(4000, { WH_MESSAGES_TICK_MS: '100' }).WH_MESSAGES_TICK_MS, '100');
});
