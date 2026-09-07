// tests/db-pooler-guard.test.js
//
// With DB_TENANT_SCOPE=session the tenant is a SESSION-scoped Postgres
// setting, which is only safe if one checked-out client means one dedicated
// backend for the whole request. Put a connection-multiplexing pooler
// (PgBouncer in transaction mode, and most managed equivalents) in front of
// the app and that stops being true: two "different" clients can land on one
// backend, and one request's tenant becomes another's.
//
// The guard detects exactly that, by observation rather than by guessing
// from a hostname: set a nonce as a session variable on one checked-out
// client and see whether a second, concurrently checked-out client can read
// it back. A shared backend is the only way it can. No false positives.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, probePoolerMode, assertPoolerModeSafe } from '../server/db.js';

// A pool that hands the SAME physical connection to every caller - what a
// transaction-mode pooler looks like from the app's side, in the worst case.
// It wraps a real client so the probe's SQL genuinely runs; nothing here is
// stubbed out, only the connection assignment.
async function sharedBackendPool() {
  const real = await pool.connect();
  const shared = {
    query: (...args) => real.query(...args),
    release: () => {},
  };
  return {
    fake: { connect: async () => shared },
    async dispose() {
      await real.query("SELECT set_config('app.pooler_probe', '', false)").catch(() => {});
      real.release();
    },
  };
}

test('probePoolerMode reports the real docker-compose Postgres as safe', async () => {
  const result = await probePoolerMode(pool);
  assert.equal(result.safe, true, result.reason);
  assert.equal(typeof result.reason, 'string');
});

test('probePoolerMode detects two clients sharing one backend', async () => {
  const { fake, dispose } = await sharedBackendPool();
  try {
    const result = await probePoolerMode(fake);
    assert.equal(result.safe, false);
    assert.match(result.reason, /backend|pooler/i);
  } finally {
    await dispose();
  }
});

test('assertPoolerModeSafe refuses a shared-backend pool in session mode', async () => {
  const previous = process.env.DB_TENANT_SCOPE;
  delete process.env.DB_TENANT_SCOPE;
  const { fake, dispose } = await sharedBackendPool();
  try {
    await assert.rejects(() => assertPoolerModeSafe(fake), /DB_TENANT_SCOPE|pooler/i);
  } finally {
    await dispose();
    if (previous === undefined) delete process.env.DB_TENANT_SCOPE;
    else process.env.DB_TENANT_SCOPE = previous;
  }
});

test('assertPoolerModeSafe allows a shared-backend pool once DB_TENANT_SCOPE=transaction', async () => {
  const previous = process.env.DB_TENANT_SCOPE;
  process.env.DB_TENANT_SCOPE = 'transaction';
  const { fake, dispose } = await sharedBackendPool();
  try {
    // Transaction-scoped tenancy travels with the transaction, so a shared
    // backend between transactions is no longer a leak.
    const result = await assertPoolerModeSafe(fake);
    assert.equal(result.safe, true);
  } finally {
    await dispose();
    if (previous === undefined) delete process.env.DB_TENANT_SCOPE;
    else process.env.DB_TENANT_SCOPE = previous;
  }
});

test('an unrecognised DB_TENANT_SCOPE is rejected rather than silently treated as session', async () => {
  const previous = process.env.DB_TENANT_SCOPE;
  process.env.DB_TENANT_SCOPE = 'trasnaction';
  try {
    await assert.rejects(() => assertPoolerModeSafe(pool), /DB_TENANT_SCOPE/);
  } finally {
    if (previous === undefined) delete process.env.DB_TENANT_SCOPE;
    else process.env.DB_TENANT_SCOPE = previous;
  }
});
