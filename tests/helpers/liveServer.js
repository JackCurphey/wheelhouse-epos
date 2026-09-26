// Boots the real server as a child process on a free port, so a test can
// make raw HTTP requests against it.
//
// Why a child process rather than importing server.js: server.js listens at
// import time and has no export, so there is nothing to mount in-process.
// Spawning it also means the tests exercise the same startup path production
// uses - env loading, migrations check, route table - rather than a
// test-only assembly of the app that could drift from it.
//
// This pattern was proven in tests/static-cache.test.js first; it is lifted
// here so workshop and portal tests can share one copy.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

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

// Every live server runs on a pinned clock (server/clock.js), so tests with
// fixed September 2026 dates are never "in the past": 07:00 UK time on
// Tuesday 1 September 2026, before every fixed date the tests use. A test
// that needs another moment passes its own WHEELHOUSE_TEST_CLOCK in `env`.
// Spec: docs/superpowers/specs/2026-09-26-book-server-10-notice-timezone-design.md
export const TEST_CLOCK_PIN = '2026-09-01T06:00:00Z';

// Returns { baseUrl, stop }. Call stop() in an after() hook - a leaked child
// keeps its port and its database connections.
export async function startLiveServer({ timeoutMs = 30000, env = {} } = {}) {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'server.js')], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), WHEELHOUSE_TEST_CLOCK: TEST_CLOCK_PIN, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));

  try {
    await waitForServer(child, baseUrl, timeoutMs);
  } catch (err) {
    child.kill('SIGKILL');
    throw err;
  }

  return {
    baseUrl,
    async stop() {
      if (child.exitCode !== null) return;
      child.kill('SIGTERM');
      await new Promise((resolve) => {
        const timer = setTimeout(() => {
          child.kill('SIGKILL');
          resolve();
        }, 5000);
        child.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    },
  };
}
