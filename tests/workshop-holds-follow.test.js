// A job's capacity hold follows the job, and staff can queue a walk-in with a
// length and no mechanic or time. Staff are never refused for capacity.
// Spec: docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md (2b)
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { futureDate } from './helpers/workshopFixtures.js';

let server;
let owner;
let sam;
let alex;
const MONDAY = futureDate(1);
const TUESDAY = futureDate(2);

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  alex = await seedMechanic(owner.shop.id, { name: 'Alex' });
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

const as = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const createJob = (body) => as('/api/workshop-jobs', { method: 'POST', body: { title: 'Job', jobDate: MONDAY, ...body } });
const liveHolds = (jobId) => runWithShop(owner.shop.id, () => prepare(
  `SELECT job_date, start_time, mechanic_id, minutes FROM workshop_capacity_holds
   WHERE workshop_job_id = ? AND state IN ('held', 'confirmed')`
).all(jobId));
const capacity = async (date) => (await as(`/api/workshop-capacity?start=${date}&end=${date}`)).body.days[0];

test('moving and resizing a job moves its hold', async () => {
  const job = (await createJob({ mechanicId: sam, startTime: '10:00', endTime: '11:00' })).body;
  const moved = await as(`/api/workshop-jobs/${job.id}`, { method: 'PUT', body: { jobDate: TUESDAY, startTime: '14:00', endTime: '15:30' } });
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
  assert.deepEqual((await liveHolds(job.id)).map((h) => ({ ...h })), [{ job_date: TUESDAY, start_time: '14:00', mechanic_id: sam, minutes: 90 }]);
});

test('a walk-in joins the shared queue with its length, and its hold records it', async () => {
  const res = await createJob({ plannedMinutes: 60 });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const row = await runWithShop(owner.shop.id, () => prepare('SELECT planned_minutes, mechanic_id FROM workshop_jobs WHERE id = ?').get(res.body.id));
  assert.deepEqual({ ...row }, { planned_minutes: 60, mechanic_id: null });
  assert.deepEqual((await liveHolds(res.body.id)).map((h) => ({ ...h })), [{ job_date: MONDAY, start_time: '', mechanic_id: null, minutes: 60 }]);
  assert.equal((await capacity(MONDAY)).queueMinutes, 60);
});

test('assigning a queued walk-in moves its whole length onto the mechanic', async () => {
  const date = futureDate(3);
  const job = (await createJob({ jobDate: date, plannedMinutes: 120 })).body;
  const before = await capacity(date);
  const samBefore = before.mechanics.find((m) => m.mechanicId === sam).freeMinutes;
  const assigned = await as(`/api/workshop-jobs/${job.id}`, { method: 'PUT', body: { mechanicId: sam } });
  assert.equal(assigned.status, 200, JSON.stringify(assigned.body));
  const after = await capacity(date);
  assert.equal(after.queueMinutes, 0);
  assert.equal(after.mechanics.find((m) => m.mechanicId === sam).freeMinutes, samBefore - 60, 'Sam had carried half the queue; now he carries all of it');
  assert.equal((await liveHolds(job.id))[0].mechanic_id, sam);
});

test('staff are never refused for capacity', async () => {
  const date = futureDate(4);
  await createJob({ jobDate: date, mechanicId: alex, startTime: '09:00', endTime: '18:00' });
  const res = await createJob({ jobDate: date, mechanicId: alex, plannedMinutes: 240 });
  assert.equal(res.status, 201, JSON.stringify(res.body));
});

test('a planned length must be whole minutes between 1 and 720', async () => {
  assert.equal((await createJob({ plannedMinutes: 0 })).status, 400);
  assert.equal((await createJob({ plannedMinutes: 'an hour' })).status, 400);
});

test('two unassigned timed jobs at the same start do not collide, because an unassigned hold is untimed', async () => {
  const date = futureDate(5);
  const first = await createJob({ jobDate: date, startTime: '10:00', endTime: '11:00' });
  assert.equal(first.status, 201, JSON.stringify(first.body));
  const second = await createJob({ jobDate: date, startTime: '10:00', endTime: '11:00' });
  assert.equal(second.status, 201, JSON.stringify(second.body));

  const third = (await createJob({ jobDate: date, startTime: '14:00', endTime: '15:00' })).body;
  const moved = await as(`/api/workshop-jobs/${third.id}`, { method: 'PUT', body: { startTime: '10:00', endTime: '11:00' } });
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
  assert.equal((await liveHolds(third.id))[0].start_time, '');
});

test('declining a reschedule request returns a live job to scheduled, and its hold survives', async () => {
  const date = futureDate(6);
  const job = (await createJob({ jobDate: date, mechanicId: sam, startTime: '10:00', endTime: '11:00' })).body;

  const requested = await as(`/api/workshop-jobs/${job.id}/request-reschedule`, { method: 'POST', body: { version: 1 } });
  assert.equal(requested.status, 200, JSON.stringify(requested.body));
  assert.equal(requested.body.bookingState, 'reschedule_requested');

  const declined = await as(`/api/workshop-jobs/${job.id}/decline`, { method: 'POST', body: { version: 2 } });
  assert.equal(declined.status, 200, JSON.stringify(declined.body));
  assert.equal(declined.body.bookingState, 'scheduled', 'declining a reschedule request returns the job to its prior booking, which is live');

  assert.equal((await liveHolds(job.id)).length, 1, 'a live job must keep exactly one hold');
});

test('cancelling a job runs the release through syncJobHold, which leaves no held hold', async () => {
  const date = futureDate(0);
  const job = (await createJob({ jobDate: date, mechanicId: sam, startTime: '10:00', endTime: '11:00' })).body;
  assert.equal((await liveHolds(job.id)).length, 1);

  const cancelled = await as(`/api/workshop-jobs/${job.id}/cancel`, { method: 'POST', body: { version: 1 } });
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));

  assert.equal((await liveHolds(job.id)).length, 0, 'a cancelled job is no longer live and must hold nothing');
});
