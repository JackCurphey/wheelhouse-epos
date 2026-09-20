// applyEvent is the only path a job's state changes through, so these tests are
// about its two guards refusing for different reasons: the machine refuses a
// move the product does not allow, and the version refuses a move that was
// legal when the caller read the job and is not legal now. A caller has to be
// able to tell those apart - the first is a bug or a stale screen, the second
// is two people at two desks, and only the second is fixed by reloading.
//
// No live server: applyEvent is called directly inside runWithShop, so these
// stay about the module rather than about HTTP.
//
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import { applyEvent, eventsToReach, driveTo } from '../server/workshop/transitions.js';
import { work, custody } from '../server/workshop/state-machines.js';

after(async () => {
  await pool.end();
});

async function seedJob(shopId, overrides = {}) {
  const cols = { title: 'Transition test', job_date: '2026-09-17', ...overrides };
  const names = Object.keys(cols);
  return runWithShop(shopId, () =>
    prepare(
      `INSERT INTO workshop_jobs (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')}) RETURNING *`
    ).get(...Object.values(cols)));
}

test('a legal event moves the state and bumps the version', async () => {
  const shop = await createTestShop();
  try {
    const job = await seedJob(shop.id);
    await runWithShop(shop.id, async () => {
      const result = await applyEvent({ jobId: job.id, machine: work, event: 'start', expectedVersion: 1 });
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.job.work_state, 'in_progress');
      assert.equal(result.job.version, 2);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('an illegal event is refused and changes nothing', async () => {
  const shop = await createTestShop();
  try {
    const job = await seedJob(shop.id);
    await runWithShop(shop.id, async () => {
      // not_started has no 'finish'; only in_progress does.
      const result = await applyEvent({ jobId: job.id, machine: work, event: 'finish', expectedVersion: 1 });
      assert.equal(result.ok, false);
      assert.equal(result.code, 'illegal');
      assert.match(result.message, /cannot finish a job that is not_started/);
      // And it says what you CAN do, because that is always the next question.
      assert.match(result.message, /start/);

      const row = await prepare('SELECT work_state, version FROM workshop_jobs WHERE id = ?').get(job.id);
      assert.equal(row.work_state, 'not_started', 'a refused event must not write');
      assert.equal(row.version, 1, 'a refused event must not bump the version');
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a stale version loses the race', async () => {
  const shop = await createTestShop();
  try {
    const job = await seedJob(shop.id);
    await runWithShop(shop.id, async () => {
      const first = await applyEvent({ jobId: job.id, machine: custody, event: 'book_in', expectedVersion: 1 });
      assert.equal(first.ok, true);
      // The second caller still holds version 1 - it read the job before the
      // first caller wrote. This is the diary-open-in-two-tabs case.
      const second = await applyEvent({ jobId: job.id, machine: work, event: 'start', expectedVersion: 1 });
      assert.equal(second.ok, false);
      assert.equal(second.code, 'stale');
      assert.match(second.message, /changed while you were looking at it/);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('another shop cannot move this job', async () => {
  const shop = await createTestShop();
  const other = await createTestShop();
  try {
    const job = await seedJob(shop.id);
    await runWithShop(other.id, async () => {
      const result = await applyEvent({ jobId: job.id, machine: work, event: 'start', expectedVersion: 1 });
      assert.equal(result.ok, false);
      assert.equal(result.code, 'not_found', 'RLS must hide it, not refuse it - a 404, never a 403');
    });
    // And the job is untouched back in its own shop.
    await runWithShop(shop.id, async () => {
      const row = await prepare('SELECT work_state FROM workshop_jobs WHERE id = ?').get(job.id);
      assert.equal(row.work_state, 'not_started');
    });
  } finally {
    await deleteTestShop(shop.id);
    await deleteTestShop(other.id);
  }
});

test('eventsToReach finds the shortest declared route, and only declared ones', () => {
  assert.deepEqual(eventsToReach(work, 'not_started', 'complete'), ['start', 'finish']);
  assert.deepEqual(eventsToReach(work, 'on_hold', 'complete'), ['resume', 'finish']);
  assert.deepEqual(eventsToReach(work, 'waiting_parts', 'complete'), ['parts_arrived', 'finish']);
  assert.deepEqual(eventsToReach(work, 'complete', 'complete'), [], 'already there is an empty path');
  // custody has no route from collected to expected - a bike that has left
  // cannot become one that never arrived, and the machine says so.
  assert.equal(eventsToReach(custody, 'collected', 'expected'), null);
});

test('driveTo walks the path and records every step', async () => {
  const shop = await createTestShop();
  try {
    const job = await seedJob(shop.id);
    await runWithShop(shop.id, async () => {
      const result = await driveTo({ jobId: job.id, machine: work, target: 'complete', expectedVersion: 1 });
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.job.work_state, 'complete');
      // Two events, so two version bumps. One would mean the intermediate state
      // was skipped and 'complete' effectively written straight in.
      assert.equal(result.job.version, 3);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('driveTo reports an unreachable target rather than forcing it', async () => {
  const shop = await createTestShop();
  try {
    const job = await seedJob(shop.id, { custody_state: 'collected' });
    await runWithShop(shop.id, async () => {
      const result = await driveTo({ jobId: job.id, machine: custody, target: 'expected', expectedVersion: 1 });
      assert.equal(result.ok, false);
      assert.equal(result.code, 'unreachable');
      const row = await prepare('SELECT custody_state FROM workshop_jobs WHERE id = ?').get(job.id);
      assert.equal(row.custody_state, 'collected', 'an unreachable target must change nothing');
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});
