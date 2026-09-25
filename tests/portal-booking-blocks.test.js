// A customer cannot book into a block, a closure or past a shorter day's
// close - the server refuses it whatever the page showed.
// Spec: docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md (2a; plan decision 5)
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup, portalRequest } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedWorkshopJob, futureDate } from './helpers/workshopFixtures.js';
import { seedJobTypes, BOOKING_CONTACT } from './helpers/bookable.js';

let server;
let owner;
let sam;
let customer;
let types;
const MONDAY = futureDate(1);

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  types = await seedJobTypes(owner.shop.id);
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
  await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-unavailability', {
    method: 'POST', body: { kind: 'weekly', mechanicId: sam, weekdays: [1], startTime: '13:00', endTime: '13:30', reason: 'Lunch' },
  });
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

const book = (body) => portalRequest(server.baseUrl, customer.cookie, `/api/portal/${owner.shop.slug}/bookings`, {
  method: 'POST',
  body: { mechanicId: sam, jobDate: MONDAY, serviceId: types.repair, description: 'Test booking', newBike: { make: 'Test', model: 'Bike' }, ...BOOKING_CONTACT, ...body },
});

test('a booking that runs into lunch is refused, and the reason is not given', async () => {
  const res = await book({ startTime: '12:30' });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.match(res.body.error, /unavailable/i);
  assert.ok(!/lunch/i.test(res.body.error));
});

test('a booking clear of lunch is accepted', async () => {
  const res = await book({ startTime: '11:00' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
});

test('a booking on a mechanic\'s leave is refused', async () => {
  const tuesday = futureDate(2);
  await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-unavailability', {
    method: 'POST', body: { kind: 'dates', mechanicId: sam, startDate: tuesday, endDate: tuesday, reason: 'Holiday' },
  });
  const res = await book({ jobDate: tuesday, startTime: '10:00' });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.match(res.body.error, /unavailable/i);
});

test('a booking on a shop closure is refused', async () => {
  const wednesday = futureDate(3);
  await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-unavailability', {
    method: 'POST', body: { kind: 'dates', mechanicId: null, startDate: wednesday, endDate: wednesday, reason: 'Stocktake' },
  });
  const res = await book({ jobDate: wednesday, startTime: '10:00' });
  assert.equal(res.status, 400, JSON.stringify(res.body));
});

test('a cancelled job leaves its slot free - a customer can book over it', async () => {
  const thursday = futureDate(4);
  const { jobId } = await seedWorkshopJob({
    shopId: owner.shop.id, customerId: null, mechanicId: sam, jobDate: thursday, startTime: '10:00', endTime: '11:00',
  });
  await runWithShop(owner.shop.id, () => prepare("UPDATE workshop_jobs SET booking_state = 'cancelled' WHERE id = ?").run(jobId));
  const res = await book({ jobDate: thursday, startTime: '10:00' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
});

test('a cancelled job leaves its slot free - staff can also book over it', async () => {
  const friday = futureDate(5);
  const { jobId } = await seedWorkshopJob({
    shopId: owner.shop.id, customerId: null, mechanicId: sam, jobDate: friday, startTime: '10:00', endTime: '11:00',
  });
  await runWithShop(owner.shop.id, () => prepare("UPDATE workshop_jobs SET booking_state = 'cancelled' WHERE id = ?").run(jobId));
  const res = await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-jobs', {
    method: 'POST',
    body: { title: 'Staff over cancelled slot', jobDate: friday, startTime: '10:00', endTime: '11:00', mechanicId: sam },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
});
