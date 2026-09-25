// The booking request: the service it names, the contact and consent it takes,
// the reference it returns.
// Spec: docs/superpowers/specs/2026-09-25-book-server-3-booking-request-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, seedMechanic } from './helpers/staff.js';
import { portalSignup, portalRequest } from './helpers/portal.js';
import { jsonRequest } from './helpers/http.js';
import { deleteTestShop } from './helpers/testShop.js';
import { futureDate } from './helpers/workshopFixtures.js';
import { seedJobTypes, BOOKING_CONTACT } from './helpers/bookable.js';

let server;
let owner;
let other;
let sam;
let types;
let customer;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  other = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  types = await seedJobTypes(owner.shop.id);
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
});

let day = 0;
// A different Monday-to-Friday date per call, so no two tests share a day's capacity.
const nextDate = () => futureDate(1 + (day++ % 5));
const book = (body, who = customer) => portalRequest(server.baseUrl, who.cookie, `/api/portal/${owner.shop.slug}/bookings`, {
  method: 'POST',
  body: {
    mechanicId: sam, jobDate: nextDate(), startTime: '10:00', description: 'Test booking',
    newBike: { make: 'Test', model: 'Bike' }, serviceId: types.repair, ...BOOKING_CONTACT, ...body,
  },
});
const job = (id) => runWithShop(owner.shop.id, () => prepare(
  'SELECT title, planned_minutes, start_time, end_time, terms_accepted_at, reference FROM workshop_jobs WHERE id = ?'
).get(id));

test('a service of this shop books, taking its length and name', async () => {
  const res = await book({ serviceId: types.service });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const j = await job(res.body.id);
  assert.equal(j.planned_minutes, 120);
  assert.equal(j.end_time, '12:00');
  assert.match(j.title, /^Online booking: Test service - Test booking$/);
});

test('not sure books one hour under a generic title', async () => {
  const res = await book({ serviceId: undefined, notSure: true });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const j = await job(res.body.id);
  assert.equal(j.planned_minutes, 60);
  assert.match(j.title, /^Online booking: Not sure - Test booking$/);
});

test('a service from another shop is refused', async () => {
  const foreign = (await seedJobTypes(other.shop.id)).repair;
  const res = await book({ serviceId: foreign });
  assert.equal(res.status, 400, JSON.stringify(res.body));
});

test('a service the shop has not ticked bookable online is refused', async () => {
  const id = await runWithShop(owner.shop.id, async () => (await prepare(
    "INSERT INTO workshop_services (name, price, minutes, bookable_online, active, updated_at) VALUES ('Staff only', 10, 30, 0, 1, now())"
  ).run()).lastInsertRowid);
  const res = await book({ serviceId: id });
  assert.equal(res.status, 400, JSON.stringify(res.body));
});

test('a retired service is refused', async () => {
  const id = await runWithShop(owner.shop.id, async () => (await prepare(
    "INSERT INTO workshop_services (name, price, minutes, bookable_online, active, updated_at) VALUES ('Retired', 10, 30, 1, 0, now())"
  ).run()).lastInsertRowid);
  const res = await book({ serviceId: id });
  assert.equal(res.status, 400, JSON.stringify(res.body));
});

test('the old jobType input no longer books', async () => {
  const res = await book({ serviceId: undefined, jobType: 'repair' });
  assert.equal(res.status, 400, JSON.stringify(res.body));
});
