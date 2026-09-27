// The private link says what the customer may do (piece 12): change or cancel
// while the bike has not reached the shop and the booking is live, the change
// they asked for, and whether staff declined their last one. Then cancelling
// through the link (Task 4).
// Link calls in this file must stay under 30 (the limiter is per server).
// Spec: docs/superpowers/specs/2026-09-27-book-server-12-change-cancel-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, seedMechanic } from './helpers/staff.js';
import { portalSignup } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedJobTypes } from './helpers/bookable.js';
import { linkActions, bookOnline, setJob, dayMaker } from './helpers/linkActions.js';

let server;
let owner;
let sam;
let types;
let customer;
let link;
const nextDay = dayMaker();

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  types = await seedJobTypes(owner.shop.id);
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
  link = linkActions(server.baseUrl, owner.shop.slug);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const book = () => bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, {
  mechanicId: sam, jobDate: nextDay(), startTime: '10:00', serviceIds: [types.repair],
});
const shopId = () => owner.shop.id;

test('an unconfirmed booking can be changed or cancelled, and asks for nothing yet', async () => {
  const booked = await book();
  const res = await link.read(booked.code);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.canChange, true);
  assert.equal(res.body.canCancel, true);
  assert.equal(res.body.requested, null);
  assert.equal(res.body.changeDeclined, false);
});

test('once the bike is with the shop the link offers neither', async () => {
  const booked = await book();
  await setJob(shopId(), booked.id, "booking_state = 'scheduled', custody_state = 'in_shop'");
  const res = await link.read(booked.code);
  assert.equal(res.body.canChange, false);
  assert.equal(res.body.canCancel, false);
});

test('a cancelled booking offers neither', async () => {
  const booked = await book();
  await setJob(shopId(), booked.id, "booking_state = 'cancelled'");
  const res = await link.read(booked.code);
  assert.equal(res.body.canChange, false);
  assert.equal(res.body.canCancel, false);
});

test('a change the customer asked for shows on the link', async () => {
  const booked = await book();
  const wanted = nextDay();
  await setJob(shopId(), booked.id,
    "booking_state = 'reschedule_requested', requested_job_date = ?, requested_mechanic_id = ?, requested_start_time = '14:00', requested_end_time = '15:00'",
    wanted, sam);
  const res = await link.read(booked.code);
  assert.deepEqual(res.body.requested, { jobDate: wanted, startTime: '14:00', mechanicId: sam });
  assert.equal(res.body.stage, 'change_requested');
  assert.equal(res.body.canChange, true);
});

test('a request left on a booking that is no longer waiting on it is not shown', async () => {
  const booked = await book();
  await setJob(shopId(), booked.id,
    "booking_state = 'scheduled', requested_job_date = ?, requested_mechanic_id = ?, requested_start_time = '14:00', requested_end_time = '15:00'",
    nextDay(), sam);
  assert.equal((await link.read(booked.code)).body.requested, null);
});

test('the link says when staff declined the last change', async () => {
  const booked = await book();
  await setJob(shopId(), booked.id, "booking_state = 'scheduled', change_declined_at = now()");
  assert.equal((await link.read(booked.code)).body.changeDeclined, true);
});
