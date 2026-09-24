// The customer calendar, answered by the capacity calculator: blocks, closed
// dates, per-weekday hours and the booking mode, never a reason.
// Spec: docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md (2a, Customer calendar)
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { jsonRequest } from './helpers/http.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedWorkshopJob } from './helpers/workshopFixtures.js';

const MONDAY = '2026-09-07';
const SATURDAY = '2026-09-12';

let server;
let owner;
let sam;
let alex;

before(async () => {
  server = await startLiveServer();
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

async function freshShop() {
  if (owner) await deleteTestShop(owner.shop.id);
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  alex = await seedMechanic(owner.shop.id, { name: 'Alex' });
}

const as = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const block = (body) => as('/api/workshop-unavailability', { method: 'POST', body });
const availability = (query) =>
  jsonRequest(server.baseUrl, null, `/api/portal/${owner.shop.slug}/availability?${new URLSearchParams(query)}`);
const mechOn = (body, date, id) => body.days.find((d) => d.date === date).mechanics.find((m) => m.mechanicId === id);

test('lunch takes its start times away, and shows as busy with no reason', async () => {
  await freshShop();
  await block({ kind: 'weekly', mechanicId: sam, weekdays: [1], startTime: '13:00', endTime: '13:30', reason: 'Lunch with the dentist' });
  const { status, body } = await availability({ start: MONDAY, end: MONDAY, minutes: '60' });
  assert.equal(status, 200, JSON.stringify(body));
  const starts = mechOn(body, MONDAY, sam).startTimes;
  assert.ok(starts.includes('12:00'));
  assert.ok(!starts.includes('12:30'));
  assert.ok(!starts.includes('13:00'));
  assert.ok(mechOn(body, MONDAY, alex).startTimes.includes('13:00'), 'Alex has no lunch block');
  assert.ok(body.busy.some((b) => b.mechanicId === sam && b.startTime === '13:00' && b.endTime === '13:30'));
  assert.ok(!JSON.stringify(body).includes('dentist'), 'a block reason reached a customer');
});

test('a shop closure empties the day and marks it full for every mechanic', async () => {
  await freshShop();
  await block({ kind: 'dates', mechanicId: null, startDate: MONDAY, endDate: MONDAY, reason: 'Staff training' });
  const { body } = await availability({ start: MONDAY, end: MONDAY, minutes: '30' });
  assert.deepEqual(mechOn(body, MONDAY, sam).startTimes, []);
  assert.deepEqual(body.fullDays.map((f) => f.mechanicId).sort(), [sam, alex].sort());
  assert.ok(!JSON.stringify(body).includes('training'));
});

test('Saturday\'s shorter hours end its start times earlier', async () => {
  await freshShop();
  await as('/api/workshop-settings', {
    method: 'PUT',
    body: { openingHours: [0, 1, 2, 3, 4, 5].map((weekday) => ({ weekday, open: '09:00', close: '18:00' })).concat({ weekday: 6, open: '09:00', close: '17:00' }) },
  });
  const { body } = await availability({ start: SATURDAY, end: SATURDAY, minutes: '60' });
  assert.equal(mechOn(body, SATURDAY, sam).startTimes.at(-1), '16:00');
  assert.ok(body.busy.some((b) => b.mechanicId === sam && b.startTime === '17:00' && b.endTime === '18:00'));
});

test('a cancelled booking frees its time', async () => {
  await freshShop();
  const { jobId } = await seedWorkshopJob({ shopId: owner.shop.id, customerId: null, mechanicId: sam, jobDate: MONDAY, startTime: '10:00', endTime: '11:00' });
  await runWithShop(owner.shop.id, () => prepare("UPDATE workshop_jobs SET booking_state = 'cancelled' WHERE id = ?").run(jobId));
  const { body } = await availability({ start: MONDAY, end: MONDAY, minutes: '60' });
  assert.ok(mechOn(body, MONDAY, sam).startTimes.includes('10:00'));
  assert.ok(!body.busy.some((b) => b.startTime === '10:00'));
});

test('an unassigned walk-in takes a share of each working mechanic\'s drop-off day', async () => {
  await freshShop();
  await runWithShop(owner.shop.id, () => prepare("UPDATE workshop_settings SET booking_mode = 'dropoff'").run());
  // Two working mechanics, a 540-minute day each, no reserve: 1000 queued = 500 each.
  await seedWorkshopJob({ shopId: owner.shop.id, customerId: null, mechanicId: null, jobDate: MONDAY, startTime: '', endTime: '', plannedMinutes: 1000 });
  const { body } = await availability({ start: MONDAY, end: MONDAY, minutes: '40' });
  const day = body.days.find((d) => d.date === MONDAY);
  assert.equal(day.mode, 'dropoff');
  assert.deepEqual(day.dropoffWindow, { start: '09:00', end: '10:00' });
  assert.equal(mechOn(body, MONDAY, sam).bookable, true);
  const tooLong = await availability({ start: MONDAY, end: MONDAY, minutes: '41' });
  assert.equal(mechOn(tooLong.body, MONDAY, sam).bookable, false);
  assert.ok(!('freeMinutes' in mechOn(body, MONDAY, sam)), 'minute totals are staff-only');
});

test('a scheduled mode change applies from its date', async () => {
  await freshShop();
  await runWithShop(owner.shop.id, () => prepare(
    "UPDATE workshop_settings SET next_booking_mode = 'dropoff', next_booking_mode_from = '2026-09-08'"
  ).run());
  const { body } = await availability({ start: MONDAY, end: '2026-09-08', minutes: '60' });
  assert.equal(body.days[0].mode, 'timed');
  assert.equal(body.days[1].mode, 'dropoff');
});

test('the mechanic filter narrows the answer but not the queue split', async () => {
  await freshShop();
  await runWithShop(owner.shop.id, () => prepare("UPDATE workshop_settings SET booking_mode = 'dropoff'").run());
  await seedWorkshopJob({ shopId: owner.shop.id, customerId: null, mechanicId: null, jobDate: MONDAY, startTime: '', endTime: '', plannedMinutes: 1000 });
  const { body } = await availability({ start: MONDAY, end: MONDAY, minutes: '40', mechanicId: String(sam) });
  assert.deepEqual(body.days[0].mechanics.map((m) => m.mechanicId), [sam]);
  assert.equal(body.days[0].mechanics[0].bookable, true, 'the queue was split over one mechanic instead of two');
});

test('a range over 62 days, or a bad minutes value, is refused', async () => {
  await freshShop();
  assert.equal((await availability({ start: '2026-09-01', end: '2026-11-02' })).status, 400);
  assert.equal((await availability({ start: MONDAY, end: MONDAY, minutes: 'lots' })).status, 400);
  assert.equal((await availability({ start: '2026-09-01', end: '2026-11-01' })).status, 200);
});

test('a date that looks right but does not exist is refused', async () => {
  await freshShop();
  assert.equal((await availability({ start: '2026-02-30', end: '2026-02-30' })).status, 400);
  assert.equal((await availability({ start: MONDAY, end: '2026-13-01' })).status, 400);
});

test('an end date before the start date is refused', async () => {
  await freshShop();
  const res = await availability({ start: SATURDAY, end: MONDAY });
  assert.equal(res.status, 400, JSON.stringify(res.body));
});

test('a non-numeric mechanicId is refused, not silently emptied', async () => {
  await freshShop();
  const res = await availability({ start: MONDAY, end: MONDAY, mechanicId: 'not-a-number' });
  assert.equal(res.status, 400, JSON.stringify(res.body));
});
