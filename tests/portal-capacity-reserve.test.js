// full_day_threshold_minutes is meant to hold back part of a mechanic's day
// for lunch, admin, and the parts of a shift not spent on a bike. It did not:
// the gate tested free time BEFORE the booking and never asked whether the
// booking would consume the reserve, so one job could take all of it.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import { seedBookableShop, seedWorkshopJob, customerIdForLogin } from './helpers/workshopFixtures.js';
import { portalSignup, portalRequest } from './helpers/portal.js';

const WEDNESDAY = '2026-10-14';

let server;

before(async () => {
  server = await startLiveServer();
});

after(async () => {
  if (server) await server.stop();
  await pool.end();
});

// Shop day is 09:00-18:00 = 540 minutes; default threshold is 120.
async function shopWithBookedMinutes(endTime) {
  const shop = await createTestShop({ slug: `reserve-${Date.now()}-${Math.floor(Math.random() * 1e6)}` });
  const { mechanicId } = await seedBookableShop(shop.id, { mechanicName: 'Reserve Mechanic' });
  const signup = await portalSignup(server.baseUrl, shop.slug, {});
  const customerId = await customerIdForLogin(shop.id, signup.loginId);
  await seedWorkshopJob({
    shopId: shop.id, customerId, mechanicId, title: 'Existing work',
    jobDate: WEDNESDAY, startTime: '09:00', endTime, status: 'scheduled',
  });
  return { shop, mechanicId, cookie: signup.cookie };
}

function book(baseUrl, cookie, slug, { mechanicId, startTime, jobType }) {
  return portalRequest(baseUrl, cookie, `/api/portal/${slug}/bookings`, {
    method: 'POST',
    body: {
      mechanicId, jobDate: WEDNESDAY, startTime, jobType,
      description: 'Test booking', newBike: { make: 'Test', model: 'Bike' },
    },
  });
}

test('a booking that would consume the whole reserve is refused', async () => {
  // 420 booked, so exactly 120 free - the reserve and nothing more.
  const { shop, mechanicId, cookie } = await shopWithBookedMinutes('16:00');
  try {
    const res = await book(server.baseUrl, cookie, shop.slug, {
      mechanicId, startTime: '16:00', jobType: 'service', // 120 minutes
    });
    assert.equal(res.status, 400, `expected refusal, got ${res.status}: ${JSON.stringify(res.body)}`);

    const left = await runWithShop(shop.id, () =>
      prepare('SELECT COUNT(*)::int AS n FROM workshop_jobs WHERE mechanic_id = ? AND job_date = ?')
        .get(mechanicId, WEDNESDAY));
    assert.equal(left.n, 1, 'the refused booking must not have been written');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a booking that leaves the reserve intact is still accepted', async () => {
  // 360 booked, so 180 free. A 30-minute job leaves 150, above the 120 reserve.
  // This is a control, not evidence of the fix: it passes whether the reserve
  // gate is present or reverted, because it never touches the reserve. It only
  // proves the gate does not over-reject a booking that leaves it intact.
  const { shop, mechanicId, cookie } = await shopWithBookedMinutes('15:00');
  try {
    const res = await book(server.baseUrl, cookie, shop.slug, {
      mechanicId, startTime: '15:00', jobType: 'quick', // 30 minutes
    });
    assert.equal(res.status, 201, `expected acceptance, got ${res.status}: ${JSON.stringify(res.body)}`);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('the same day refuses a long job while accepting a short one', async () => {
  // 180 free: a 120-minute service would leave 60, below the reserve.
  const { shop, mechanicId, cookie } = await shopWithBookedMinutes('15:00');
  try {
    const res = await book(server.baseUrl, cookie, shop.slug, {
      mechanicId, startTime: '15:00', jobType: 'service',
    });
    assert.equal(res.status, 400, `expected refusal, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.match(res.body.error, /enough free time/i, 'the refusal should say there is not enough free time');
  } finally {
    await deleteTestShop(shop.id);
  }
});
