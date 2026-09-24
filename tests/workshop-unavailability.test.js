// Blocks: lunch, leave and closures, managed by staff, reported against the
// bookings they clash with. Staff are never refused by a block.
// Spec: docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md (2a, Staff endpoints)
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedWorkshopJob, futureDate } from './helpers/workshopFixtures.js';

let server;
let shopA;
let shopB;
let sam;
let otherShopMechanic;

before(async () => {
  server = await startLiveServer();
  shopA = await staffSignup(server.baseUrl);
  shopB = await staffSignup(server.baseUrl);
  sam = await seedMechanic(shopA.shop.id, { name: 'Sam' });
  otherShopMechanic = await seedMechanic(shopB.shop.id, { name: 'Elsewhere' });
});

after(async () => {
  if (shopA) await deleteTestShop(shopA.shop.id);
  if (shopB) await deleteTestShop(shopB.shop.id);
  if (server) await server.stop();
});

const as = (who, path, options) => staffRequest(server.baseUrl, who.cookie, path, options);
const LUNCH = () => ({ kind: 'weekly', mechanicId: sam, weekdays: [1, 2, 3, 4, 5], startTime: '13:00', endTime: '13:30', reason: 'Lunch' });

test('a weekly lunch block round-trips', async () => {
  const created = await as(shopA, '/api/workshop-unavailability', { method: 'POST', body: LUNCH() });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.block.reason, 'Lunch');
  assert.deepEqual(created.body.block.weekdays, [1, 2, 3, 4, 5]);
  const list = await as(shopA, '/api/workshop-unavailability');
  assert.ok(list.body.blocks.some((b) => b.id === created.body.block.id));
});

test('adding a block reports the bookings it clashes with, and does not move them', async () => {
  const monday = futureDate(1);
  const { jobId } = await seedWorkshopJob({ shopId: shopA.shop.id, customerId: null, mechanicId: sam, jobDate: monday, startTime: '12:45', endTime: '13:45' });
  const { jobId: clear } = await seedWorkshopJob({ shopId: shopA.shop.id, customerId: null, mechanicId: sam, jobDate: monday, startTime: '15:00', endTime: '16:00' });
  const res = await as(shopA, '/api/workshop-unavailability', { method: 'POST', body: { ...LUNCH(), reason: 'Second lunch' } });
  assert.equal(res.status, 201);
  const ids = res.body.clashes.map((c) => c.id);
  assert.ok(ids.includes(jobId));
  assert.ok(!ids.includes(clear));
  const still = await runWithShop(shopA.shop.id, () => prepare('SELECT start_time FROM workshop_jobs WHERE id = ?').get(jobId));
  assert.equal(still.start_time, '12:45', 'a block must never move or cancel a booking');
});

test('a cancelled booking is not a clash', async () => {
  const friday = futureDate(5);
  const { jobId } = await seedWorkshopJob({ shopId: shopA.shop.id, customerId: null, mechanicId: sam, jobDate: friday, startTime: '10:00', endTime: '11:00' });
  await runWithShop(shopA.shop.id, () => prepare("UPDATE workshop_jobs SET booking_state = 'cancelled' WHERE id = ?").run(jobId));
  const res = await as(shopA, '/api/workshop-unavailability', {
    method: 'POST', body: { kind: 'dates', mechanicId: sam, startDate: friday, endDate: friday, reason: 'Dentist' },
  });
  assert.ok(!res.body.clashes.some((c) => c.id === jobId));
});

test('a shop closure covers whole days and clashes with everyone\'s jobs', async () => {
  const wednesday = futureDate(3);
  const { jobId } = await seedWorkshopJob({ shopId: shopA.shop.id, customerId: null, mechanicId: null, jobDate: wednesday, startTime: '', endTime: '', plannedMinutes: 60 });
  const res = await as(shopA, '/api/workshop-unavailability', {
    method: 'POST', body: { kind: 'dates', mechanicId: null, startDate: wednesday, endDate: wednesday, reason: 'Stocktake' },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.ok(res.body.clashes.some((c) => c.id === jobId));
  const withTimes = await as(shopA, '/api/workshop-unavailability', {
    method: 'POST', body: { kind: 'dates', mechanicId: null, startDate: wednesday, endDate: wednesday, startTime: '09:00', endTime: '12:00' },
  });
  assert.equal(withTimes.status, 400);
});

test('an update keeps omitted fields, and delete removes the block', async () => {
  const created = (await as(shopA, '/api/workshop-unavailability', { method: 'POST', body: LUNCH() })).body.block;
  const updated = await as(shopA, `/api/workshop-unavailability/${created.id}`, { method: 'PUT', body: { endTime: '14:00' } });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  assert.equal(updated.body.block.endTime, '14:00');
  assert.equal(updated.body.block.reason, 'Lunch');
  assert.equal((await as(shopA, `/api/workshop-unavailability/${created.id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await as(shopA, `/api/workshop-unavailability/${created.id}`, { method: 'DELETE' })).status, 404);
});

test('another shop\'s mechanic and another shop\'s block are not found', async () => {
  const foreign = await as(shopA, '/api/workshop-unavailability', { method: 'POST', body: { ...LUNCH(), mechanicId: otherShopMechanic } });
  assert.equal(foreign.status, 404);
  const mine = (await as(shopA, '/api/workshop-unavailability', { method: 'POST', body: LUNCH() })).body.block;
  assert.equal((await as(shopB, `/api/workshop-unavailability/${mine.id}`, { method: 'PUT', body: { reason: 'x' } })).status, 404);
  assert.ok(!(await as(shopB, '/api/workshop-unavailability')).body.blocks.some((b) => b.id === mine.id));
});

test('a date-range list includes weekly blocks and overlapping date blocks only', async () => {
  const early = { kind: 'dates', mechanicId: sam, startDate: '2030-01-01', endDate: '2030-01-02' };
  const late = { kind: 'dates', mechanicId: sam, startDate: '2030-03-01', endDate: '2030-03-02' };
  const a = (await as(shopA, '/api/workshop-unavailability', { method: 'POST', body: early })).body.block;
  const b = (await as(shopA, '/api/workshop-unavailability', { method: 'POST', body: late })).body.block;
  const list = (await as(shopA, '/api/workshop-unavailability?start=2030-01-02&end=2030-01-31')).body.blocks;
  assert.ok(list.some((x) => x.id === a.id));
  assert.ok(!list.some((x) => x.id === b.id));
  assert.ok(list.some((x) => x.kind === 'weekly'));
});

test('a non-numeric block id is a 404, not a 500', async () => {
  const put = await as(shopA, '/api/workshop-unavailability/abc', { method: 'PUT', body: { reason: 'x' } });
  assert.equal(put.status, 404);
  const del = await as(shopA, '/api/workshop-unavailability/abc', { method: 'DELETE' });
  assert.equal(del.status, 404);
});
