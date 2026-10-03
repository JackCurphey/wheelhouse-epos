// Jobs over several days (Workshop day decision 52; Jack, 3 Oct: "Add another
// day" on the job page, and automatic carry-over of unfinished jobs). Every
// day a job takes really takes that mechanic's time: the jobs list, the slot
// rules, the free-time sums and a block's clashes all read the parts.
// Spec: docs/superpowers/specs/2026-10-03-multi-day-jobs-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic, setOpeningDays } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let sam; // works Mon, Tue, Thu, Fri (off on Wednesdays)
let jo;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Parts Cycles' });
  sam = await seedMechanic(owner.shop.id, { name: 'Sam', workingDays: [1, 2, 4, 5] });
  jo = await seedMechanic(owner.shop.id, { name: 'Jo' });
  await setOpeningDays(owner.shop.id, [1, 2, 3, 4, 5]);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
async function newJob(over = {}) {
  const r = await staff('/api/workshop-jobs', {
    method: 'POST',
    body: { title: 'Frame rebuild', jobDate: '2026-10-06', startTime: '10:00', endTime: '12:00', mechanicId: sam, skipAutoOrder: true, ...over },
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
}
const days = (job) => job.parts.map((p) => `${p.position} ${p.date} ${p.startTime}-${p.endTime} ${p.mechanicName}`);

test('a job carries its parts; a one-day job has just part 1', async () => {
  const job = await newJob();
  assert.deepEqual(days(job), ['1 2026-10-06 10:00-12:00 Sam']);
  const one = await staff(`/api/workshop-jobs/${job.id}`);
  assert.deepEqual(days(one.body), ['1 2026-10-06 10:00-12:00 Sam']);
});

test('Add another day adds the next day the shop opens and the mechanic works, at the same time', async () => {
  const job = await newJob({ jobDate: '2026-10-13' });
  const r = await staff(`/api/workshop-jobs/${job.id}/parts`, { method: 'POST', body: { version: job.version } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  // Wednesday is Sam's day off, so day 2 is Thursday.
  assert.deepEqual(days(r.body), ['1 2026-10-13 10:00-12:00 Sam', '2 2026-10-15 10:00-12:00 Sam']);
  assert.equal(r.body.version, job.version + 1);
});

test('Add another day needs the version the caller saw', async () => {
  const job = await newJob({ jobDate: '2026-10-12', startTime: '14:00', endTime: '15:00' });
  const stale = await staff(`/api/workshop-jobs/${job.id}/parts`, { method: 'POST', body: { version: job.version - 1 } });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.code, 'stale');
  const missing = await staff(`/api/workshop-jobs/${job.id}/parts`, { method: 'POST', body: {} });
  assert.equal(missing.status, 400);
});

test('the jobs list finds a job by any of its days', async () => {
  const job = await newJob({ jobDate: '2026-10-19' });
  await staff(`/api/workshop-jobs/${job.id}/parts`, { method: 'POST', body: { version: job.version } });
  // Monday 19th, then Tuesday 20th. A list of just the Tuesday still has it.
  const list = await staff('/api/workshop-jobs?start=2026-10-20&end=2026-10-20');
  const found = list.body.find((j) => j.id === job.id);
  assert.ok(found, 'the job was not in the list for its second day');
  assert.deepEqual(days(found), ['1 2026-10-19 10:00-12:00 Sam', '2 2026-10-20 10:00-12:00 Sam']);
});

test("another job can't be booked over a job's second day", async () => {
  const job = await newJob({ jobDate: '2026-10-26' });
  await staff(`/api/workshop-jobs/${job.id}/parts`, { method: 'POST', body: { version: job.version } });
  const clash = await staff('/api/workshop-jobs', {
    method: 'POST',
    body: { title: 'Puncture', jobDate: '2026-10-27', startTime: '11:00', endTime: '11:30', mechanicId: sam, skipAutoOrder: true },
  });
  assert.equal(clash.status, 400, JSON.stringify(clash.body));
  assert.match(clash.body.error, /already booked/);
});

test("a job's second day counts against the mechanic's free time", async () => {
  const before = await staff('/api/workshop-capacity?start=2026-11-03&end=2026-11-03');
  const free = (r) => r.body.days[0].mechanics.find((m) => m.mechanicId === sam).freeMinutes;
  const job = await newJob({ jobDate: '2026-11-02' });
  await staff(`/api/workshop-jobs/${job.id}/parts`, { method: 'POST', body: { version: job.version } });
  const afterAdding = await staff('/api/workshop-capacity?start=2026-11-03&end=2026-11-03');
  assert.equal(free(before) - free(afterAdding), 120);
});

test('a later day can be moved to another day, time and mechanic; a clash is refused', async () => {
  const job = await newJob({ jobDate: '2026-11-09' });
  const added = (await staff(`/api/workshop-jobs/${job.id}/parts`, { method: 'POST', body: { version: job.version } })).body;
  const day2 = added.parts[1];
  const moved = await staff(`/api/workshop-jobs/${job.id}/parts/${day2.id}`, {
    method: 'PUT', body: { jobDate: '2026-11-11', startTime: '14:00', endTime: '16:00', mechanicId: jo, version: added.version },
  });
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
  assert.deepEqual(days(moved.body), ['1 2026-11-09 10:00-12:00 Sam', '2 2026-11-11 14:00-16:00 Jo']);
  await newJob({ title: 'In the way', jobDate: '2026-11-12', startTime: '09:00', endTime: '11:00', mechanicId: jo });
  const clash = await staff(`/api/workshop-jobs/${job.id}/parts/${day2.id}`, {
    method: 'PUT', body: { jobDate: '2026-11-12', startTime: '10:00', endTime: '12:00', mechanicId: jo, version: moved.body.version },
  });
  assert.equal(clash.status, 400, JSON.stringify(clash.body));
});

test('a later day can be removed; day 1 cannot', async () => {
  const job = await newJob({ jobDate: '2026-11-16' });
  const two = (await staff(`/api/workshop-jobs/${job.id}/parts`, { method: 'POST', body: { version: job.version } })).body;
  const three = (await staff(`/api/workshop-jobs/${job.id}/parts`, { method: 'POST', body: { version: two.version } })).body;
  assert.equal(three.parts.length, 3);
  const gone = await staff(`/api/workshop-jobs/${job.id}/parts/${three.parts[1].id}`, { method: 'DELETE', body: { version: three.version } });
  assert.equal(gone.status, 200, JSON.stringify(gone.body));
  assert.deepEqual(gone.body.parts.map((p) => p.position), [1, 2]);
  assert.equal(gone.body.parts[1].date, three.parts[2].date);
  const first = await staff(`/api/workshop-jobs/${job.id}/parts/${gone.body.parts[0].id}`, { method: 'DELETE', body: { version: gone.body.version } });
  assert.equal(first.status, 400);
});

test("an unfinished job whose last day has passed carries over to the next working day, once", async () => {
  // The test clock is Tuesday 1 September 2026; this job was Friday 28 August.
  const job = await newJob({ jobDate: '2026-08-28', startTime: '13:00', endTime: '15:00' });
  const bookedIn = await staff(`/api/workshop-jobs/${job.id}/book-in`, { method: 'POST', body: { version: job.version } });
  assert.equal(bookedIn.status, 200, JSON.stringify(bookedIn.body));
  const first = await staff('/api/workshop-jobs?start=2026-09-01&end=2026-09-01');
  const carried = first.body.find((j) => j.id === job.id);
  assert.ok(carried, 'the unfinished job was not carried over to today');
  assert.deepEqual(days(carried), ['1 2026-08-28 13:00-15:00 Sam', '2 2026-09-01 13:00-15:00 Sam']);
  const again = await staff('/api/workshop-jobs?start=2026-09-01&end=2026-09-01');
  assert.equal(again.body.find((j) => j.id === job.id).parts.length, 2);
});

test('a job is not carried over if the bike never came in, or the work is finished', async () => {
  const notHere = await newJob({ jobDate: '2026-08-27' });
  const done = await newJob({ jobDate: '2026-08-25', startTime: '09:00', endTime: '10:00' });
  let v = (await staff(`/api/workshop-jobs/${done.id}/book-in`, { method: 'POST', body: { version: done.version } })).body.version;
  v = (await staff(`/api/workshop-jobs/${done.id}/start`, { method: 'POST', body: { version: v } })).body.version;
  await staff(`/api/workshop-jobs/${done.id}/finish`, { method: 'POST', body: { version: v } });
  await staff('/api/workshop-jobs?start=2026-09-01&end=2026-09-01');
  for (const id of [notHere.id, done.id]) {
    assert.equal((await staff(`/api/workshop-jobs/${id}`)).body.parts.length, 1, `job ${id} was carried over`);
  }
});
