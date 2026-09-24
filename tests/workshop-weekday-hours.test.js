// Opening hours per weekday: settings round-trip, the old fields still work,
// and every slot check uses the day's own hours.
// Spec: docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md (2a, Staff endpoints)
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { jsonRequest } from './helpers/http.js';
import { deleteTestShop } from './helpers/testShop.js';

const SATURDAY = '2026-09-12';
const WEEK = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, open: '09:00', close: '18:00' }));
const SHORT_SATURDAY = [...WEEK, { weekday: 6, open: '09:00', close: '17:00' }];

let server;
let owner;
const as = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const settings = (body) => as('/api/workshop-settings', body ? { method: 'PUT', body } : undefined);

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
}

test('a new shop reports every open day at the usual hours', async () => {
  await freshShop();
  const res = await settings();
  assert.equal(res.body.openingHours.length, 7);
  assert.ok(res.body.openingHours.every((d) => d.open === '09:00' && d.close === '18:00'));
});

test('a shorter Saturday and a closed Sunday round-trip', async () => {
  await freshShop();
  const put = await settings({ openingHours: SHORT_SATURDAY });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  assert.deepEqual(put.body.openingDays, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(put.body.openingHours.find((d) => d.weekday === 6), { weekday: 6, open: '09:00', close: '17:00' });
  assert.deepEqual(put.body.openingHours.find((d) => d.weekday === 1), { weekday: 1, open: '09:00', close: '18:00' });
});

test('saving the old fields moves the usual hours and keeps Saturday\'s own', async () => {
  await freshShop();
  await settings({ openingHours: SHORT_SATURDAY });
  const res = await settings({ openingTime: '08:00', fullDayThresholdMinutes: 30 });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.openingHours.find((d) => d.weekday === 1), { weekday: 1, open: '08:00', close: '18:00' });
  assert.deepEqual(res.body.openingHours.find((d) => d.weekday === 6), { weekday: 6, open: '09:00', close: '17:00' });
});

test('closing a day drops its own hours, so re-opening starts from the usual ones', async () => {
  await freshShop();
  await settings({ openingHours: SHORT_SATURDAY });
  await settings({ openingDays: [1, 2, 3, 4, 5] });
  const res = await settings({ openingDays: [1, 2, 3, 4, 5, 6] });
  assert.deepEqual(res.body.openingHours.find((d) => d.weekday === 6), { weekday: 6, open: '09:00', close: '18:00' });
});

test('hours that close before they open, or both day lists at once, are refused', async () => {
  await freshShop();
  assert.equal((await settings({ openingHours: [{ weekday: 1, open: '18:00', close: '09:00' }] })).status, 400);
  assert.equal((await settings({ openingHours: WEEK, openingDays: [1] })).status, 400);
});

test('a staff job past Saturday\'s closing time is refused with Saturday\'s hours', async () => {
  await freshShop();
  await settings({ openingHours: SHORT_SATURDAY });
  const mechanicId = await seedMechanic(owner.shop.id);
  const res = await as('/api/workshop-jobs', {
    method: 'POST',
    body: { title: 'Late one', jobDate: SATURDAY, startTime: '16:30', endTime: '17:30', mechanicId },
  });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.match(res.body.error, /09:00.17:00/);
});

test('the old booking page\'s grid spans the widest day', async () => {
  await freshShop();
  await settings({ openingHours: SHORT_SATURDAY });
  const res = await jsonRequest(server.baseUrl, null, `/api/portal/${owner.shop.slug}/mechanics`);
  assert.equal(res.body.openingTime, '09:00');
  assert.equal(res.body.closingTime, '18:00');
});
