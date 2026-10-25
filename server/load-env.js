// Loads EPOS/.env (if present) into process.env before anything else reads
// process.env.DATABASE_URL. Must be the very first import in server.js and
// migrations/run-migrations.js's callers - ESM evaluates import statements
// in source order, so this has to run before db.js's module body (which
// constructs the Pool from process.env.DATABASE_URL at import time) does.
// Uses Node's built-in env-file loading (process.loadEnvFile, stable since
// Node 22) rather than adding a dotenv dependency.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const devAutologinBefore = process.env.WHEELHOUSE_DEV_AUTOLOGIN;
const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}
// A developer's .env may switch on WHEELHOUSE_DEV_AUTOLOGIN (no sign-in on
// localhost, server/lib/dev-autologin.js). Tests expect to be signed out
// unless they ask, so a node:test process drops it; a test that wants it
// passes it to the server itself, which is kept because it was set before
// this file read .env.
if (process.env.NODE_TEST_CONTEXT && devAutologinBefore === undefined) delete process.env.WHEELHOUSE_DEV_AUTOLOGIN;
