import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../server/load-env.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_DIR = path.join(ROOT, 'public', 'dist');
// A stand-in for a real Vite build artifact: content-hashed filename under
// public/dist. Kept in its own subdirectory so cleanup never deletes a real
// build sitting in public/dist alongside it.
const FIXTURE_SUBDIR = path.join(DIST_DIR, 'assets', 'static-cache-test');
const FIXTURE_URL_PATH = '/dist/assets/static-cache-test/index-abc12345.js';
const FIXTURE_FILE = path.join(FIXTURE_SUBDIR, 'index-abc12345.js');

let child;
let baseUrl;
let distDirCreated = false;

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

async function waitForServer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server exited early with code ${child.exitCode}`);
    }
    try {
      const res = await fetch(`${url}/app.js`);
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

before(async () => {
  distDirCreated = !existsSync(DIST_DIR);
  await mkdir(FIXTURE_SUBDIR, { recursive: true });
  await writeFile(FIXTURE_FILE, 'export const hashed = true;\n');

  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [path.join(ROOT, 'server', 'server.js')], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));
  await waitForServer(baseUrl);
});

after(async () => {
  if (child && child.exitCode === null) child.kill('SIGTERM');
  await rm(FIXTURE_SUBDIR, { recursive: true, force: true });
  if (distDirCreated) await rm(DIST_DIR, { recursive: true, force: true });
});

test('a hashed asset under /dist/assets/ is cached immutably', async () => {
  const res = await fetch(`${baseUrl}${FIXTURE_URL_PATH}`);
  await res.arrayBuffer();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'public, max-age=31536000, immutable');
});

test('the unhashed app bundle is still never cached', async () => {
  const res = await fetch(`${baseUrl}/app.js`);
  await res.arrayBuffer();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('index.html is still never cached', async () => {
  const res = await fetch(`${baseUrl}/index.html`);
  await res.arrayBuffer();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('a missing file under /dist/assets/ falls back to index.html and is not cached immutably', async () => {
  const res = await fetch(`${baseUrl}/dist/assets/static-cache-test/does-not-exist-deadbeef.js`);
  await res.arrayBuffer();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
});
