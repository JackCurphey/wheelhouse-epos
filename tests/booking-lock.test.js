// Booking writes for one shop and date run one at a time, so two customers
// can never both take the last of a day; a refusal for used-up time says so
// with code 'capacity'.
// Spec: docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md (2b)
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
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

const book = (jobDate, startTime, serviceId = types.repair) =>
  portalRequest(server.baseUrl, customer.cookie, `/api/portal/${owner.shop.slug}/bookings`, {
    method: 'POST',
    body: { mechanicId: sam, jobDate, startTime, serviceId, description: 'Test booking', newBike: { make: 'Test', model: 'Bike' }, ...BOOKING_CONTACT },
  });

test('a booking waits while another booking holds the same shop and date', async () => {
  const date = futureDate(1);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1::int, $2::int)', [owner.shop.id, Number(date.replace(/-/g, ''))]);
    let settled = false;
    const pending = book(date, '10:00').then((r) => { settled = true; return r; });
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.equal(settled, false, 'the booking did not wait for the lock');
    await client.query('COMMIT');
    assert.equal((await pending).status, 201);
  } finally {
    // A failed assertion above skips the COMMIT; never hand the pool back a
    // client still inside a transaction that holds the lock.
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
});

test('overlapping bookings sent at once: exactly one wins, the rest get capacity', async () => {
  const date = futureDate(2);
  const results = await Promise.all([
    // 14:00-16:00, 14:30-15:30, 15:00-16:00, 15:15-16:15: every pair overlaps,
    // so exactly one can ever be accepted, whichever arrives first.
    book(date, '14:00', types.service),
    book(date, '14:30'),
    book(date, '15:00'),
    book(date, '15:15'),
  ]);
  const statuses = results.map((r) => r.status).sort();
  assert.deepEqual(statuses, [201, 409, 409, 409], JSON.stringify(results.map((r) => r.body)));
  for (const r of results.filter((x) => x.status === 409)) assert.equal(r.body.code, 'capacity');
});

test('a booking into time another booking holds refuses with capacity', async () => {
  const date = futureDate(3);
  assert.equal((await book(date, '17:00')).status, 201);
  const res = await book(date, '17:00', types.quick);
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.code, 'capacity');
});

// Staff are never refused by the calculator, but a live timed hold left over
// from before 2b (one with no job behind it) can still trip the 024 index.
// That rolls the move back and answers capacity, not a 500.
test('a staff move into a slot a stale hold occupies is rolled back with capacity', async () => {
  const date = futureDate(4);
  const as = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
  const job = await as('/api/workshop-jobs', {
    method: 'POST',
    body: { title: 'Job', jobDate: date, mechanicId: sam, startTime: '12:00', endTime: '13:00' },
  });
  assert.equal(job.status, 201, JSON.stringify(job.body));
  await runWithShop(owner.shop.id, () => prepare(
    `INSERT INTO workshop_capacity_holds (job_date, start_time, mechanic_id, minutes, state)
     VALUES (?, '10:00', ?, 60, 'held')`
  ).run(date, sam));

  const res = await as(`/api/workshop-jobs/${job.body.id}`, { method: 'PUT', body: { startTime: '10:00', endTime: '11:00' } });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.code, 'capacity');
  assert.equal(res.body.error, 'That time is no longer available - please choose another.');
  const row = await runWithShop(owner.shop.id, () => prepare('SELECT start_time, end_time FROM workshop_jobs WHERE id = ?').get(job.body.id));
  assert.deepEqual({ ...row }, { start_time: '12:00', end_time: '13:00' });
});
