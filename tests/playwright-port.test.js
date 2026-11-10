// Each browser test run gets a free port of its own (playwright.config.ts).
//
// It used to be 8091 for every run. Several sessions test at once on one Mac,
// each in its own worktree, and a second browser run while another was going
// stopped at once: "http://127.0.0.1:8091/workshop is already used" (10 Nov).
// The port is chosen once, by the run, and kept in WH_BROWSER_PORT so its
// worker processes (which load the config again) use the same one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = path.join(ROOT, 'playwright.config.ts');

// The base address the config gives, loaded in a fresh process with this environment.
function baseUrlWith(env) {
  const out = spawnSync(process.execPath, ['--input-type=module', '-e',
    `const { default: c } = await import(${JSON.stringify(CONFIG)}); process.stdout.write(JSON.stringify({ base: c.use.baseURL, server: c.webServer.url, port: c.webServer.env.PORT }));`], {
    cwd: ROOT, env, encoding: 'utf8',
  });
  assert.equal(out.status, 0, out.stderr);
  return JSON.parse(out.stdout);
}

const withoutPort = () => {
  const env = { ...process.env };
  delete env.WH_BROWSER_PORT;
  return env;
};

test('with 8091 taken, a run still gets a port, a free one, and its server and pages agree on it', async () => {
  const taken = createServer();
  await new Promise((resolve, reject) => { taken.once('error', reject); taken.listen(8091, '127.0.0.1', resolve); }).catch(() => {});
  try {
    const got = baseUrlWith(withoutPort());
    const port = Number(new URL(got.base).port);
    assert.notEqual(port, 8091);
    assert.equal(got.server, `${got.base}/workshop`);
    assert.equal(got.port, String(port));
    const probe = createServer();
    await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(port, '127.0.0.1', resolve); });
    await new Promise((resolve) => probe.close(resolve));
  } finally {
    await new Promise((resolve) => taken.close(() => resolve()));
  }
});

test('a worker loading the config again keeps the run’s port', () => {
  assert.equal(baseUrlWith({ ...withoutPort(), WH_BROWSER_PORT: '54321' }).base, 'http://127.0.0.1:54321');
});
