// tests/workshop-schema.test.js
//
// The database's half of the Phase 1 state model. These tests write real rows
// against real constraints, because a CHECK that was never exercised is a
// comment: the point of generating them is that the database refuses a state
// the machines do not allow, and only an attempted INSERT proves it does.
//
// Everything runs inside runWithShop. Tenant isolation here is enforced by
// Postgres RLS, and workshop_jobs.shop_id defaults to
// current_setting('app.current_shop_id') - so a bare pool.query cannot insert
// at all, it fails with "unrecognized configuration parameter".
//
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';

// A job with only the columns a test cares about. shop_id is left to the
// column default, which reads the tenant setting runWithShop established.
async function insertJob(shopId, overrides = {}) {
  const cols = { title: 'Service', job_date: '2026-09-17', ...overrides };
  const names = Object.keys(cols);
  const placeholders = names.map(() => '?').join(', ');
  return runWithShop(shopId, () =>
    prepare(`INSERT INTO workshop_jobs (${names.join(', ')}) VALUES (${placeholders}) RETURNING *`)
      .get(...Object.values(cols)));
}

test("a new job starts at each machine's initial state", async () => {
  const shop = await createTestShop();
  try {
    const job = await insertJob(shop.id);
    assert.equal(job.booking_state, 'pending');
    assert.equal(job.custody_state, 'expected');
    assert.equal(job.work_state, 'not_started');
    assert.equal(job.version, 1);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('the database refuses a state no machine declares', async () => {
  const shop = await createTestShop();
  try {
    await assert.rejects(
      insertJob(shop.id, { work_state: 'nearly_done' }),
      /violates check constraint/,
    );
    await assert.rejects(
      insertJob(shop.id, { custody_state: 'complete' }),
      /violates check constraint/,
    );
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('the old status column is untouched and still works', async () => {
  // Phase 2 is additive. server.js, public/app.js and the portal all still
  // read and write this, and they must keep working until Phase 3 moves them.
  const shop = await createTestShop();
  try {
    const job = await insertJob(shop.id, { status: 'waiting_parts' });
    assert.equal(job.status, 'waiting_parts');
    const dflt = await insertJob(shop.id);
    assert.equal(dflt.status, 'scheduled');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('two shops can hold the same job reference; one shop cannot', async () => {
  const a = await createTestShop();
  const b = await createTestShop();
  try {
    await insertJob(a.id, { reference: 'WH-1042' });
    await insertJob(b.id, { reference: 'WH-1042' });   // different shop, fine
    await assert.rejects(
      insertJob(a.id, { reference: 'WH-1042' }),
      /duplicate key value|unique constraint/,
    );
  } finally {
    await deleteTestShop(a.id);
    await deleteTestShop(b.id);
  }
});

test('job numbers are allocated per shop, so volume does not leak between them', async () => {
  // A global sequence would tell one shop's customers how many jobs another
  // shop has taken - the reference is printed on the tag and sent in messages.
  // Each shop counts from its own start. shops is a registry table with no RLS
  // (it is what resolves the tenant), so this goes through the pool directly.
  const a = await createTestShop();
  const b = await createTestShop();
  try {
    const next = async shopId => {
      const { rows: [row] } = await pool.query(
        'UPDATE shops SET next_job_number = next_job_number + 1 WHERE id = $1 RETURNING next_job_number - 1 AS allocated',
        [shopId],
      );
      return row.allocated;
    };
    assert.equal(await next(a.id), 1000);
    assert.equal(await next(a.id), 1001);
    assert.equal(await next(b.id), 1000);
  } finally {
    await deleteTestShop(a.id);
    await deleteTestShop(b.id);
  }
});
