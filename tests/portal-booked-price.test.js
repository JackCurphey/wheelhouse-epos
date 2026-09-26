// The booked service and its price reach the customer after booking, only
// when the shop shows prices online.
// Spec: docs/superpowers/specs/2026-09-25-book-a-booked-price-design.md
// Spec (several services): docs/superpowers/specs/2026-09-26-book-server-7-multiple-services-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup, portalRequest } from './helpers/portal.js';
import { jsonRequest } from './helpers/http.js';
import { deleteTestShop } from './helpers/testShop.js';
import { futureDate } from './helpers/workshopFixtures.js';
import { BOOKING_CONTACT } from './helpers/bookable.js';

let server;
let owner;
let sam;
let customer;
let serviceId;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
  serviceId = await runWithShop(owner.shop.id, async () => (await prepare(
    "INSERT INTO workshop_services (name, price, minutes, bookable_online, active, updated_at) VALUES ('Priced service', 65.50, 60, 1, 1, now())"
  ).run()).lastInsertRowid);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

let day = 0;
const nextDate = () => {
  const n = day++;
  const d = new Date(`${futureDate(1 + (n % 5))}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7 * Math.floor(n / 5));
  return d.toISOString().slice(0, 10);
};

const setShowPrices = async (on) => {
  const res = await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-settings', {
    method: 'PUT', body: { showPricesOnline: on },
  });
  assert.equal(res.body.showPricesOnline, on, JSON.stringify(res.body));
};

// Signed in as customer, so the guest limit is never reached.
const book = async (body = {}) => {
  const res = await portalRequest(server.baseUrl, customer.cookie, `/api/portal/${owner.shop.slug}/bookings`, {
    method: 'POST',
    body: {
      mechanicId: sam, jobDate: nextDate(), startTime: '10:00', description: 'Squeaky brakes',
      newBike: { make: 'Dawes', model: 'Galaxy' }, serviceIds: [serviceId], ...BOOKING_CONTACT, ...body,
    },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
};
const codeOf = (privateLink) => privateLink.split('/').pop();
const read = (code) => jsonRequest(server.baseUrl, null, `/api/portal/${owner.shop.slug}/booking-links/${code}`);

test('prices shown: the booking reply carries the service and its price', async () => {
  await setShowPrices(true);
  const booked = await book();
  assert.equal(booked.services[0].price, 65.5);
  assert.equal(booked.totalPrice, 65.5);
});

test('prices hidden: the booking reply carries the service with no price', async () => {
  await setShowPrices(false);
  const booked = await book();
  assert.equal(booked.services[0].name, 'Priced service');
  assert.equal(booked.services[0].price, null);
  assert.equal(booked.totalPrice, null);
});

test('not sure: the booking reply carries no services and no total even when prices are shown', async () => {
  await setShowPrices(true);
  const booked = await book({ serviceIds: undefined, notSure: true });
  assert.deepEqual(booked.services, []);
  assert.equal(booked.totalPrice, null);
});

test('prices shown: the private link carries the service and its price', async () => {
  await setShowPrices(true);
  const res = await read(codeOf((await book()).privateLink));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.services[0].price, 65.5);
  assert.equal(res.body.totalPrice, 65.5);
});

test('prices hidden: the private link carries the service with no price', async () => {
  await setShowPrices(false);
  const res = await read(codeOf((await book()).privateLink));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.services[0].name, 'Priced service');
  assert.equal(res.body.services[0].price, null);
  assert.equal(res.body.totalPrice, null);
});

test('not sure: the private link carries no services and no total even when prices are shown', async () => {
  await setShowPrices(true);
  const res = await read(codeOf((await book({ serviceIds: undefined, notSure: true })).privateLink));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.services, []);
  assert.equal(res.body.totalPrice, null);
});

test('the setting is read when the link is opened, not when it was booked', async () => {
  await setShowPrices(false);
  const code = codeOf((await book()).privateLink);
  await setShowPrices(true);
  assert.equal((await read(code)).body.services[0].price, 65.5);
});

// Out of scope (spec): the bookings list is unaffected by this change -
// serializePortalBooking deliberately does not carry bookedPrice, services or totalPrice.
test('the bookings list carries no bookedPrice, services or totalPrice, even with prices shown', async () => {
  await setShowPrices(true);
  await book();
  const res = await portalRequest(server.baseUrl, customer.cookie, `/api/portal/${owner.shop.slug}/bookings`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(Array.isArray(res.body) && res.body.length > 0, JSON.stringify(res.body));
  for (const row of res.body) {
    assert.ok(!('bookedPrice' in row), JSON.stringify(row));
    assert.ok(!('services' in row), JSON.stringify(row));
    assert.ok(!('totalPrice' in row), JSON.stringify(row));
  }
});
