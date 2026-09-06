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

    // Now that the lock is free, the blocked call should complete.
    await assert.doesNotReject(migrationRun);
  } finally {
    holder.release();
  }
});
