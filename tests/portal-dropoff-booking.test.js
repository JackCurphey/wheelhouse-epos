// Drop-off days: the customer picks a day and a mechanic, never a time. A
// timed day still needs a time. A full drop-off day refuses with capacity.
// Spec: docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md (2b)
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup, portalRequest } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { futureDate } from './helpers/workshopFixtures.js';
import { seedJobTypes, BOOKING_CONTACT } from './helpers/bookable.js';

let server;
let owner;
let sam;
let customer;
let types;
// The same day futureDate() counts from (today + 21, UTC).
const SWITCH = new Date(Date.now() + 86_400_000 * 21).toISOString().slice(0, 10);

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  types = await seedJobTypes(owner.shop.id);
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
  // Drop-off from three weeks out; every futureDate() is on or after it.
  const res = await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-settings', {
    method: 'PUT', body: { nextBookingMode: 'dropoff', nextBookingModeFrom: SWITCH },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

const book = (body) => portalRequest(server.baseUrl, customer.cookie, `/api/portal/${owner.shop.slug}/bookings`, {
  method: 'POST',
  body: { mechanicId: sam, serviceId: types.repair, description: 'Test booking', newBike: { make: 'Test', model: 'Bike' }, ...BOOKING_CONTACT, ...body },
});
const job = (id) => runWithShop(owner.shop.id, () => prepare('SELECT start_time, end_time, planned_minutes FROM workshop_jobs WHERE id = ?').get(id));
const hold = (id) => runWithShop(owner.shop.id, () => prepare(
  "SELECT start_time, minutes FROM workshop_capacity_holds WHERE workshop_job_id = ? AND state = 'held'"
).get(id));

test('a drop-off day books with no time, and records the length', async () => {
  const res = await book({ jobDate: futureDate(1) });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual({ ...(await job(res.body.id)) }, { start_time: '', end_time: '', planned_minutes: 60 });
  assert.deepEqual({ ...(await hold(res.body.id)) }, { start_time: '', minutes: 60 });
});

test('a second drop-off for the same mechanic and day is also accepted', async () => {
  const date = futureDate(2);
  assert.equal((await book({ jobDate: date })).status, 201);
  assert.equal((await book({ jobDate: date })).status, 201);
});

test('a time sent for a drop-off day is refused, as a shop rule', async () => {
  const res = await book({ jobDate: futureDate(3), startTime: '10:00' });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.equal(res.body.code, undefined);
});

test('a day before the switch is still timed and needs a time', async () => {
  const beforeSwitch = new Date(Date.now() + 86_400_000 * 2).toISOString().slice(0, 10);
  const res = await book({ jobDate: beforeSwitch });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /start time is required/i);
});

test('a full drop-off day refuses with capacity', async () => {
  const date = futureDate(4);
  // 540-minute day, no reserve: nine 60-minute drop-offs fill it.
  for (let i = 0; i < 9; i += 1) assert.equal((await book({ jobDate: date })).status, 201);
  const res = await book({ jobDate: date });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.code, 'capacity');
});
