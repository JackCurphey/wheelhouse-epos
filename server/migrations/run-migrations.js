// Applies every not-yet-applied .sql file in this folder, in filename order,
// tracking what's been applied in a schema_migrations table. Hand-rolled
// rather than a library, consistent with the project's existing
// minimal-dependency approach (pg is the only new dependency this migration
// introduces). Run automatically at server startup (see server.js) and also
// available standalone via `npm run migrate`.
import '../load-env.js';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pool } from '../db.js';

const MIGRATIONS_DIR = path.dirname(fileURLToPath(import.meta.url));

// Fixed, arbitrary key for a Postgres session-level advisory lock, unique to
// this app's migration run. Two (or more) app processes booting together
// both call runMigrations() and would otherwise both see the same unapplied
// file and race to apply it - one wins, the other throws mid-migration
// against a half-advanced schema and crash-loops. Holding this lock for the
// whole run makes a second process wait instead of racing. The number itself
// is meaningless - it just needs to never collide with another lock key used
// elsewhere in this app (nothing else uses pg_advisory_lock today) and must
// never change, or two versions of this file would stop serialising against
// each other.
export const MIGRATION_LOCK_KEY = 8_237_401_552_019;

// Important 5: without a bound, a replica blocked on this lock waits
// FOREVER - pre-listen, with no /healthz of its own to report anything -
// whether the lock is held by another replica genuinely still migrating
// (the normal multi-replica boot case this lock exists to serialise) or by
// a wedged one that will never release it. Kubernetes reads a replica stuck
// here as "still starting" and just keeps waiting (or restarts it into the
// exact same block, if some other liveness probe eventually gives up) -
// either way, "another replica is migrating" and "the migration is stuck"
// are indistinguishable from outside the process. 30s is generous for a
// real migration file to finish running (the slowest files here are schema
// DDL, not data backfills) while still being short enough that an operator
// watching a rolling deploy sees the failure well within any reasonable
// patience for "is this deploy stuck".
//
// pg_advisory_lock() DOES respect lock_timeout (unlike some other advisory
// lock functions) - it is a heavyweight lock acquisition as far as the lock
// manager is concerned, and SET lock_timeout applies to it exactly as it
// would to a normal row/table lock wait.
export const MIGRATION_LOCK_TIMEOUT_MS = 30_000;

export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`SET lock_timeout = '${MIGRATION_LOCK_TIMEOUT_MS}ms'`);
    try {
      await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    } catch (err) {
      console.error(
        `Timed out after ${MIGRATION_LOCK_TIMEOUT_MS}ms waiting for the migration advisory lock (key ${MIGRATION_LOCK_KEY}) - ` +
        'another replica may still be migrating, or one is wedged holding it. Original error:',
        err
      );
      throw err;
    }
    try {
      await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      const { rows: applied } = await client.query('SELECT filename FROM schema_migrations');
      const appliedSet = new Set(applied.map((r) => r.filename));
      const files = readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.sql'))
        .sort();
      for (const file of files) {
        if (appliedSet.has(file)) continue;
        const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
          await client.query('COMMIT');
          console.log(`Applied migration: ${file}`);
        } catch (err) {
          await client.query('ROLLBACK');
          throw new Error(`Migration ${file} failed: ${err.message}`);
        }
      }
    } finally {
      // Session-level advisory locks live on the connection, not the query,
      // so they'd otherwise stay held for as long as this client sits in the
      // pool waiting to be reused by an unrelated request - unlock
      // explicitly before handing the client back.
      //
      // Guarded with .catch(), not awaited bare: an unguarded rejection here
      // (plausible on a broken connection right after a migration failure -
      // the same connection just had a query fail and got rolled back) would
      // otherwise REPLACE whatever real error is already propagating out of
      // the try block above (the "Migration <file> failed: <reason>"
      // message), leaving the operator a connection error and no idea which
      // file broke. server/db.js's releaseClient guards the equivalent
      // hazard for the same reason (see its comment); this just crosses that
      // convention into this file. Swallowing costs nothing beyond the log
      // line below - the advisory lock is session-scoped and is released by
      // Postgres itself when the backend terminates, whether or not this
      // unlock call ever succeeds.
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]).catch((err) => {
        console.error('Failed to release migration advisory lock (harmless - released automatically when the connection closes)', err);
      });
    }
  } finally {
    client.release();
  }
}

// Allow `node server/migrations/run-migrations.js` directly, in addition to
// being imported and awaited at server startup.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMigrations()
    .then(() => {
      console.log('Migrations up to date.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
