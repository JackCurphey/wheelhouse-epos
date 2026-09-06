// Important 3: server/migrations/run-migrations.js's `finally` block runs
// `await client.query('SELECT pg_advisory_unlock($1)', ...)` unguarded. On a
// broken connection - plausible right after a migration failure, since the
// same connection just had a query fail and got rolled back - that unlock
// call can itself reject, and an unguarded rejection inside a `finally`
// REPLACES whatever error was already propagating (the real
// "Migration <file> failed: <reason>" message), leaving the operator only a
// connection error and no idea which migration file broke.
//
// This test fakes pool.connect() entirely (rather than pointing at the real
// database) so the migration "content" failure and the unlock failure can
// both be forced deterministically and independently, on the very first
// unapplied file - real migration file content differs from the control
// statements below ('BEGIN', 'COMMIT', 'ROLLBACK', the two hardcoded
// queries), so it reliably falls through to the "else" branch that
// simulates the broken file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { runMigrations } from '../server/migrations/run-migrations.js';

function makeFakeClient() {
  return {
    query: async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return {};
      if (sql.startsWith('SET lock_timeout')) return {};
      if (sql.includes('pg_advisory_lock')) return {};
      if (sql.includes('CREATE TABLE IF NOT EXISTS schema_migrations')) return {};
      if (sql.includes('SELECT filename FROM schema_migrations')) return { rows: [] };
      if (sql.includes('INSERT INTO schema_migrations')) return {};
      if (sql.includes('pg_advisory_unlock')) {
        throw new Error('simulated connection broken during unlock');
      }
      // Anything else is treated as an actual migration file's own SQL -
      // simulate that file being broken.
      throw new Error('simulated migration content failure');
    },
    release: () => {},
  };
}

test('a broken connection during pg_advisory_unlock does not replace the real migration failure', async () => {
  const originalConnect = pool.connect.bind(pool);
  pool.connect = async () => makeFakeClient();
  try {
    await assert.rejects(
      () => runMigrations(),
      (err) => {
        assert.match(
          err.message,
          /^Migration .+ failed: simulated migration content failure$/,
          `expected the real migration failure to survive the unlock rejection, got: ${err.message}`
        );
        return true;
      }
    );
  } finally {
    pool.connect = originalConnect;
  }
});

test.after(async () => {
  await pool.end();
});
