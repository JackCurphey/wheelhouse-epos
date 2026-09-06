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

export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
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
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
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
