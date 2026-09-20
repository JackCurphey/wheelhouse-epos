// The bridge between the old five-value column and the three state columns,
// checked in both directions. readLegacyStatus() says what a legacy value
// MEANT; the generated column says what the new states LOOK like to a reader
// still on the old column. If those two disagree, the old staff diary and the
// customer portal are being told something the state machines do not say.
import '../server/load-env.js';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../server/db.js';
import { LEGACY_STATUS_SQL, JOB_LEGACY_VALUES, readLegacyStatus } from '../server/workshop/legacy-status.mjs';
import { bookingRequest, custody, work } from '../server/workshop/state-machines.js';

after(async () => {
  await pool.end();
});

// Evaluates the committed expression in the real database, so the test is
// checking the SQL Postgres will actually run - not a JavaScript re-statement
// of it, which could agree with the test and disagree with the column.
async function derive({ booking, work: workState }) {
  // Two parameters, not three. custody_state does not appear in the expression
  // at all: the old column never recorded whether the bike left, which is the
  // same gap Phase 1 recorded when readLegacyStatus('complete') returned
  // custody: null. Binding a third parameter Postgres never sees used is an
  // error ("could not determine data type of parameter $2"), and passing one
  // would in any case imply the mapping depends on custody when it does not.
  const sql = LEGACY_STATUS_SQL
    .replaceAll('booking_state', '$1::text')
    .replaceAll('work_state', '$2::text');
  const { rows } = await pool.query(`SELECT ${sql} AS status`, [booking, workState]);
  return rows[0].status;
}

test('every legacy value survives the round trip', async () => {
  for (const value of JOB_LEGACY_VALUES) {
    const facts = readLegacyStatus(value);
    assert.equal(
      await derive(facts),
      value,
      `${value} -> ${JSON.stringify(facts)} -> did not come back as ${value}`
    );
  }
});

test('a cancelled, declined or expired booking reads as complete', async () => {
  for (const booking of ['cancelled', 'declined', 'expired']) {
    assert.equal(
      await derive({ booking, custody: 'expected', work: 'not_started' }),
      'complete',
      `${booking} should read as complete to the old column`
    );
  }
});

test('the expression only ever yields one of the five legacy values', async () => {
  for (const b of bookingRequest.states) {
    for (const c of custody.states) {
      for (const w of work.states) {
        const got = await derive({ booking: b, custody: c, work: w });
        assert.ok(
          JOB_LEGACY_VALUES.includes(got),
          `${b}/${c}/${w} produced ${got}, which is not a legacy value`
        );
      }
    }
  }
});
