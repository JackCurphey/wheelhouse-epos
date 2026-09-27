// Staff answer a customer's change request (piece 12): accept moves the
// booking to the requested time and leaves it one hold - the requested one;
// decline keeps the original time and tells the customer's link. Both need the
// version staff last read. The old accept/decline refuse a change request, and
// a staff cancellation is recorded as the shop's.
// The old diary's save keeps a request, and dropping the job onto exactly
// the requested time accepts it; every staff end of a request clears it.
// Spec: docs/superpowers/specs/2026-09-27-book-server-12-change-cancel-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedJobTypes } from './helpers/bookable.js';
import { seedWorkshopJob } from './helpers/workshopFixtures.js';
import {
  linkActions, bookOnline, tryBooking, liveHolds, jobRow, setJob, dayMaker, holdBookingLock, stillWaiting,
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

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const act = (id, action, body) => staff(`/api/workshop-jobs/${id}/${action}`, { method: 'POST', body });
const read = async (id) => (await staff(`/api/workshop-jobs/${id}`)).body;
const shopId = () => owner.shop.id;

// A confirmed 10:00-11:00 booking with Sam whose customer asked for 14:00 on another day.
async function requested() {
  const booked = await bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, {
    mechanicId: sam, jobDate: nextDay(), startTime: '10:00', serviceIds: [types.repair],
  });
  assert.equal((await act(booked.id, 'accept', { version: 1 })).status, 200);
  const to = nextDay();
  const res = await link.change(booked.code, { jobDate: to, mechanicId: sam, startTime: '14:00' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return { ...booked, to };
}

test('the staff job view shows the request', async () => {
  const job = await requested();
  const view = await read(job.id);
  assert.deepEqual(view.requested, { jobDate: job.to, startTime: '14:00', endTime: '15:00', mechanicId: sam });
  assert.equal(view.bookingState, 'reschedule_requested');
  assert.deepEqual(
    [view.cancelledBy, view.cancelledAt, view.cancellationSeenAt, view.changeDeclinedAt],
    [null, null, null, null]
  );
});

test('accepting a change moves the booking and leaves it one hold', async () => {
  const job = await requested();
  const res = await act(job.id, 'accept-change', { version: (await read(job.id)).version });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(
    { d: res.body.jobDate, s: res.body.startTime, e: res.body.endTime, b: res.body.bookingState, r: res.body.requested },
    { d: job.to, s: '14:00', e: '15:00', b: 'scheduled', r: null }
  );
  assert.deepEqual(await liveHolds(shopId(), job.id), [{ job_date: job.to, start_time: '14:00', mechanic_id: sam, purpose: 'booking' }]);
});

test('the requested hold becomes the booking hold', async () => {
  const job = await requested();
  const holdId = () => runWithShop(shopId(), () => prepare(
    "SELECT id FROM workshop_capacity_holds WHERE workshop_job_id = ? AND state IN ('held', 'confirmed') AND job_date = ?"
  ).get(job.id, job.to));
  const before = (await holdId()).id;
  assert.equal((await act(job.id, 'accept-change', { version: (await read(job.id)).version })).status, 200);
  assert.equal((await holdId()).id, before);
});

test('accepting when the requested time is no longer free is refused and changes nothing', async () => {
  const job = await requested();
  // A job written straight into the table, past every check, over the requested time.
  await seedWorkshopJob({ shopId: shopId(), customerId: null, mechanicId: sam, jobDate: job.to, startTime: '14:30', endTime: '15:30', legacyStatus: 'scheduled' });
  const res = await act(job.id, 'accept-change', { version: (await read(job.id)).version });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: 'The requested time is no longer free', code: 'capacity' });
  assert.equal((await read(job.id)).bookingState, 'reschedule_requested');
});

test('accepting with a stale version is refused', async () => {
  const job = await requested();
  const res = await act(job.id, 'accept-change', { version: 1 });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: 'This job changed while you were looking at it. Reload and try again.', code: 'stale' });
  assert.equal((await read(job.id)).bookingState, 'reschedule_requested');
});

test('accepting needs a version', async () => {
  const job = await requested();
  const res = await act(job.id, 'accept-change', {});
  assert.deepEqual([res.status, res.body], [400, { error: 'version is required - send the version you last read' }]);
});

test('there is nothing to accept on a booking with no request', async () => {
  const booked = await bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, {
    mechanicId: sam, jobDate: nextDay(), startTime: '10:00', serviceIds: [types.repair],
  });
  const res = await act(booked.id, 'accept-change', { version: 1 });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: "There's no change request to accept", code: 'illegal' });
});

test('declining a change keeps the original time and tells the customer', async () => {
  const job = await requested();
  const res = await act(job.id, 'decline-change', { version: (await read(job.id)).version });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.jobDate, job.jobDate);
  assert.equal(res.body.bookingState, 'scheduled');
  assert.equal(res.body.requested, null);
  assert.ok(res.body.changeDeclinedAt, 'changeDeclinedAt is set');
  const onLink = await link.read(job.code);
  assert.equal(onLink.body.changeDeclined, true);
  assert.equal(onLink.body.stage, 'confirmed');
});

test('declining a change lets the requested time go', async () => {
  const job = await requested();
  assert.equal((await act(job.id, 'decline-change', { version: (await read(job.id)).version })).status, 200);
  // The exact slot: only a hold left behind could refuse it now.
  const other = await tryBooking(server.baseUrl, customer.cookie, owner.shop.slug, {
    mechanicId: sam, jobDate: job.to, startTime: '14:00', serviceIds: [types.repair],
  });
  assert.equal(other.status, 201, JSON.stringify(other.body));
});

test('declining with a stale version is refused', async () => {
  const job = await requested();
  const res = await act(job.id, 'decline-change', { version: 1 });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.code, 'stale');
});

test('there is nothing to decline on a booking with no request', async () => {
  const booked = await bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, {
    mechanicId: sam, jobDate: nextDay(), startTime: '10:00', serviceIds: [types.repair],
  });
  const res = await act(booked.id, 'decline-change', { version: 1 });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: "There's no change request to decline", code: 'illegal' });
});

test("the old accept and decline refuse a customer's change request", async () => {
  const job = await requested();
  const version = (await read(job.id)).version;
  for (const action of ['accept', 'decline']) {
    const res = await act(job.id, action, { version });
    assert.equal(res.status, 409, `${action}: ${JSON.stringify(res.body)}`);
    assert.deepEqual(res.body, {
      error: 'This booking has a change request from the customer - accept or decline the change instead', code: 'illegal',
    });
  }
});

test("a staff cancellation is recorded as the shop's", async () => {
  const booked = await bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, {
    mechanicId: sam, jobDate: nextDay(), startTime: '10:00', serviceIds: [types.repair],
  });
  const res = await act(booked.id, 'cancel', { version: 1 });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.cancelledBy, 'staff');
  assert.ok(res.body.cancelledAt, 'cancelledAt is set');
});

test('a staff cancellation forgets a declined change', async () => {
  const booked = await bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, {
    mechanicId: sam, jobDate: nextDay(), startTime: '10:00', serviceIds: [types.repair],
  });
  await setJob(shopId(), booked.id, 'change_declined_at = now()');
  const res = await act(booked.id, 'cancel', { version: 1 });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.changeDeclinedAt, null);
  assert.equal((await jobRow(shopId(), booked.id)).change_declined_at, null);
});

test('accepting a change waits while another booking write holds the requested day', async () => {
  const job = await requested();
  const version = (await read(job.id)).version;
  const release = await holdBookingLock(shopId(), job.to);
  let pending;
  try {
    pending = act(job.id, 'accept-change', { version });
    assert.equal(await stillWaiting(pending), true, 'accept-change did not wait for the lock');
  } finally {
    await release();
  }
  assert.equal((await pending).status, 200);
});


// The stored request's five columns, as the job row holds them.
const requestColumns = async (id) => {
  const row = await jobRow(shopId(), id);
  return [row.requested_job_date, row.requested_mechanic_id, row.requested_start_time, row.requested_end_time, row.requested_at];
};
const legacySave = (id, body) => staff(`/api/workshop-jobs/${id}`, { method: 'PUT', body });

test("the old diary's ordinary save keeps the customer's request and its hold", async () => {
  const job = await requested();
  // The form save sends the status the diary shows: 'scheduled' for a request.
  const res = await legacySave(job.id, { notes: 'Rang to confirm', status: 'scheduled' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.bookingState, 'reschedule_requested');
  assert.deepEqual(res.body.requested, { jobDate: job.to, startTime: '14:00', endTime: '15:00', mechanicId: sam });
  assert.deepEqual(await liveHolds(shopId(), job.id), [
    { job_date: job.jobDate, start_time: '10:00', mechanic_id: sam, purpose: 'booking' },
    { job_date: job.to, start_time: '14:00', mechanic_id: sam, purpose: 'requested' },
  ]);
  // scan-2: an ordinary legacy save must not drop the request from "Waiting for you".
  const waiting = await staff('/api/workshop-waiting');
  assert.equal(waiting.status, 200, JSON.stringify(waiting.body));
  const item = waiting.body.items.find((i) => i.jobId === job.id);
  assert.equal(item?.kind, 'change_request', JSON.stringify(waiting.body));
});

test('dropping a job onto exactly its requested time in the old diary accepts the change', async () => {
  const job = await requested();
  const res = await legacySave(job.id, { jobDate: job.to, startTime: '14:00', endTime: '15:00' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(
    { d: res.body.jobDate, s: res.body.startTime, b: res.body.bookingState, r: res.body.requested },
    { d: job.to, s: '14:00', b: 'scheduled', r: null }
  );
  assert.deepEqual(await requestColumns(job.id), [null, null, null, null, null]);
  assert.deepEqual(await liveHolds(shopId(), job.id), [{ job_date: job.to, start_time: '14:00', mechanic_id: sam, purpose: 'booking' }]);
});

test('dropping a job anywhere else in the old diary leaves the request standing', async () => {
  const job = await requested();
  const res = await legacySave(job.id, { startTime: '12:00', endTime: '13:00' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.bookingState, 'reschedule_requested');
  assert.deepEqual(res.body.requested, { jobDate: job.to, startTime: '14:00', endTime: '15:00', mechanicId: sam });
  assert.deepEqual(await liveHolds(shopId(), job.id), [
    { job_date: job.jobDate, start_time: '12:00', mechanic_id: sam, purpose: 'booking' },
    { job_date: job.to, start_time: '14:00', mechanic_id: sam, purpose: 'requested' },
  ]);
});

test('an old diary status change that ends a request clears it and lets its time go', async () => {
  const job = await requested();
  const res = await legacySave(job.id, { status: 'pending' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.bookingState, 'pending');
  assert.deepEqual(await requestColumns(job.id), [null, null, null, null, null]);
  assert.deepEqual(await liveHolds(shopId(), job.id), [{ job_date: job.jobDate, start_time: '10:00', mechanic_id: sam, purpose: 'booking' }]);
});

test('a staff cancellation of a requested booking clears the request', async () => {
  const job = await requested();
  const res = await act(job.id, 'cancel', { version: (await read(job.id)).version });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(await requestColumns(job.id), [null, null, null, null, null]);
  assert.deepEqual(await liveHolds(shopId(), job.id), []);
});

test('accepting and declining a change clear every requested field', async () => {
  for (const answer of ['accept-change', 'decline-change']) {
    const job = await requested();
    assert.equal((await act(job.id, answer, { version: (await read(job.id)).version })).status, 200);
    assert.deepEqual(await requestColumns(job.id), [null, null, null, null, null], answer);
  }
});

test("a staff reschedule request never holds a time the customer didn't ask for", async () => {
  const booked = await bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, {
    mechanicId: sam, jobDate: nextDay(), startTime: '10:00', serviceIds: [types.repair],
  });
  assert.equal((await act(booked.id, 'accept', { version: 1 })).status, 200);
  // Request columns left behind on a confirmed booking, as older code could leave them.
  await setJob(shopId(), booked.id, "requested_job_date = ?, requested_mechanic_id = ?, requested_start_time = '14:00', requested_end_time = '15:00'",
    nextDay(), sam);
  const res = await act(booked.id, 'request-reschedule', { version: 2 });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.bookingState, 'reschedule_requested');
  assert.equal(res.body.requested, null);
  assert.deepEqual(await liveHolds(shopId(), booked.id), [{ job_date: booked.jobDate, start_time: '10:00', mechanic_id: sam, purpose: 'booking' }]);
});

test('dropping a job onto its requested start with a different length accepts the change', async () => {
  const job = await requested();
  const res = await legacySave(job.id, { jobDate: job.to, startTime: '14:00', endTime: '15:30' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(
    { d: res.body.jobDate, s: res.body.startTime, e: res.body.endTime, b: res.body.bookingState, r: res.body.requested },
    { d: job.to, s: '14:00', e: '15:30', b: 'scheduled', r: null }
  );
  assert.deepEqual(await requestColumns(job.id), [null, null, null, null, null]);
  assert.deepEqual(await liveHolds(shopId(), job.id), [{ job_date: job.to, start_time: '14:00', mechanic_id: sam, purpose: 'booking' }]);
});
