// A test file must exit soon after its last test finishes.
//
// React Query schedules a five-minute clean-up timer (gcTime) each time a
// screen stops watching a query. A test file that leaves one running keeps
// its process alive for the full five minutes even though its tests took
// under a second, and on CI that held one of three test slots. This runs a
// few known examples and fails any that outlive their tests; do not paper
// over a failure with --test-force-exit, which would hide real leaks.
//
// Needs `npm run pretest` first, like the screen and customer tests it runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const FILES = [
  // Page built by renderBookScreen (tests/helpers/book-screen.js).
  'tests/customer/reminder-landing.test.js',
  // Whole staff shell, its module-level client from .test-build.
  'tests/screens/restock.test.js',
  // Whole customer shell, its module-level client from .test-build.
  'tests/customer/book-layout.test.js',
  // A client the test file makes for itself.
  'tests/customer/frame.test.js',
  'tests/screens/delivery-booked-in.test.js',
];
// A lingering file lives about 300 s; a healthy one takes about 10 s on an
// idle Mac. 60 s leaves room for a busy CI runner without missing a linger.
const LIMIT_MS = 60_000;
const KEEP_OUTPUT = 4_000;

function runUntilExit(file) {
  return new Promise((resolve) => {
    const started = Date.now();
    let output = '';
    const keep = (chunk) => { output = (output + chunk).slice(-KEEP_OUTPUT); };
    // NODE_TEST_CONTEXT would make the child skip running its tests.
    const { NODE_TEST_CONTEXT, ...env } = process.env;
    // detached puts the child in its own process group, so the timeout can
    // kill the test file's own process too, not just the runner above it.
    const child = spawn(process.execPath, ['--test', file], { env, detached: true });
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    const timer = setTimeout(() => {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
      resolve({ lingered: true, ms: Date.now() - started, output });
    }, LIMIT_MS);
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ lingered: false, code: null, error, output });
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ lingered: false, code, ms: Date.now() - started, output });
    });
  });
}

// Started together so a failing run costs one limit, not one per file.
const results = Promise.all(FILES.map(async (file) => [file, await runUntilExit(file)]));

for (const file of FILES) {
  test(`${file} exits promptly after its tests`, { timeout: LIMIT_MS + 10_000 }, async () => {
    const result = new Map(await results).get(file);
    assert.ok(!result.error, `${file} could not start: ${result.error?.message}`);
    assert.ok(!result.lingered, `${file} still running after ${LIMIT_MS / 1000} s. Its last output:\n${result.output}`);
    assert.equal(result.code, 0, `${file} exited with code ${result.code}. Its last output:\n${result.output}`);
  });
}
