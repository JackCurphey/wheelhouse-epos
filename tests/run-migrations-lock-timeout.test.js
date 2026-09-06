// Important 5: without a lock_timeout, a replica blocked on
// pg_advisory_lock waits forever, pre-listen, with no /healthz of its own to
// report anything - a wedged migration and "another replica is still
// migrating" (the normal multi-replica boot case this lock exists to
// serialise) are indistinguishable from outside the process. This proves
// runMigrations() (1) sets lock_timeout on the connection before attempting
// the lock, and (2) when the lock acquisition itself times out, logs a
// clear message naming the lock key before rethrowing - rather than the
// timeout looking like any other unexplained connection failure.
//
// Uses a fully faked pool.connect() (same technique as
// tests/run-migrations-unlock-error.test.js) rather than actually waiting
// out the real 30s production timeout against a genuinely held lock -
// that would make this one test take 30s+ for no added coverage of the
// thing actually being changed (the SET statement and the log line).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { runMigrations, MIGRATION_LOCK_KEY, MIGRATION_LOCK_TIMEOUT_MS } from '../server/migrations/run-migrations.js';

function makeFakeClient(queries) {
  return {
    query: async (sql) => {
      queries.push(sql);
      if (sql.startsWith('SET lock_timeout')) return {};
      if (sql.includes('pg_advisory_lock')) {
        const err = new Error('canceling statement due to lock timeout');
        err.code = '55P03';
        throw err;
      }
      throw new Error(`unexpected query reached in fake client: ${sql}`);
    },
    release: () => {},
  };
}

test('runMigrations sets lock_timeout before acquiring the advisory lock, and names the lock when it times out', async () => {
  const queries = [];
  const originalConnect = pool.connect.bind(pool);
  pool.connect = async () => makeFakeClient(queries);

  const originalConsoleError = console.error;
  const errorLogs = [];
  console.error = (...args) => { errorLogs.push(args.map(String).join(' ')); };

  try {
    await assert.rejects(() => runMigrations(), (err) => {
      assert.equal(err.code, '55P03', `expected the real lock-timeout error to propagate, got: ${err.message}`);
      return true;
    });

    const lockTimeoutStatement = queries.find((q) => q.startsWith('SET lock_timeout'));
    assert.ok(lockTimeoutStatement, `expected a SET lock_timeout statement before the lock acquire; queries were: ${JSON.stringify(queries)}`);
    assert.match(
      lockTimeoutStatement,
      new RegExp(String(MIGRATION_LOCK_TIMEOUT_MS)),
      `expected the SET lock_timeout statement to use the configured ${MIGRATION_LOCK_TIMEOUT_MS}ms bound, got: ${lockTimeoutStatement}`
    );

    const lockAcquireIndex = queries.findIndex((q) => q.includes('pg_advisory_lock'));
    const lockTimeoutIndex = queries.indexOf(lockTimeoutStatement);
    assert.ok(lockTimeoutIndex < lockAcquireIndex, 'lock_timeout must be set BEFORE attempting the lock acquire');

    const namedTheLock = errorLogs.some((line) => line.includes(String(MIGRATION_LOCK_KEY)));
    assert.ok(namedTheLock, `expected a log line naming the lock (key ${MIGRATION_LOCK_KEY}) when the acquire times out; logs were: ${JSON.stringify(errorLogs)}`);
  } finally {
    console.error = originalConsoleError;
    pool.connect = originalConnect;
  }
});

test.after(async () => {
  await pool.end();
});
