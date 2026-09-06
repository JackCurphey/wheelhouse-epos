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
import { checkDatabaseHealth } from '../server/server.js';

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
