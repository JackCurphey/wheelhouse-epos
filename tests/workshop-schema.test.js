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

// A quote for a job, using the column defaults for shop_id and revision.
async function insertQuote(shopId, jobId, overrides = {}) {
  const cols = { workshop_job_id: jobId, ...overrides };
  const names = Object.keys(cols);
  const placeholders = names.map(() => '?').join(', ');
  return runWithShop(shopId, () =>
    prepare(`INSERT INTO workshop_quotes (${names.join(', ')}) VALUES (${placeholders}) RETURNING *`)
      .get(...Object.values(cols)));
}

test('a quote belongs to a job and starts as a draft revision 1', async () => {
  const shop = await createTestShop();
  try {
    const job = await insertJob(shop.id);
    const quote = await insertQuote(shop.id, job.id);
    assert.equal(quote.revision, 1);
    assert.equal(quote.state, 'draft');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('one job cannot have two quotes at the same revision', async () => {
  // Revision is what a customer's approval link is bound to. Two rows claiming
  // revision 2 would make "is this link current?" unanswerable.
  const shop = await createTestShop();
  try {
    const job = await insertJob(shop.id);
    await insertQuote(shop.id, job.id, { revision: 2 });
    await assert.rejects(
      insertQuote(shop.id, job.id, { revision: 2 }),
      /duplicate key value|unique constraint/,
    );
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('the database refuses a quote state no machine declares', async () => {
  const shop = await createTestShop();
  try {
    const job = await insertJob(shop.id);
    await assert.rejects(
      insertQuote(shop.id, job.id, { state: 'half_approved' }),
      /violates check constraint/,
    );
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a line records its own decision, so some can be approved and others not', async () => {
  const shop = await createTestShop();
  try {
    const job = await insertJob(shop.id);
    const quote = await insertQuote(shop.id, job.id);
    const line = (description, amount, decision) => runWithShop(shop.id, () =>
      prepare(`INSERT INTO workshop_quote_lines
                 (workshop_quote_id, kind, description, quantity, unit_amount, decision)
               VALUES (?, 'labour', ?, 1, ?, ?) RETURNING *`)
        .get(quote.id, description, amount, decision));

    const approved = await line('Standard service', '65.00', 'approved');
    const declined = await line('Replace gear cable', '12.00', 'declined');
    assert.equal(approved.decision, 'approved');
    assert.equal(declined.decision, 'declined');
    // NUMERIC comes back as a JS number, not a string: server/db.js:31-38 sets
    // a type parser deliberately, so every read site gets a number.
    assert.equal(approved.unit_amount, 65);
    assert.equal(declined.unit_amount, 12);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a line decision outside the three allowed values is refused', async () => {
  const shop = await createTestShop();
  try {
    const job = await insertJob(shop.id);
    const quote = await insertQuote(shop.id, job.id);
    await assert.rejects(
      runWithShop(shop.id, () =>
        prepare(`INSERT INTO workshop_quote_lines
                   (workshop_quote_id, kind, description, quantity, unit_amount, decision)
                 VALUES (?, 'labour', 'x', 1, '1.00', 'maybe')`).run(quote.id)),
      /violates check constraint/,
    );
  } finally {
    await deleteTestShop(shop.id);
  }
});

test("one shop cannot read another shop's quotes", async () => {
  // Tenant isolation here is enforced by Postgres, not application code, so it
  // has to be tested through a real shop context rather than by trusting a
  // WHERE clause. runWithShop sets app.current_shop_id, which is what the RLS
  // policy filters on.
  const a = await createTestShop();
  const b = await createTestShop();
  try {
    const job = await insertJob(a.id);
    await insertQuote(a.id, job.id);

    const seenByOwner = await runWithShop(a.id, () =>
      prepare('SELECT COUNT(*)::int AS n FROM workshop_quotes').get());
    assert.equal(seenByOwner.n, 1, 'the owning shop should see its own quote');

    const seenByOther = await runWithShop(b.id, () =>
      prepare('SELECT COUNT(*)::int AS n FROM workshop_quotes').get());
    assert.equal(seenByOther.n, 0, 'another shop must see nothing');
  } finally {
    await deleteTestShop(a.id);
    await deleteTestShop(b.id);
  }
});

test('two concurrent requests for the same slot produce exactly one winner', async () => {
  // The acceptance scenario the workshop plan names first. settleRace in
  // state-machines.js is the model's answer; this proves the database gives the
  // same answer under real concurrency, which is where application-level
  // check-then-insert loses.
  const shop = await createTestShop();
  try {
    const hold = () => runWithShop(shop.id, () =>
      prepare(`INSERT INTO workshop_capacity_holds (job_date, start_time, mechanic_id, minutes)
               VALUES ('2026-09-17', '09:30', NULL, 60)`).run());
    const results = await Promise.allSettled([hold(), hold()]);
    const won = results.filter(r => r.status === 'fulfilled');
    const lost = results.filter(r => r.status === 'rejected');
    assert.equal(won.length, 1, 'exactly one hold should be taken');
    assert.equal(lost.length, 1);
    assert.match(String(lost[0].reason), /duplicate key value|unique constraint/);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a released hold frees the slot for someone else', async () => {
  // Expired and released holds must stop consuming capacity immediately, or
  // the diary promises room the shop has not got.
  const shop = await createTestShop();
  try {
    const first = await runWithShop(shop.id, () =>
      prepare(`INSERT INTO workshop_capacity_holds (job_date, start_time, mechanic_id, minutes)
               VALUES ('2026-09-18', '10:00', NULL, 60) RETURNING *`).get());
    await runWithShop(shop.id, () =>
      prepare('UPDATE workshop_capacity_holds SET state = ? WHERE id = ?').run('released', first.id));
    const second = await runWithShop(shop.id, () =>
      prepare(`INSERT INTO workshop_capacity_holds (job_date, start_time, mechanic_id, minutes)
               VALUES ('2026-09-18', '10:00', NULL, 60) RETURNING *`).get());
    assert.equal(second.state, 'held');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('the database refuses a hold state no machine declares', async () => {
  const shop = await createTestShop();
  try {
    await assert.rejects(
      runWithShop(shop.id, () =>
        prepare(`INSERT INTO workshop_capacity_holds (job_date, start_time, minutes, state)
                 VALUES ('2026-09-19', '11:00', 60, 'pencilled_in')`).run()),
      /violates check constraint/,
    );
  } finally {
    await deleteTestShop(shop.id);
  }
});
