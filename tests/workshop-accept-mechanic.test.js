// Choosing the mechanic as a booking request is accepted (Workshop day
// decision 62, 29 Sep: "a small set of pills (the shop's mechanics and the
// shared queue) on the request pop-up"; drawn on request-new): accept takes
// the mechanic, checked free at the booked time under the day's lock.
// Link calls in this file must stay under 30 (the limiter is per server).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedJobTypes } from './helpers/bookable.js';
import { bookOnline, liveHolds, dayMaker } from './helpers/linkActions.js';

let server;
let owner;
let sam;
let alex;
let types;
let customer;
const nextDay = dayMaker();

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  alex = await seedMechanic(owner.shop.id, { name: 'Alex' });
  types = await seedJobTypes(owner.shop.id);
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const read = async (id) => (await staff(`/api/workshop-jobs/${id}`)).body;
const accept = async (id, extra = {}) => staff(`/api/workshop-jobs/${id}/accept`, { method: 'POST', body: { version: (await read(id)).version, ...extra } });
const book = (jobDate = nextDay(), startTime = '10:00') => bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, { mechanicId: sam, jobDate, startTime, serviceIds: [types.service] });

test('accepting with another mechanic books it for them, and the time held moves with it', async () => {
  const booked = await book();
  const res = await accept(booked.id, { mechanicId: alex });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.bookingState, 'scheduled');
  assert.equal(res.body.mechanicId, alex);
  const holds = await liveHolds(owner.shop.id, booked.id);
  assert.ok(holds.length > 0 && holds.every((h) => h.mechanic_id === alex), JSON.stringify(holds));
});

test('accepting into the shared queue, or without choosing, keeps what was chosen', async () => {
  const queued = await book(nextDay(), '11:00');
  const res = await accept(queued.id, { mechanicId: null });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.mechanicId, null);
  const kept = await book(nextDay(), '12:00');
  const plain = await accept(kept.id);
  assert.equal(plain.body.mechanicId, sam);
});

test('a mechanic busy at that time is refused, and the request waits as it was', async () => {
  const day = nextDay();
  const busy = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Already booked', jobDate: day, startTime: '13:00', endTime: '15:00', mechanicId: alex } });
  assert.equal(busy.status, 201, JSON.stringify(busy.body));
  const booked = await book(day, '13:00');
  const res = await accept(booked.id, { mechanicId: alex });
  // Refused as the job's own save refuses a clash.
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.match(res.body.error, /That mechanic is already booked/);
  const after = await read(booked.id);
  assert.equal(after.bookingState, 'pending');
  assert.equal(after.mechanicId, sam);
});

test('an unknown mechanic is refused', async () => {
  const booked = await book(nextDay(), '14:00');
  const res = await accept(booked.id, { mechanicId: 999999 });
  assert.equal(res.status, 400);
  assert.equal((await read(booked.id)).bookingState, 'pending');
});

test('an out-of-date accept is told the job changed, before any mechanic check', async () => {
  const day = nextDay();
  const busy = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Already booked', jobDate: day, startTime: '15:00', endTime: '16:00', mechanicId: alex } });
  assert.equal(busy.status, 201, JSON.stringify(busy.body));
  const booked = await book(day, '15:00');
  const seen = (await read(booked.id)).version;
  const res = await staff(`/api/workshop-jobs/${booked.id}/accept`, { method: 'POST', body: { version: seen - 1, mechanicId: alex } });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.code, 'stale');
});

test('the accept answers with the job as it now is', async () => {
  const booked = await book(nextDay(), '16:00');
  const res = await accept(booked.id, { mechanicId: alex });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.version, (await read(booked.id)).version);
});
