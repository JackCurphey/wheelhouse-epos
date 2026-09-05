// GET/PUT /api/workshop-settings had no HTTP coverage at all before this
// file. The settings added here are the per-shop configuration the
// booking-mode work depends on; every one of them has a default chosen so
// that an existing shop behaves exactly as it did before the migration.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;

before(async () => {
  server = await startLiveServer();
});

after(async () => {
  if (server) await server.stop();
  await pool.end();
});

test('a new shop defaults to timed booking, so nothing changes for existing shops', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  try {
    const { status, body } = await staffRequest(server.baseUrl, cookie, '/api/workshop-settings');
    assert.equal(status, 200);
    assert.equal(body.bookingMode, 'timed');
    assert.equal(body.unspecifiedJobMinutes, 60);
    assert.equal(body.timedLeadMinutes, 30);
    assert.equal(body.showPricesOnline, false);
    assert.equal(body.dropoffWindowStart, '09:00');
    assert.equal(body.dropoffWindowEnd, '10:00');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a shop can switch to drop-off mode and set its window', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  try {
    const { status, body } = await staffRequest(server.baseUrl, cookie, '/api/workshop-settings', {
      method: 'PUT',
      body: { bookingMode: 'dropoff', dropoffWindowStart: '08:00', dropoffWindowEnd: '09:30' },
    });
    assert.equal(status, 200);
    assert.equal(body.bookingMode, 'dropoff');
    assert.equal(body.dropoffWindowStart, '08:00');
    assert.equal(body.dropoffWindowEnd, '09:30');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('an unknown booking mode is refused', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  try {
    const { status, body } = await staffRequest(server.baseUrl, cookie, '/api/workshop-settings', {
      method: 'PUT',
      body: { bookingMode: 'whenever' },
    });
    assert.equal(status, 400);
    assert.match(body.error, /timed|drop/i);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a drop-off window that ends before it starts is refused', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  try {
    const { status, body } = await staffRequest(server.baseUrl, cookie, '/api/workshop-settings', {
      method: 'PUT',
      body: { dropoffWindowStart: '10:00', dropoffWindowEnd: '09:00' },
    });
    assert.equal(status, 400);
    assert.match(body.error, /after/i);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('price visibility can be turned on, and comes back as a boolean', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  try {
    const { body } = await staffRequest(server.baseUrl, cookie, '/api/workshop-settings', {
      method: 'PUT',
      body: { showPricesOnline: true },
    });
    assert.equal(body.showPricesOnline, true, 'must be a boolean, not 1 - the client renders it directly');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('the not-sure duration must be a sensible number of minutes', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  try {
    const { status, body } = await staffRequest(server.baseUrl, cookie, '/api/workshop-settings', {
      method: 'PUT',
      body: { unspecifiedJobMinutes: 0 },
    });
    assert.equal(status, 400);
    assert.match(body.error, /minutes/i);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('settings not named in a PUT are left alone', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  try {
    await staffRequest(server.baseUrl, cookie, '/api/workshop-settings', {
      method: 'PUT', body: { bookingMode: 'dropoff' },
    });
    const { body } = await staffRequest(server.baseUrl, cookie, '/api/workshop-settings', {
      method: 'PUT', body: { showPricesOnline: true },
    });
    assert.equal(body.bookingMode, 'dropoff', 'a later PUT wiped an earlier setting');
    assert.equal(body.openingTime, '09:00', 'a later PUT wiped the opening time');
    assert.equal(body.dropoffWindowStart, '09:00', 'a later PUT wiped the drop-off window start');
    assert.equal(body.dropoffWindowEnd, '10:00', 'a later PUT wiped the drop-off window end');
    assert.equal(body.timedLeadMinutes, 30, 'a later PUT wiped the arrival lead time');
    assert.equal(body.unspecifiedJobMinutes, 60, 'a later PUT wiped the not-sure duration');
  } finally {
    await deleteTestShop(shop.id);
  }
});
