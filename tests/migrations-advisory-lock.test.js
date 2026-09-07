// Proves runMigrations() serialises against a Postgres advisory lock: a
// second call must wait for a held lock rather than racing the first, which
// is what protects two app processes booting together from both trying to
// apply the same migration file (see brief-migration-advisory-lock.md).
import '../server/load-env.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pool } from '../server/db.js';
import { runMigrations, MIGRATION_LOCK_KEY } from '../server/migrations/run-migrations.js';

// Small helper: true if `promise` has not settled within `ms`.
function isStillPending(promise, ms) {
  const sentinel = Symbol('pending');
  return Promise.race([
    promise.then(() => false, () => false),
    new Promise((resolve) => setTimeout(() => resolve(sentinel), ms)),
  ]).then((result) => result === sentinel);
}

test('runMigrations blocks while another process holds the migration advisory lock', async () => {
  const holder = await pool.connect();
  try {
    await holder.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);

    const migrationRun = runMigrations();

    // While the lock is held elsewhere, runMigrations() must not have
    // finished - it should be blocked waiting on pg_advisory_lock.
    assert.equal(
      await isStillPending(migrationRun, 300),
      true,
      'runMigrations() should still be waiting on the held advisory lock'
    );

    await holder.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);

    // Minor 4: a bare "eventually completes" assertion would also pass for
    // a genuinely slow first run that has nothing to do with lock
    // contention (this test database's migrations are already applied by
    // every other test file that ran before it, which is the only reason
    // the 300ms pending-check above holds at all - it says nothing about
    // how fast a legitimately unblocked run actually is). Bound how long
    // "now that the lock is free" is allowed to take, so a regression that
    // makes the unblocked path itself slow (not just lock-contended) still
    // fails this test.
    const start = Date.now();
    await assert.doesNotReject(migrationRun);
    const elapsed = Date.now() - start;
    assert.ok(
      elapsed < 2000,
      `expected the unblocked run to complete promptly once the lock was released, took ${elapsed}ms`
    );
  } finally {
    holder.release();
  }
});
