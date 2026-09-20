// Capacity holds, wired into the portal booking path.
//
// What the hold adds over the diary's existing overlap check: that check is a
// SELECT, so two requests can both pass it and both insert. The partial unique
// index from migration 018 is what makes exactly one of them win. Phase 2
// proved the index itself under real concurrency
// (tests/workshop-schema.test.js); these tests prove the booking path is
// actually wired to it, and that a hold stops consuming capacity when the
// booking it belongs to goes away.
//
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { deleteTestShop } from './helpers/testShop.js';

import { portalSignup, portalRequest } from './helpers/portal.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';

const WEDNESDAY = '2026-10-14';
let server;

before(async () => {
  server = await startLiveServer();
});

after(async () => {
  if (server) await server.stop();
  await pool.end();
});

// One shop with both a staff owner and a portal customer. staffSignup creates
// the shop itself - it cannot be pointed at an existing one - so the shop has
// to start here rather than at createTestShop, or the staff cookie belongs to a
// different tenant and every staff call 404s.
async function bookableShop() {
  const { cookie: staffCookie, shop } = await staffSignup(server.baseUrl);
  // seedMechanic, not seedBookableShop: createShop already seeds
  // workshop_settings, and seeding it twice trips its unique index on shop_id.
  const mechanicId = await seedMechanic(shop.id, { name: 'Holds Mechanic' });
  const signup = await portalSignup(server.baseUrl, shop.slug, {});
  return { shop, mechanicId, cookie: signup.cookie, staffCookie };
}

const book = (cookie, slug, mechanicId, startTime) =>
  portalRequest(server.baseUrl, cookie, `/api/portal/${slug}/bookings`, {
    method: 'POST',
    body: {
      mechanicId,
      jobDate: WEDNESDAY,
      startTime,
      jobType: 'service',
      description: 'Test booking',
      newBike: { make: 'Test', model: 'Bike' },
    },
  });

const holdsFor = (shopId, jobId) =>
  runWithShop(shopId, () =>
    prepare('SELECT * FROM workshop_capacity_holds WHERE workshop_job_id = ?').all(jobId));

test('a booking takes a live hold on the slot it booked', async () => {
  const { shop, mechanicId, cookie } = await bookableShop();
  try {
    const res = await book(cookie, shop.slug, mechanicId, '10:00');
    assert.equal(res.status, 201, JSON.stringify(res.body));

    const holds = await holdsFor(shop.id, res.body.id);
    assert.equal(holds.length, 1, 'the booking must take exactly one hold');
    assert.equal(holds[0].state, 'held');
    assert.equal(holds[0].job_date, WEDNESDAY);
    assert.equal(holds[0].start_time, '10:00');
    assert.equal(holds[0].mechanic_id, mechanicId, 'the hold must key on the same slot the index does');
    assert.ok(holds[0].minutes > 0, 'a hold reserves effort, not just a time');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a slot already held by an in-flight request is refused with 409', async () => {
  // A hold with no job behind it is what a competing request looks like between
  // taking its hold and committing its booking. The diary's overlap check sees
  // no job and lets the booking through; the index is what stops it.
  const { shop, mechanicId, cookie } = await bookableShop();
  try {
    await runWithShop(shop.id, () =>
      prepare(`INSERT INTO workshop_capacity_holds (job_date, start_time, mechanic_id, minutes)
               VALUES (?, ?, ?, 60)`).run(WEDNESDAY, '11:00', mechanicId));

    const res = await book(cookie, shop.slug, mechanicId, '11:00');
    assert.equal(res.status, 409, `expected the held slot to be refused: ${JSON.stringify(res.body)}`);
    assert.match(res.body.error, /no longer available/);

    const jobs = await runWithShop(shop.id, () =>
      prepare('SELECT COUNT(*)::int AS n FROM workshop_jobs WHERE job_date = ?').get(WEDNESDAY));
    assert.equal(jobs.n, 0, 'a refused booking must not leave a job behind');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('cancelling a booking releases its hold, and the slot frees up', async () => {
  const { shop, mechanicId, cookie, staffCookie } = await bookableShop();
  try {
    const booked = await book(cookie, shop.slug, mechanicId, '12:00');
    assert.equal(booked.status, 201, JSON.stringify(booked.body));

    const before = await holdsFor(shop.id, booked.body.id);
    assert.equal(before[0].state, 'held');

    await runWithShop(shop.id, async () => {
      const job = await prepare('SELECT version FROM workshop_jobs WHERE id = ?').get(booked.body.id);
      assert.ok(job, 'the booking must exist');
    });

    const cancelled = await staffRequest(
      server.baseUrl, staffCookie, `/api/workshop-jobs/${booked.body.id}/cancel`, { method: 'POST', body: { version: 1 } }
    );
    assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));

    const after = await holdsFor(shop.id, booked.body.id);
    assert.equal(after[0].state, 'released', 'a cancelled booking must stop consuming capacity immediately');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('deleting a job removes its hold rather than stranding it', async () => {
  // The hold carries a foreign key to the job, so a delete that ignored it
  // failed outright - and a hold left behind would go on consuming a slot for a
  // booking that no longer exists. Covered incidentally by the existing delete
  // test; asserted here on purpose.
  const { shop, mechanicId, cookie, staffCookie } = await bookableShop();
  try {
    const booked = await book(cookie, shop.slug, mechanicId, '14:00');
    assert.equal(booked.status, 201, JSON.stringify(booked.body));
    assert.equal((await holdsFor(shop.id, booked.body.id)).length, 1);

    const deleted = await staffRequest(
      server.baseUrl, staffCookie, `/api/workshop-jobs/${booked.body.id}`, { method: 'DELETE' }
    );
    assert.equal(deleted.status, 200, JSON.stringify(deleted.body));
    assert.equal((await holdsFor(shop.id, booked.body.id)).length, 0, 'the hold must go with the job');

    // And the slot is bookable again.
    const again = await book(cookie, shop.slug, mechanicId, '14:00');
    assert.equal(again.status, 201, JSON.stringify(again.body));
  } finally {
    await deleteTestShop(shop.id);
  }
});
