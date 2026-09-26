// "Today" is the shop's today, in UK time, wherever the server uses it - shown
// at the one moment UTC and UK dates differ: 00:30 on Wednesday 9 September
// 2026 in the UK is still 23:30 on Tuesday 8 September in UTC.
// Its own file because every test here needs this one server clock, not the
// shared default pin (tests/helpers/liveServer.js).
// Spec: docs/superpowers/specs/2026-09-26-book-server-10-notice-timezone-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup, portalRequest } from './helpers/portal.js';
import { jsonRequest } from './helpers/http.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedWorkshopJob } from './helpers/workshopFixtures.js';
import { seedJobTypes, BOOKING_CONTACT } from './helpers/bookable.js';
import { hashLinkCode } from '../server/booking-link.js';

const UK_TODAY = '2026-09-09';
const UTC_TODAY = '2026-09-08';

let server;
let owner;
let sam;

before(async () => {
  server = await startLiveServer({ env: { WHEELHOUSE_TEST_CLOCK: '2026-09-08T23:30:00Z' } });
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

const as = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);

test('a booking link expires on the shop\'s date, not the UTC date', async () => {
  // Links last 30 days after the booked date: a job on 9 August has 8
  // September as its last day, so it has expired on the UK's 9 September.
  const code = 'a'.repeat(64);
  const { jobId } = await seedWorkshopJob({ shopId: owner.shop.id, customerId: null, mechanicId: sam, jobDate: '2026-08-09' });
  await runWithShop(owner.shop.id, () => prepare('UPDATE workshop_jobs SET link_token_hash = ? WHERE id = ?').run(hashLinkCode(code), jobId));
  const read = () => jsonRequest(server.baseUrl, null, `/api/portal/${owner.shop.slug}/booking-links/${code}`);
  const expired = await read();
  assert.equal(expired.status, 410, JSON.stringify(expired.body));
  await runWithShop(owner.shop.id, () => prepare("UPDATE workshop_jobs SET job_date = '2026-08-10' WHERE id = ?").run(jobId));
  assert.equal((await read()).status, 200, 'a link on its last day has expired');
});

test('a new block reports clashes from the shop\'s today on, not the UTC date', async () => {
  const { jobId: yesterdays } = await seedWorkshopJob({ shopId: owner.shop.id, customerId: null, mechanicId: sam, jobDate: UTC_TODAY, startTime: '12:45', endTime: '13:45' });
  const { jobId: nextWeeks } = await seedWorkshopJob({ shopId: owner.shop.id, customerId: null, mechanicId: sam, jobDate: '2026-09-15', startTime: '12:45', endTime: '13:45' });
  const res = await as('/api/workshop-unavailability', {
    method: 'POST', body: { kind: 'weekly', mechanicId: sam, weekdays: [2], startTime: '13:00', endTime: '13:30', reason: 'Lunch' },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const ids = res.body.clashes.map((c) => c.id);
  assert.ok(ids.includes(nextWeeks));
  assert.ok(!ids.includes(yesterdays), 'a job on a day that has passed in the UK was reported as a clash');
});

test('a mode change cannot start on the shop\'s today', async () => {
  const res = await as('/api/workshop-settings', { method: 'PUT', body: { nextBookingMode: 'dropoff', nextBookingModeFrom: UK_TODAY } });
  assert.equal(res.status, 400, JSON.stringify(res.body));
});

test('a booking for the day that has passed in the UK is refused', async () => {
  const types = await seedJobTypes(owner.shop.id);
  const customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
  const res = await portalRequest(server.baseUrl, customer.cookie, `/api/portal/${owner.shop.slug}/bookings`, {
    method: 'POST',
    body: {
      mechanicId: sam, jobDate: UTC_TODAY, startTime: '10:00', description: 'Test booking',
      newBike: { make: 'Test', model: 'Bike' }, serviceIds: [types.quick], ...BOOKING_CONTACT,
    },
  });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: 'That date has passed - please choose another day.' });
});
