// A customer's requested new time (piece 12) is held while staff decide: other
// bookings are kept out of it, the calendar stops offering it, the job's own
// request never blocks the job, and the hold goes when the job stops being a
// request. Requests are seeded here; Task 6's route makes real ones.
// Spec: docs/superpowers/specs/2026-09-27-book-server-12-change-cancel-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup } from './helpers/portal.js';
import { jsonRequest } from './helpers/http.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedWorkshopJob } from './helpers/workshopFixtures.js';
import { seedJobTypes } from './helpers/bookable.js';
import { tryBooking, liveHolds, seedRequest, dayMaker } from './helpers/linkActions.js';

let server;
let owner;
let sam;
let types;
let customer;
const nextDay = dayMaker();

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  types = await seedJobTypes(owner.shop.id);
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);

// A confirmed job at 10:00-11:00 on one day whose customer asked for 14:00-15:00
// on another, with Sam both times. Seeded rows hold no booking hold of their
// own (seedWorkshopJob inserts directly); the requested one is held.
async function requestingJob() {
  const own = nextDay();
  const wanted = nextDay();
  const { jobId } = await seedWorkshopJob({
    shopId: owner.shop.id, customerId: null, mechanicId: sam, jobDate: own, startTime: '10:00', endTime: '11:00', legacyStatus: 'scheduled',
  });
  await seedRequest(owner.shop.id, jobId, { jobDate: wanted, mechanicId: sam });
  return { jobId, own, wanted };
}

test('a requested time keeps another customer out of it', async () => {
  const { wanted } = await requestingJob();
  // 14:30-15:30 overlaps 14:00-15:00 but starts elsewhere, so only the overlap
  // check can refuse it - the hold index compares start times.
  const res = await tryBooking(server.baseUrl, customer.cookie, owner.shop.slug, {
    mechanicId: sam, jobDate: wanted, startTime: '14:30', serviceIds: [types.repair],
  });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, {
    error: 'That mechanic is already booked over part of that window - please choose another time.',
    code: 'capacity',
  });
});

test('the calendar does not offer a requested time', async () => {
  const { wanted } = await requestingJob();
  const res = await jsonRequest(server.baseUrl, null,
    `/api/portal/${owner.shop.slug}/availability?start=${wanted}&end=${wanted}&minutes=60&mechanicId=${sam}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const times = res.body.days[0].mechanics[0].startTimes;
  assert.ok(times.includes('13:00') && times.includes('15:00'), JSON.stringify(times));
  for (const t of ['13:30', '14:00', '14:30']) assert.ok(!times.includes(t), `${t} offered: ${JSON.stringify(times)}`);
});

// guard: passes before Step 3 (nothing counts requests yet); its mutation proves it.
test("a job's own request never blocks the job", async () => {
  const { jobId, wanted } = await requestingJob();
  const moved = await staff(`/api/workshop-jobs/${jobId}`, {
    method: 'PUT', body: { jobDate: wanted, startTime: '14:30', endTime: '15:30' },
  });
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
});

test('a job that stops being a request lets its requested time go and keeps its own', async () => {
  const { jobId, own } = await requestingJob();
  // The old diary's legacy status PUT is the one way back to scheduled that
  // this piece leaves alone (decision log D13).
  const res = await staff(`/api/workshop-jobs/${jobId}`, { method: 'PUT', body: { status: 'scheduled' } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(await liveHolds(owner.shop.id, jobId), [
    { job_date: own, start_time: '10:00', mechanic_id: sam, purpose: 'booking' },
  ]);
});

test("a job's own hold is never mistaken for its requested one", async () => {
  const { jobId, own, wanted } = await requestingJob();
  // The job has only its requested hold; an edit gives it its own as well.
  const res = await staff(`/api/workshop-jobs/${jobId}`, { method: 'PUT', body: { notes: 'Rang to confirm' } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(await liveHolds(owner.shop.id, jobId), [
    { job_date: wanted, start_time: '14:00', mechanic_id: sam, purpose: 'requested' },
    { job_date: own, start_time: '10:00', mechanic_id: sam, purpose: 'booking' },
  ]);
});
