// Customer booking portal - what a signed-in customer can see about their
// own jobs.
//
// Covers D11 in docs/superpowers/plans/2026-08-31-master-implementation-plan.md
// (task DS-7): the portal reuses serializeWorkshopJob(), the same serializer
// the staff API uses, so it hands the shop's internal order record back to
// the customer.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import { portalSignup, portalRequest } from './helpers/portal.js';
import { seedWorkshopJob, customerIdForLogin, seedBookableShop } from './helpers/workshopFixtures.js';
import { setOpeningDays } from './helpers/staff.js';

let server;

before(async () => {
  server = await startLiveServer();
});

after(async () => {
  if (server) await server.stop();
  await pool.end();
});

test('the portal does not return the shop internal order behind a job', async () => {
  const shop = await createTestShop();
  try {
    const { cookie, loginId } = await portalSignup(server.baseUrl, shop.slug);
    const customerId = await customerIdForLogin(shop.id, loginId);
    await seedWorkshopJob({ shopId: shop.id, customerId, orderTotal: 249.99 });

    const { status, body } = await portalRequest(
      server.baseUrl,
      cookie,
      `/api/portal/${shop.slug}/bookings`
    );

    assert.equal(status, 200);
    assert.equal(body.length, 1);
    const [booking] = body;
    assert.ok(!('orderId' in booking), 'portal leaked orderId');
    assert.ok(!('orderStatus' in booking), 'portal leaked orderStatus');
    assert.ok(!('orderTotal' in booking), 'portal leaked orderTotal');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('the portal does not return staff notes on a job', async () => {
  const shop = await createTestShop();
  try {
    const { cookie, loginId } = await portalSignup(server.baseUrl, shop.slug);
    const customerId = await customerIdForLogin(shop.id, loginId);
    await seedWorkshopJob({
      shopId: shop.id,
      customerId,
      notes: 'Frame is cracked - do not tell them until we have quoted the welder',
    });

    const { status, body } = await portalRequest(
      server.baseUrl,
      cookie,
      `/api/portal/${shop.slug}/bookings`
    );

    assert.equal(status, 200);
    assert.equal(body.length, 1);
    assert.ok(!('notes' in body[0]), 'portal leaked staff notes');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('creating a booking does not return the shop internal order either', async () => {
  const shop = await createTestShop();
  try {
    const { cookie } = await portalSignup(server.baseUrl, shop.slug);
    const { mechanicId } = await seedBookableShop(shop.id);

    const { status, body } = await portalRequest(
      server.baseUrl,
      cookie,
      `/api/portal/${shop.slug}/bookings`,
      {
        method: 'POST',
        body: {
          jobDate: '2026-09-07', // a Monday, inside the default opening days
          startTime: '10:00',
          jobType: 'quick',
          description: 'Front brake rubbing',
          mechanicId,
          newBike: { make: 'Test', model: 'Bike' },
        },
      }
    );

    assert.equal(status, 201, `booking failed: ${JSON.stringify(body)}`);
    assert.ok(!('orderId' in body), 'booking response leaked orderId');
    assert.ok(!('orderTotal' in body), 'booking response leaked orderTotal');
    assert.ok(!('notes' in body), 'booking response leaked notes');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a customer cannot book on a day the shop is closed', async () => {
  const shop = await createTestShop();
  try {
    const { cookie } = await portalSignup(server.baseUrl, shop.slug);
    const { mechanicId } = await seedBookableShop(shop.id);
    await setOpeningDays(shop.id, [1, 2, 3, 4, 5]); // Monday to Friday

    const { status } = await portalRequest(
      server.baseUrl,
      cookie,
      `/api/portal/${shop.slug}/bookings`,
      {
        method: 'POST',
        body: {
          jobDate: '2026-09-06', // a Sunday
          startTime: '10:00',
          jobType: 'quick',
          description: 'Sunday puncture',
          mechanicId,
          newBike: { make: 'Test', model: 'Bike' },
        },
      }
    );

    assert.equal(status, 400, 'the portal accepted a booking on a closed day');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a customer cannot book a mechanic on their day off', async () => {
  const shop = await createTestShop();
  try {
    const { cookie } = await portalSignup(server.baseUrl, shop.slug);
    const { mechanicId } = await seedBookableShop(shop.id, { workingDays: [2, 3, 4, 5] });

    const { status } = await portalRequest(
      server.baseUrl,
      cookie,
      `/api/portal/${shop.slug}/bookings`,
      {
        method: 'POST',
        body: {
          jobDate: '2026-09-07', // a Monday - shop open, this mechanic off
          startTime: '10:00',
          jobType: 'quick',
          description: 'Monday puncture',
          mechanicId,
          newBike: { make: 'Test', model: 'Bike' },
        },
      }
    );

    assert.equal(status, 400, "the portal accepted a booking on the mechanic's day off");
  } finally {
    await deleteTestShop(shop.id);
  }
});
