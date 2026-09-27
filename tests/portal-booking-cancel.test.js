// The booking link says what the customer may do (piece 12): change or cancel
// while the bike has not reached the shop and the booking is live, the change
// they asked for, and whether staff declined their last one. Then cancelling
// through the link (Task 4).
// Link calls in this file must stay under 30 (the limiter is per server).
// Spec: docs/superpowers/specs/2026-09-27-book-server-12-change-cancel-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer, TEST_CLOCK_PIN } from './helpers/liveServer.js';
import { shopToday } from '../server/clock.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedJobTypes } from './helpers/bookable.js';
import {
  linkActions, bookOnline, liveHolds, jobRow, setJob, seedRequest, dayMaker, holdBookingLock, stillWaiting,
} from './helpers/linkActions.js';

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

// ---- Cancelling (Task 4) ----

const accept = (id) => staffRequest(server.baseUrl, owner.cookie, `/api/workshop-jobs/${id}/accept`, { method: 'POST', body: { version: 1 } });
const holdsOf = (id) => liveHolds(shopId(), id);
const IN_SHOP = { error: 'Your bike is already with the shop - please contact them to cancel', code: 'in_shop' };

test('cancelling an unconfirmed booking frees its time and records the customer', async () => {
  const booked = await book();
  const res = await link.cancel(booked.code);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.stage, 'cancelled');
  assert.equal(res.body.canCancel, false);
  const row = await jobRow(shopId(), booked.id);
  assert.equal(row.booking_state, 'cancelled');
  assert.equal(row.cancelled_by, 'customer');
  assert.ok(row.cancelled_at, 'cancelled_at is set');
  assert.deepEqual(await holdsOf(booked.id), []);
});

test('cancelling a confirmed booking works the same', async () => {
  const booked = await book();
  assert.equal((await accept(booked.id)).status, 200);
  const res = await link.cancel(booked.code);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.stage, 'cancelled');
  assert.deepEqual(await holdsOf(booked.id), []);
});

test('cancelling a booking with a change request lets both times go and forgets the request', async () => {
  const booked = await book();
  assert.equal((await accept(booked.id)).status, 200);
  await seedRequest(shopId(), booked.id, { jobDate: nextDay(), mechanicId: sam });
  assert.deepEqual((await holdsOf(booked.id)).map((h) => h.purpose), ['booking', 'requested'], 'both times are held first');
  const res = await link.cancel(booked.code);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.requested, null);
  const row = await jobRow(shopId(), booked.id);
  assert.deepEqual(
    [row.requested_job_date, row.requested_mechanic_id, row.requested_start_time, row.requested_end_time, row.requested_at],
    [null, null, null, null, null],
  );
  assert.deepEqual(await holdsOf(booked.id), []);
});

test('a bike already with the shop cannot be cancelled online', async () => {
  const booked = await book();
  await setJob(shopId(), booked.id, "booking_state = 'scheduled', custody_state = 'in_shop'");
  const res = await link.cancel(booked.code);
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, IN_SHOP);
  assert.equal((await jobRow(shopId(), booked.id)).booking_state, 'scheduled');
});

test('a declined booking cannot be cancelled online', async () => {
  const booked = await book();
  await setJob(shopId(), booked.id, "booking_state = 'declined'");
  const res = await link.cancel(booked.code);
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: "This booking can't be cancelled online", code: 'illegal' });
});

test('cancelling forgets a declined change', async () => {
  const booked = await book();
  await setJob(shopId(), booked.id, 'change_declined_at = now()');
  const res = await link.cancel(booked.code);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.changeDeclined, false);
  assert.equal((await jobRow(shopId(), booked.id)).change_declined_at, null);
});

test('cancel refuses a made-up code', async () => {
  const res = await link.cancel('0'.repeat(64));
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, { error: "We can't find that booking" });
});

test('cancel refuses an expired link', async () => {
  const booked = await book();
  const today = shopToday('Europe/London', new Date(TEST_CLOCK_PIN));
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 31);
  await setJob(shopId(), booked.id, 'job_date = ?', d.toISOString().slice(0, 10));
  const res = await link.cancel(booked.code);
  assert.equal(res.status, 410);
  assert.deepEqual(res.body, { error: 'This link has expired' });
  assert.equal((await jobRow(shopId(), booked.id)).booking_state, 'pending');
});

test('a cancel waits while another booking write holds its day', async () => {
  const booked = await book();
  const release = await holdBookingLock(shopId(), booked.jobDate);
  let pending;
  try {
    pending = link.cancel(booked.code);
    assert.equal(await stillWaiting(pending), true, 'the cancel did not wait for the lock');
  } finally {
    await release();
  }
  assert.equal((await pending).status, 200);
});

// ---- When the link stops offering a change or cancel (Jack, 27 Sep) ----
// Once work has started, or once the booking's day has passed, the customer
// is told to contact the shop - the same words as a bike already there.

const PINNED_TODAY = shopToday('Europe/London', new Date(TEST_CLOCK_PIN));
const daysFromToday = (n) => {
  const d = new Date(`${PINNED_TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const legacySave = (id, status) =>
  staffRequest(server.baseUrl, owner.cookie, `/api/workshop-jobs/${id}`, { method: 'PUT', body: { status } });

for (const status of ['waiting_parts', 'complete']) {
  test(`once work has started (${status}) the link offers neither and refuses to cancel`, async () => {
    const booked = await book();
    const saved = await legacySave(booked.id, status);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const before = await jobRow(shopId(), booked.id);
    assert.equal(before.custody_state, 'expected', 'the bike has not been marked in the shop');
    assert.equal(before.work_state, status);
    const view = await link.read(booked.code);
    assert.equal(view.body.canChange, false);
    assert.equal(view.body.canCancel, false);
    const res = await link.cancel(booked.code);
    assert.equal(res.status, 409, JSON.stringify(res.body));
    assert.deepEqual(res.body, IN_SHOP);
    assert.equal((await jobRow(shopId(), booked.id)).booking_state, 'scheduled');
  });
}

test('once the booking day has passed the link offers neither and refuses to cancel', async () => {
  const booked = await book();
  await setJob(shopId(), booked.id, 'job_date = ?', daysFromToday(-1));
  const view = await link.read(booked.code);
  assert.equal(view.status, 200, JSON.stringify(view.body));
  assert.equal(view.body.canChange, false);
  assert.equal(view.body.canCancel, false);
  const res = await link.cancel(booked.code);
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, IN_SHOP);
  assert.equal((await jobRow(shopId(), booked.id)).booking_state, 'pending');
});

test('on the booking day itself the customer may still cancel', async () => {
  const booked = await book();
  await setJob(shopId(), booked.id, 'job_date = ?', PINNED_TODAY);
  const view = await link.read(booked.code);
  assert.equal(view.body.canChange, true);
  assert.equal(view.body.canCancel, true);
  const res = await link.cancel(booked.code);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.stage, 'cancelled');
});

// ---- A double-tapped cancel (final review) ----

test('cancelling again after the customer cancelled shows the cancelled booking and changes nothing', async () => {
  const booked = await book();
  assert.equal((await link.cancel(booked.code)).status, 200);
  const first = await jobRow(shopId(), booked.id);
  const res = await link.cancel(booked.code);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.stage, 'cancelled');
  const again = await jobRow(shopId(), booked.id);
  assert.equal(again.version, first.version);
  assert.deepEqual(again.cancelled_at, first.cancelled_at);
});

test('a booking the shop cancelled still cannot be cancelled online', async () => {
  const booked = await book();
  await setJob(shopId(), booked.id, "booking_state = 'cancelled', cancelled_by = 'staff', cancelled_at = now()");
  const res = await link.cancel(booked.code);
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: "This booking can't be cancelled online", code: 'illegal' });
});
