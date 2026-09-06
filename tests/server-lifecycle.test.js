// tests/server-lifecycle.test.js
//
// Covers server/server.js's process lifecycle: graceful shutdown on
// SIGTERM/SIGINT (part 1), the top-level crash guard on
// unhandledRejection/uncaughtException (part 2), and /healthz actually
// touching the database rather than serving a static file (part 3).
//
// Parts 1 and 3 spawn the real server as a child process (same pattern as
// tests/helpers/liveServer.js) so they exercise the real startup path and a
// real OS-level SIGTERM, not a mocked one. Part 2 spawns a tiny standalone
// fixture script instead of the full server, because installCrashGuard()
// itself needs no database connection to prove it logs and exits non-zero -
// booting the whole app (migrations, pooler probe) would only add noise and
// slow the test down for no added coverage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { createServer as createNetServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../server/load-env.js';
import { checkDatabaseHealth, gracefulShutdown } from '../server/server.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createNetServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

// Deliberately probes a static asset, not /healthz - this readiness check
// has to keep working even while a test is temporarily proving /healthz
// itself broken (see the red-state proof in the report), or every other
// test in this file that merely needs "is the server up yet" would hang
// waiting on the very route under test.
async function waitForServer(child, baseUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server exited early with code ${child.exitCode}`);
    }
    try {
      const res = await fetch(`${baseUrl}/app.js`);
      if (res.status === 200) {
        await res.arrayBuffer();
        return;
      }
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server did not start in ${timeoutMs}ms: ${lastErr}`);
}

// Spawns the real server, giving the test direct access to the child handle
// (tests/helpers/liveServer.js deliberately hides this behind stop(), which
// is too coarse for a test that needs to send SIGTERM and separately probe
// "is it still accepting connections" and "did it exit" as distinct steps).
async function spawnServer(env = {}) {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'server.js')], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (d) => {
    stderr += d.toString('utf8');
  });
  let stdout = '';
  child.stdout.on('data', (d) => {
    stdout += d.toString('utf8');
  });
  try {
    await waitForServer(child, baseUrl, 30000);
  } catch (err) {
    child.kill('SIGKILL');
    throw err;
  }
  return {
    child,
    port,
    baseUrl,
    getStderr: () => stderr,
    getStdout: () => stdout,
  };
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (child.exitCode !== null) return resolve(child.exitCode);
    const timer = setTimeout(() => reject(new Error(`process did not exit within ${timeoutMs}ms`)), timeoutMs);
    child.once('exit', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

// Opens a raw socket and sends the request line + headers immediately, but
// only the FIRST byte of the JSON body - server/server.js's readJsonBody is
// then genuinely suspended awaiting more 'data' events, which is what makes
// this request "in flight" for as long as the caller wants, without relying
// on timing a fast in-process handler to line up with a signal.
function openPartialLoginRequest(port) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1', () => {
      const body = Buffer.from(JSON.stringify({ email: 'nobody@example.com', password: 'wrong-password' }));
      const head =
        `POST /api/auth/login HTTP/1.1\r\n` +
        `Host: 127.0.0.1:${port}\r\n` +
        `Content-Type: application/json\r\n` +
        `Content-Length: ${body.length}\r\n` +
        `Connection: close\r\n\r\n`;
      socket.write(head);
      socket.write(body.subarray(0, 1));

      // Registered NOW, not inside finish() below - if the server (or the
      // whole process) tears the connection down early, that 'end'/'error'
      // can fire well before the caller ever asks to finish, and a listener
      // added only inside finish() would silently miss an event that
      // already happened, hanging forever instead of surfacing it. Buffer
      // whatever arrives and record whether/how the socket has already
      // settled so finish() can react correctly either way.
      let raw = '';
      let settled = null; // { via: 'end' } | { via: 'error', err }
      const doneWaiters = [];
      socket.on('data', (chunk) => {
        raw += chunk.toString('utf8');
      });
      socket.on('end', () => {
        settled = { via: 'end' };
        doneWaiters.splice(0).forEach((fn) => fn());
      });
      socket.on('error', (err) => {
        settled = { via: 'error', err };
        doneWaiters.splice(0).forEach((fn) => fn());
      });

      resolve({
        socket,
        // Sends the rest of the body, then resolves with the raw bytes
        // received once the socket has ended - or rejects with whatever
        // error already closed it, including one that happened before this
        // was even called.
        finish: () =>
          new Promise((res, rej) => {
            const check = () => (settled?.via === 'error' ? rej(settled.err) : res(raw));
            if (settled) return check();
            doneWaiters.push(check);
            if (!socket.destroyed) socket.write(body.subarray(1));
          }),
      });
    });
    socket.on('error', reject);
  });
}

function attemptConnect(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.once('connect', () => {
      socket.destroy();
      resolve({ connected: true });
    });
    socket.once('error', (err) => {
      resolve({ connected: false, code: err.code });
    });
  });
}

test('SIGTERM lets an in-flight request finish, stops accepting new connections, and exits cleanly', async () => {
  const server = await spawnServer();
  try {
    const { finish } = await openPartialLoginRequest(server.port);
    // Give the server a moment to actually accept the connection and start
    // awaiting the rest of the body before the signal lands.
    await new Promise((r) => setTimeout(r, 150));

    server.child.kill('SIGTERM');

    // Still mid-shutdown grace period: a brand new connection must be
    // refused (the listening socket is already closed), even though the
    // process has not exited yet because the request above is still open.
    await new Promise((r) => setTimeout(r, 150));
    const attempt = await attemptConnect(server.port);
    assert.equal(attempt.connected, false, 'a new connection during the grace period must be refused');
    assert.equal(server.child.exitCode, null, 'the process must still be alive while the in-flight request is open');

    // Now let the in-flight request complete - it must get a real HTTP
    // response, not a reset connection.
    const raw = await finish();
    assert.match(raw, /^HTTP\/1\.1 401/, 'the request that was in flight when SIGTERM landed must still be answered');

    const code = await waitForExit(server.child, 5000);
    assert.equal(code, 0, `process should exit 0 after draining; stderr:\n${server.getStderr()}`);
  } finally {
    if (server.child.exitCode === null) server.child.kill('SIGKILL');
  }
});

test('SIGINT is handled the same way as SIGTERM', async () => {
  const server = await spawnServer();
  try {
    server.child.kill('SIGINT');
    const code = await waitForExit(server.child, 5000);
    assert.equal(code, 0, `process should exit 0 on SIGINT; stderr:\n${server.getStderr()}`);
  } finally {
    if (server.child.exitCode === null) server.child.kill('SIGKILL');
  }
});

test('GET /healthz returns 200 with the database actually reachable', async () => {
  const server = await spawnServer();
  try {
    const res = await fetch(`${server.baseUrl}/healthz`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
  } finally {
    server.child.kill('SIGTERM');
    await waitForExit(server.child, 5000).catch(() => server.child.kill('SIGKILL'));
  }
});

// GET /healthz with the database actually unreachable, driven over real HTTP
// against the real route (not checkDatabaseHealth() called directly - see
// the note below on why that alone is not coverage of the route). Cutting
// off the real shared docker-compose Postgres would break every other test
// file's pool at the same time, so this spawns the app pointed at a TCP
// proxy in front of the real database instead: boot (migrations, the pooler
// probe) succeeds through the proxy exactly as normal, then the proxy stops
// accepting new connections. The app's own pool still has its already-open
// connections at that point, so this does NOT yet retest anything - it waits
// past pg's default 10s idleTimeoutMillis, which pg itself uses to cleanly
// end those idle connections (no socket error, just a normal client.end()).
// The next SELECT 1 then has no idle client to reuse and must open a fresh
// one, which the now-closed proxy refuses - a real, connection-level
// "database unreachable" indistinguishable from the real thing, delivered to
// this one spawned process's own isolated pool without touching the shared
// test database at all.
//
// (Destroying the proxy's already-open sockets instead of just closing its
// listener was tried first and rejected: pg's Pool has no
// pool.on('error', ...) handler in server/db.js, so an idle client's
// connection dying mid-flight surfaces as an uncaughtException that this
// file's own crash guard (installCrashGuard) treats as fatal and exits the
// whole process before /healthz is ever reached - a real gap worth a human
// look at server/db.js, not something this route-level test can or should
// paper over.)
// Polls /healthz until it returns the given status or the deadline passes,
// returning the last response so the caller can assert on it. This replaces
// a fixed sleep banking on pg's 10s idle timer firing in the spawned child's
// event loop within a fixed margin - setTimeout only guarantees "no earlier
// than", so under CPU contention (concurrent test files, a loaded CI runner,
// a slower machine) that margin is ordinary scheduling jitter, not a real
// deadline, and the test fails for losing a race rather than for a defect.
//
// The interval between checks MUST be well above pg's idle timeout (10s),
// not a short poll like 200ms. Every /healthz call that gets a 200 has
// exercised the pool's one surviving idle client, and pg starts that
// client's idle timer over again the moment it is released back to the
// pool - polling more frequently than the timeout is what would make it,
// so a fast/tight poll here would never observe the 503 at all (proven
// empirically: it still read 200 after 30+ seconds of 200ms polling).
// Spacing checks past the timeout gives each one an honest, undisturbed
// window for the client to actually go idle and get closed, and a failed
// check simply retries with a fresh full window rather than the test
// failing outright - which is what makes this robust to jitter that would
// have broken the old fixed 10,500ms wait.
async function pollUntilStatus(url, expectedStatus, { timeoutMs, intervalMs }) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (true) {
    last = await fetch(url);
    if (last.status === expectedStatus || Date.now() >= deadline) return last;
    await last.arrayBuffer().catch(() => {});
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

test('GET /healthz returns 503 with the database actually unreachable', async () => {
  const realDbUrl = new URL(process.env.DATABASE_URL);
  const openSockets = new Set();
  const proxy = createNetServer((client) => {
    const upstream = net.connect(Number(realDbUrl.port), realDbUrl.hostname);
    openSockets.add(client);
    client.pipe(upstream);
    upstream.pipe(client);
    client.on('error', () => {});
    upstream.on('error', () => {});
  });
  await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
  const proxyPort = proxy.address().port;

  const proxiedDbUrl = new URL(process.env.DATABASE_URL);
  proxiedDbUrl.hostname = '127.0.0.1';
  proxiedDbUrl.port = String(proxyPort);

  const server = await spawnServer({ DATABASE_URL: proxiedDbUrl.toString() });
  try {
    const before = await fetch(`${server.baseUrl}/healthz`);
    assert.equal(before.status, 200, 'sanity check: boot through the proxy must succeed exactly like a direct connection');

    // Stop accepting NEW connections only - existing piped connections are
    // left alone so pg ends them cleanly on its own idle timeout rather than
    // erroring out (see the comment above).
    proxy.close();

    // pg's default idleTimeoutMillis is 10s; poll at an interval past that
    // (11s) with a generous overall budget (45s, four attempts) rather than
    // trusting a single fixed sleep to land after it in every environment
    // this runs in.
    const res = await pollUntilStatus(`${server.baseUrl}/healthz`, 503, { timeoutMs: 45_000, intervalMs: 11_000 });
    assert.equal(server.child.exitCode, null, `server must not have crashed while waiting out the idle timeout; stderr:\n${server.getStderr()}`);
    assert.equal(res.status, 503, `expected 503 once every pooled connection has to be re-established through the dead proxy; stderr:\n${server.getStderr()}`);
    const body = await res.json();
    assert.equal(body.status, 'error');
    assert.equal(body.error, 'Database unreachable');
  } finally {
    if (server.child.exitCode === null) server.child.kill('SIGKILL');
    for (const s of openSockets) s.destroy();
    proxy.close();
  }
});

// checkDatabaseHealth is the function /healthz calls to decide its status
// code. Exercising the failure branch through a full HTTP round trip would
// mean cutting off the real shared docker-compose Postgres out from under
// every other test file running against it - instead this drives the exact
// function the route calls with a fake pool whose query() rejects, which is
// a faithful unit of "what does /healthz do when the database is
// unreachable" without disturbing anything else.
test('checkDatabaseHealth reports not-ok when the query fails, without throwing', async () => {
  const brokenPool = { query: () => Promise.reject(new Error('connection terminated unexpectedly')) };
  const result = await checkDatabaseHealth(brokenPool);
  assert.equal(result.ok, false);
  assert.match(result.error.message, /connection terminated/);
});

test('checkDatabaseHealth reports ok against a pool whose query succeeds', async () => {
  const workingPool = { query: () => Promise.resolve({ rows: [{ '?column?': 1 }] }) };
  const result = await checkDatabaseHealth(workingPool);
  assert.equal(result.ok, true);
});

// Part 2 - crash guard. installCrashGuard() needs no database, so this spawns
// a tiny fixture script (not the full server) that imports it directly and
// deliberately triggers each failure mode.
function runCrashGuardFixture(mode) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ['--input-type=module', '-e', crashGuardFixtureSource(mode)],
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let stderr = '';
    let stdout = '';
    child.stderr.on('data', (d) => (stderr += d.toString('utf8')));
    child.stdout.on('data', (d) => (stdout += d.toString('utf8')));
    child.on('exit', (code) => resolve({ code, stderr, stdout }));
  });
}

function crashGuardFixtureSource(mode) {
  const importPath = path.join(ROOT, 'server', 'server.js').replace(/\\/g, '\\\\');
  if (mode === 'uncaughtException') {
    return (
      `import { installCrashGuard } from ${JSON.stringify(importPath)};\n` +
      `installCrashGuard();\n` +
      `setTimeout(() => { throw new Error('deliberate crash-guard fixture failure'); }, 10);\n` +
      // Keeps the event loop alive long enough for the throw above to fire;
      // if the guard works this timer never gets the chance to complete.
      `setTimeout(() => { console.log('fixture did not crash'); }, 2000);\n`
    );
  }
  return (
    `import { installCrashGuard } from ${JSON.stringify(importPath)};\n` +
    `installCrashGuard();\n` +
    `setTimeout(() => { Promise.reject(new Error('deliberate crash-guard fixture rejection')); }, 10);\n` +
    `setTimeout(() => { console.log('fixture did not crash'); }, 2000);\n`
  );
}

test('installCrashGuard exits non-zero on an uncaught exception', async () => {
  const { code, stderr, stdout } = await runCrashGuardFixture('uncaughtException');
  assert.notEqual(code, 0, `expected a non-zero exit code; stdout:\n${stdout}\nstderr:\n${stderr}`);
  assert.match(stderr, /deliberate crash-guard fixture failure/);
  assert.doesNotMatch(stdout, /fixture did not crash/);
});

test('installCrashGuard exits non-zero on an unhandled promise rejection', async () => {
  const { code, stderr, stdout } = await runCrashGuardFixture('unhandledRejection');
  assert.notEqual(code, 0, `expected a non-zero exit code; stdout:\n${stdout}\nstderr:\n${stderr}`);
  assert.match(stderr, /deliberate crash-guard fixture rejection/);
  assert.doesNotMatch(stdout, /fixture did not crash/);
});

// ---------- gracefulShutdown driven directly (fake httpServer/dbPool) ----------
//
// The SIGTERM/SIGINT tests above spawn the real process and prove the
// observable outer behaviour (drains a real in-flight HTTP request, exits
// 0). These tests instead call gracefulShutdown() directly with injected
// fakes - exactly the seam it already exposes for this
// (httpServer/dbPool/graceMs/exit/pendingPushes) - to pin two properties
// that a real spawned process can't easily force on demand: a deferred
// Shopify push still in flight when shutdown begins, and a request (or a
// push) that never finishes at all.
//
// Each scenario spawns its own tiny fixture process rather than calling
// gracefulShutdown() in-process (like the crash-guard fixtures below do, for
// the same reason): gracefulShutdown() guards itself with a module-level
// `shuttingDown` flag that is never reset, so a second in-process call in
// this same test file would silently no-op and the test would hang forever
// awaiting an exit() that never comes. A fresh process per scenario gives
// each one a fresh module and makes that a non-issue.
function runGracefulShutdownFixture(source) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', source], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString('utf8')));
    child.stderr.on('data', (d) => (stderr += d.toString('utf8')));
    child.on('exit', () => resolve({ stdout, stderr }));
  });
}

function gracefulShutdownImportLine() {
  const importPath = path.join(ROOT, 'server', 'server.js').replace(/\\/g, '\\\\');
  return `import { gracefulShutdown } from ${JSON.stringify(importPath)};\n`;
}

test('a deferred Shopify push in flight when shutdown begins is drained before the pool ends', async () => {
  const source =
    gracefulShutdownImportLine() +
    `let pushResolve;\n` +
    `const pushPromise = new Promise((res) => { pushResolve = res; });\n` +
    // Mirrors the real firePendingShopifyPushes/pendingShopifyPushes pattern
    // (server/server.js): the tracked promise removes itself from the set
    // once it settles. Without this, waitForPendingShopifyPushes' own
    // \`while (pendingPushes.size > 0)\` loop would spin on an already-settled
    // promise forever - a bug in this test fixture, not in gracefulShutdown,
    // caught by running it standalone before wiring it into node:test.
    `const pendingPushes = new Set();\n` +
    `const trackedPush = pushPromise.then(() => console.log('MARK push-settled'));\n` +
    `pendingPushes.add(trackedPush);\n` +
    `trackedPush.finally(() => pendingPushes.delete(trackedPush));\n` +
    `const fakeHttpServer = { close: (cb) => setImmediate(cb), closeIdleConnections: () => {} };\n` +
    `const fakeDbPool = { end: () => { console.log('MARK pool-end'); return Promise.resolve(); } };\n` +
    `gracefulShutdown('SIGTERM', {\n` +
    `  httpServer: fakeHttpServer, dbPool: fakeDbPool, graceMs: 5000, pendingPushes,\n` +
    `  exit: (code) => { console.log('MARK exit:' + code); process.exit(code); },\n` +
    `});\n` +
    `setTimeout(() => pushResolve(), 100);\n`;

  const { stdout, stderr } = await runGracefulShutdownFixture(source);
  const marks = [...stdout.matchAll(/MARK (\S+)/g)].map((m) => m[1]);
  assert.deepEqual(
    marks,
    ['push-settled', 'pool-end', 'exit:0'],
    `the push must settle strictly before the pool ends, which must happen strictly before exit; stdout:\n${stdout}\nstderr:\n${stderr}`
  );
});

// Reviewer's suggested shape for the force-exit timer (otherwise completely
// unexercised: delete it and "bounded" silently becomes "hangs forever on a
// stuck request", and nothing in this suite would notice).
test('gracefulShutdown force-exits once the grace period elapses, even if httpServer.close never calls back', async () => {
  const source =
    gracefulShutdownImportLine() +
    // The force-exit timer is deliberately .unref()'d in production (see
    // server/server.js) so it can never itself be the reason the process
    // stays alive - a real listening httpServer is what keeps the event
    // loop open until then. This fake httpServer never calls back and holds
    // no handle of its own, so without something else ref'd here Node would
    // find nothing left to do and exit on its own before the unref'd timer
    // ever got a chance to fire - proving nothing about gracefulShutdown
    // itself. This interval stands in for that real listening socket.
    `setInterval(() => {}, 1000);\n` +
    `const fakeHttpServer = { close: () => {}, closeIdleConnections: () => {} };\n` +
    `const fakeDbPool = { end: () => Promise.resolve() };\n` +
    `const start = Date.now();\n` +
    `gracefulShutdown('SIGTERM', {\n` +
    `  httpServer: fakeHttpServer, dbPool: fakeDbPool, graceMs: 100,\n` +
    `  exit: (code) => { console.log('MARK exit:' + code + ':' + (Date.now() - start)); process.exit(code); },\n` +
    `});\n`;

  const { stdout, stderr } = await runGracefulShutdownFixture(source);
  const match = stdout.match(/MARK exit:(-?\d+):(\d+)/);
  assert.ok(match, `expected an exit mark; stdout:\n${stdout}\nstderr:\n${stderr}`);
  const [, code, elapsedStr] = match;
  assert.equal(code, '1', 'a hung close() must still force-exit with a non-zero code');
  assert.ok(Number(elapsedStr) < 2000, `force-exit must fire close to the grace period (100ms), took ${elapsedStr}ms`);
});

// The same bound applies to a wedged Shopify push specifically - tracking it
// must never turn into a NEW way for shutdown to hang, on top of the plain
// close()-never-calls-back case above.
test('a Shopify push that never settles cannot hold shutdown open past the grace period', async () => {
  const source =
    gracefulShutdownImportLine() +
    // Same keep-alive rationale as the previous test - a pending await on a
    // promise that never settles schedules no timer/IO of its own and would
    // otherwise let Node's event loop drain and exit before the unref'd
    // force-exit timer got a chance to fire.
    `setInterval(() => {}, 1000);\n` +
    `const pendingPushes = new Set([new Promise(() => {})]);\n` + // never settles
    `const fakeHttpServer = { close: (cb) => setImmediate(cb), closeIdleConnections: () => {} };\n` +
    `const fakeDbPool = { end: () => Promise.resolve() };\n` +
    `const start = Date.now();\n` +
    `gracefulShutdown('SIGTERM', {\n` +
    `  httpServer: fakeHttpServer, dbPool: fakeDbPool, graceMs: 150, pendingPushes,\n` +
    `  exit: (code) => { console.log('MARK exit:' + code + ':' + (Date.now() - start)); process.exit(code); },\n` +
    `});\n`;

  const { stdout, stderr } = await runGracefulShutdownFixture(source);
  const match = stdout.match(/MARK exit:(-?\d+):(\d+)/);
  assert.ok(match, `expected an exit mark; stdout:\n${stdout}\nstderr:\n${stderr}`);
  const [, code, elapsedStr] = match;
  assert.equal(code, '1', 'a wedged push must still force-exit with a non-zero code');
  assert.ok(Number(elapsedStr) < 2000, `a wedged push must not delay exit past the grace period (150ms), took ${elapsedStr}ms`);
});
