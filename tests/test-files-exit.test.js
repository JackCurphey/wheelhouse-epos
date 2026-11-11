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
const LIMIT_MS = 30_000;

function runUntilExit(file) {
  return new Promise((resolve) => {
    const started = Date.now();
    // NODE_TEST_CONTEXT would make the child skip running its tests.
    const { NODE_TEST_CONTEXT, ...env } = process.env;
    const child = spawn(process.execPath, ['--test', file], { stdio: 'ignore', env });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ lingered: true, ms: Date.now() - started });
    }, LIMIT_MS);
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ lingered: false, code, ms: Date.now() - started });
    });
  });
}

// Started together so a failing run costs one limit, not one per file.
const results = Promise.all(FILES.map(async (file) => [file, await runUntilExit(file)]));

for (const file of FILES) {
  test(`${file} exits promptly after its tests`, { timeout: LIMIT_MS + 10_000 }, async () => {
    const result = new Map(await results).get(file);
    assert.ok(!result.lingered, `${file} still running after ${LIMIT_MS / 1000} s`);
    assert.equal(result.code, 0, `${file} exited with code ${result.code}`);
  });
}
