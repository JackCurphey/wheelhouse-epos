// The staff capacity view: the calculator's full answer, reasons and clashes
// included - what the diary, week, month and hours screens will read.
// Spec: docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md (2a, Staff endpoints)
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { jsonRequest } from './helpers/http.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedWorkshopJob } from './helpers/workshopFixtures.js';

const MONDAY = '2026-09-07';

let server;
let owner;
let sam;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

const as = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);

test('staff see free minutes, windows, block reasons and clashes', async () => {
  const lunch = (await as('/api/workshop-unavailability', {
    method: 'POST', body: { kind: 'weekly', mechanicId: sam, weekdays: [1], startTime: '13:00', endTime: '13:30', reason: 'Lunch' },
  })).body.block;
  const { jobId } = await seedWorkshopJob({ shopId: owner.shop.id, customerId: null, mechanicId: sam, jobDate: MONDAY, startTime: '12:45', endTime: '13:15' });
  const res = await as(`/api/workshop-capacity?start=${MONDAY}&end=${MONDAY}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const day = res.body.days[0];
  const m = day.mechanics.find((x) => x.mechanicId === sam);
  assert.equal(m.working, true);
  assert.equal(m.blocks[0].reason, 'Lunch');
  assert.deepEqual(m.freeWindows[0], { start: '09:00', end: '12:45' });
  assert.equal(m.freeMinutes, 540 - 30 - 15);
  assert.deepEqual(day.clashes, [{ jobId, blockId: lunch.id }]);
});

test('a shop closure shows as closed, with its reason', async () => {
  await as('/api/workshop-unavailability', {
    method: 'POST', body: { kind: 'dates', mechanicId: null, startDate: '2026-09-08', endDate: '2026-09-08', reason: 'Training' },
  });
  const day = (await as('/api/workshop-capacity?start=2026-09-08&end=2026-09-08')).body.days[0];
  assert.equal(day.shopClosed, true);
  assert.equal(day.closures[0].reason, 'Training');
  assert.ok(day.mechanics.every((m) => m.freeMinutes === 0));
});

test('the view is staff-only and range-limited', async () => {
  assert.equal((await jsonRequest(server.baseUrl, null, `/api/workshop-capacity?start=${MONDAY}&end=${MONDAY}`)).status, 401);
  assert.equal((await as('/api/workshop-capacity?start=2026-09-01&end=2026-11-02')).status, 400);
});
