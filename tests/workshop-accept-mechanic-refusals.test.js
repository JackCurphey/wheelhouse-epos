// Accepting a booking request with a chosen mechanic: the refusals the 22 Oct
// audit found untested (docs/reviews/2026-10-22-flagged-merges-audit.md,
// missing tests item 6). The design
// (openspec/changes/archive/2026-10-20-accept-mechanic/design.md) refuses an
// unknown or inactive mechanic with a 400; someone who isn't a mechanic, or is
// another shop's, is no mechanic of this shop; a mechanic's day off is refused
// as the job's own save refuses it (checkJobSlot). Each leaves the request
// waiting as it was.
// Link calls in this file must stay under 30 (the limiter is per server).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedJobTypes } from './helpers/bookable.js';
import { bookOnline, liveHolds, dayMaker } from './helpers/linkActions.js';

let server;
let owner;
let otherShop;
let sam;
let types;
let customer;
const nextDay = dayMaker();

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  otherShop = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  types = await seedJobTypes(owner.shop.id);
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (otherShop) await deleteTestShop(otherShop.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const read = async (id) => (await staff(`/api/workshop-jobs/${id}`)).body;
const accept = async (id, extra = {}) => staff(`/api/workshop-jobs/${id}/accept`, { method: 'POST', body: { version: (await read(id)).version, ...extra } });
const book = (startTime = '10:00') => bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, { mechanicId: sam, jobDate: nextDay(), startTime, serviceIds: [types.service] });
const employee = (shopId, name, { mechanic = 1, active = 1 } = {}) => runWithShop(shopId, async () =>
  (await prepare('INSERT INTO employees (name, is_mechanic, active) VALUES (?, ?, ?)').run(name, mechanic, active)).lastInsertRowid);

async function assertRefusedAndWaiting(booked, res, error) {
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.equal(res.body.error, error);
  const after = await read(booked.id);
  assert.equal(after.bookingState, 'pending');
  assert.equal(after.mechanicId, sam);
  const holds = await liveHolds(owner.shop.id, booked.id);
  assert.ok(holds.length > 0 && holds.every((h) => h.mechanic_id === sam), JSON.stringify(holds));
}

test('an inactive mechanic is refused', async () => {
  const gone = await employee(owner.shop.id, 'Test Mechanic', { active: 0 });
  const booked = await book('10:00');
  await assertRefusedAndWaiting(booked, await accept(booked.id, { mechanicId: gone }), 'Mechanic not found or inactive');
});

test('someone on the team who isn’t a mechanic is refused', async () => {
  const counter = await employee(owner.shop.id, 'Test Employee', { mechanic: 0 });
  const booked = await book('11:00');
  await assertRefusedAndWaiting(booked, await accept(booked.id, { mechanicId: counter }), 'Mechanic not found or inactive');
});

test('another shop’s mechanic is refused', async () => {
  const theirs = await seedMechanic(otherShop.shop.id, {});
  const booked = await book('12:00');
  await assertRefusedAndWaiting(booked, await accept(booked.id, { mechanicId: theirs }), 'Mechanic not found or inactive');
});

test('a mechanic on their day off is refused, as the job’s save refuses it', async () => {
  const weekends = await seedMechanic(owner.shop.id, { workingDays: [0, 6] });
  const booked = await book('13:00'); // a weekday (dayMaker)
  await assertRefusedAndWaiting(booked, await accept(booked.id, { mechanicId: weekends }),
    'That mechanic does not work that day - please choose another day or another mechanic.');
});
