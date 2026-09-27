// Shared Playwright fixtures for tests/browser: playwright.config.ts runs
// every file in this directory in one shared worker process (workers: 1,
// fullyParallel: false), so server/db.js's `pool` is the same singleton
// every spec file here imports. Exactly one of them has to end it once the
// whole run is done, or the pool leaks connections past the run; ending it
// from an arbitrary file's afterAll only worked because that file happened
// to sort last. A worker-scoped auto fixture ends it exactly once, when this
// worker process shuts down, regardless of file order.
import { test as base, expect } from '@playwright/test';
import { pool } from '../../server/db.js';

export const test = base.extend<{}, { closePoolOnWorkerEnd: void }>({
  closePoolOnWorkerEnd: [
    async ({}, use) => {
      await use();
      await pool.end();
    },
    { scope: 'worker', auto: true },
  ],
});

export { expect };
