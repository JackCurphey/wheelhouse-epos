// The availability endpoint - what the booking page calls to work out which
// slots it can offer.
//
// Task DS-9. This route is public: no login, no session. Under the booking
// wedge it is the most customer-visible logic in the product, and the one
// piece a stranger can call freely, so both what it computes and what it
// discloses are worth pinning down.
//
// The shop's defaults are 09:00-18:00 (540 minutes) with a 120-minute
// "day is full" threshold - see the workshop_settings column defaults.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import { seedWorkshopJob, seedBookableShop } from './helpers/workshopFixtures.js';
import { seedMechanic } from './helpers/staff.js';

const MONDAY = '2026-09-07';
const TUESDAY = '2026-09-08';

let server;

before(async () => {
  server = await startLiveServer();
});

after(async () => {
  if (server) await server.stop();
  await pool.end();
});

function availability(slug, query) {
  return fetch(`${server.baseUrl}/api/portal/${slug}/availability?${new URLSearchParams(query)}`)
    .then(async (res) => ({ status: res.status, body: await res.json() }));
}

test('availability returns busy blocks inside the range and leaves out the rest', async () => {
  const shop = await createTestShop();
  try {
    const { mechanicId } = await seedBookableShop(shop.id);
    await seedWorkshopJob({ shopId: shop.id, customerId: null, mechanicId, jobDate: MONDAY, startTime: '10:00', endTime: '11:00' });
    await seedWorkshopJob({ shopId: shop.id, customerId: null, mechanicId, jobDate: '2026-09-21', startTime: '10:00', endTime: '11:00' });

    const { status, body } = await availability(shop.slug, { start: MONDAY, end: TUESDAY });

    assert.equal(status, 200);
    assert.equal(body.busy.length, 1, 'a job outside the range was included');
    assert.equal(body.busy[0].jobDate, MONDAY);
    assert.equal(body.busy[0].startTime, '10:00');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('availability narrows to one mechanic when asked', async () => {
  const shop = await createTestShop();
  try {
    const { mechanicId: alice } = await seedBookableShop(shop.id, { mechanicName: 'Alice' });
    const bob = await seedMechanic(shop.id, { name: 'Bob' });
    await seedWorkshopJob({ shopId: shop.id, customerId: null, mechanicId: alice, jobDate: MONDAY, startTime: '10:00', endTime: '11:00' });
    await seedWorkshopJob({ shopId: shop.id, customerId: null, mechanicId: bob, jobDate: MONDAY, startTime: '14:00', endTime: '15:00' });

    const { body } = await availability(shop.slug, { start: MONDAY, end: MONDAY, mechanicId: String(bob) });

    assert.equal(body.busy.length, 1, "another mechanic's jobs came back");
    assert.equal(body.busy[0].mechanicId, bob);
    assert.equal(body.busy[0].startTime, '14:00');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('availability rejects a malformed date range', async () => {
  const shop = await createTestShop();
  try {
    await seedBookableShop(shop.id);
    const { status } = await availability(shop.slug, { start: 'next tuesday', end: MONDAY });
    assert.equal(status, 400);
  } finally {
    await deleteTestShop(shop.id);
  }
});

// The one worth having. Two jobs that overlap each other occupy the union of
// their windows, not the sum of their lengths. Summing would double-count the
// shared hours and report a day as full when half of it is free.
//
// 10:00-14:00 and 12:00-16:00 against a 09:00-18:00 day:
//   merged  -> busy 10:00-16:00 = 360 min, free 180, above the 120 threshold
//   summed  -> busy 240 + 240   = 480 min, free  60, below it - wrongly full
test('a day with overlapping jobs is not counted as full twice over', async () => {
  const shop = await createTestShop();
  try {
    const { mechanicId } = await seedBookableShop(shop.id);
    await seedWorkshopJob({ shopId: shop.id, customerId: null, mechanicId, jobDate: MONDAY, startTime: '10:00', endTime: '14:00' });
    await seedWorkshopJob({ shopId: shop.id, customerId: null, mechanicId, jobDate: MONDAY, startTime: '12:00', endTime: '16:00' });

    const { body } = await availability(shop.slug, { start: MONDAY, end: MONDAY });

    assert.deepEqual(body.fullDays, [], 'overlapping jobs were counted twice and closed the day');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a genuinely full day is reported as full', async () => {
  const shop = await createTestShop();
  try {
    const { mechanicId } = await seedBookableShop(shop.id);
    // 09:00-17:30 leaves 30 free minutes against a 120-minute threshold.
    await seedWorkshopJob({ shopId: shop.id, customerId: null, mechanicId, jobDate: MONDAY, startTime: '09:00', endTime: '17:30' });

    const { body } = await availability(shop.slug, { start: MONDAY, end: MONDAY });

    assert.equal(body.fullDays.length, 1);
    assert.equal(body.fullDays[0].mechanicId, mechanicId);
    assert.equal(body.fullDays[0].jobDate, MONDAY);
  } finally {
    await deleteTestShop(shop.id);
  }
});

// Anyone can call this route without signing in, so it must never grow a
// field that says who the booking is for or what it is about.
test('availability discloses nothing beyond a mechanic, a date and a window', async () => {
  const shop = await createTestShop();
  try {
    const { mechanicId } = await seedBookableShop(shop.id);
    await seedWorkshopJob({
      shopId: shop.id, customerId: null, mechanicId, jobDate: MONDAY,
      startTime: '10:00', endTime: '11:00',
      title: 'Confidential rebuild', notes: 'Customer is a nightmare',
    });

    const { body } = await availability(shop.slug, { start: MONDAY, end: MONDAY });

    assert.deepEqual(
      Object.keys(body.busy[0]).sort(),
      ['endTime', 'jobDate', 'mechanicId', 'startTime']
    );
  } finally {
    await deleteTestShop(shop.id);
  }
});
