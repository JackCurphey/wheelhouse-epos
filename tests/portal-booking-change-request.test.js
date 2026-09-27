// A confirmed booking's change is a request staff answer (piece 12, decisions
// 2 and 6): the booking keeps its time, the requested time is held too, a new
// request replaces the old, and the customer can withdraw it.
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
  linkActions, bookOnline, liveHolds, jobRow, setJob, dayMaker, holdBookingLock, stillWaiting,
} from './helpers/linkActions.js';

let server;
let owner;
let sam;
let types;
let customer;
let link;
const nextDay = dayMaker();
const PINNED_TODAY = shopToday('Europe/London', new Date(TEST_CLOCK_PIN));

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

const shopId = () => owner.shop.id;
// A confirmed booking at 10:00-11:00 with Sam.
async function confirmed(jobDate = nextDay()) {
  const booked = await bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, {
    mechanicId: sam, jobDate, startTime: '10:00', serviceIds: [types.repair],
  });
  const accepted = await staffRequest(server.baseUrl, owner.cookie, `/api/workshop-jobs/${booked.id}/accept`, { method: 'POST', body: { version: 1 } });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  return booked;
}
const own = (booked) => ({ job_date: booked.jobDate, start_time: '10:00', mechanic_id: sam, purpose: 'booking' });
const wantedHold = (jobDate, start = '14:00') => ({ job_date: jobDate, start_time: start, mechanic_id: sam, purpose: 'requested' });

test('asking to move a confirmed booking holds both times', async () => {
  const booked = await confirmed();
  const to = nextDay();
  const res = await link.change(booked.code, { jobDate: to, mechanicId: sam, startTime: '14:00' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.stage, 'change_requested');
  assert.deepEqual(res.body.requested, { jobDate: to, startTime: '14:00', mechanicId: sam });
  assert.deepEqual(await liveHolds(shopId(), booked.id), [own(booked), wantedHold(to)]);
});

test('a request keeps the booking where it is until staff answer', async () => {
  const booked = await confirmed();
  const res = await link.change(booked.code, { jobDate: nextDay(), mechanicId: sam, startTime: '14:00' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.jobDate, booked.jobDate);
  const row = await jobRow(shopId(), booked.id);
  assert.deepEqual({ d: row.job_date, s: row.start_time, b: row.booking_state }, { d: booked.jobDate, s: '10:00', b: 'reschedule_requested' });
  assert.ok(row.requested_at, 'requested_at is set');
});

test('a second request replaces the first and lets its time go', async () => {
  const booked = await confirmed();
  const first = nextDay();
  const second = nextDay();
  assert.equal((await link.change(booked.code, { jobDate: first, mechanicId: sam, startTime: '14:00' })).status, 200);
  const res = await link.change(booked.code, { jobDate: second, mechanicId: sam, startTime: '11:30' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.requested, { jobDate: second, startTime: '11:30', mechanicId: sam });
  assert.deepEqual(await liveHolds(shopId(), booked.id), [own(booked), wantedHold(second, '11:30')]);
});

test('a new request may overlap the request it replaces', async () => {
  const booked = await confirmed();
  const day = nextDay();
  assert.equal((await link.change(booked.code, { jobDate: day, mechanicId: sam, startTime: '14:00' })).status, 200);
  const res = await link.change(booked.code, { jobDate: day, mechanicId: sam, startTime: '14:30' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(await liveHolds(shopId(), booked.id), [own(booked), wantedHold(day, '14:30')]);
});

test('asking for the time already booked withdraws the request', async () => {
  const booked = await confirmed();
  assert.equal((await link.change(booked.code, { jobDate: nextDay(), mechanicId: sam, startTime: '14:00' })).status, 200);
  const res = await link.change(booked.code, { jobDate: booked.jobDate, mechanicId: sam, startTime: '10:00' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.stage, 'confirmed');
  assert.equal(res.body.requested, null);
  assert.deepEqual(await liveHolds(shopId(), booked.id), [own(booked)]);
});

test('a request passes the same time checks as a booking', async () => {
  const booked = await confirmed();
  const d = new Date(`${PINNED_TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  const res = await link.change(booked.code, { jobDate: d.toISOString().slice(0, 10), mechanicId: sam, startTime: '10:00' });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: 'That date has passed - please choose another day.' });
});

test('a request may overlap the booking it would replace', async () => {
  const booked = await confirmed(); // 10:00-11:00
  const res = await link.change(booked.code, { jobDate: booked.jobDate, mechanicId: sam, startTime: '10:30' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(await liveHolds(shopId(), booked.id), [own(booked), wantedHold(booked.jobDate, '10:30')]);
});

test('asking again forgets a declined change', async () => {
  const booked = await confirmed();
  await setJob(shopId(), booked.id, 'change_declined_at = now()');
  const res = await link.change(booked.code, { jobDate: nextDay(), mechanicId: sam, startTime: '14:00' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.changeDeclined, false);
});

test('a bike already with the shop cannot be changed online', async () => {
  const booked = await confirmed();
  await setJob(shopId(), booked.id, "custody_state = 'in_shop'");
  const res = await link.change(booked.code, { jobDate: nextDay(), mechanicId: sam, startTime: '14:00' });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: 'Your bike is already with the shop - please contact them to change it', code: 'in_shop' });
});

test('a cancelled booking cannot be changed online', async () => {
  const booked = await confirmed();
  await setJob(shopId(), booked.id, "booking_state = 'cancelled'");
  const res = await link.change(booked.code, { jobDate: nextDay(), mechanicId: sam, startTime: '14:00' });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: "This booking can't be changed online", code: 'illegal' });
});

test('withdrawing a request returns to the booking as it was', async () => {
  const booked = await confirmed();
  assert.equal((await link.change(booked.code, { jobDate: nextDay(), mechanicId: sam, startTime: '14:00' })).status, 200);
  const res = await link.withdraw(booked.code);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.stage, 'confirmed');
  assert.equal(res.body.requested, null);
  const row = await jobRow(shopId(), booked.id);
  assert.deepEqual({ b: row.booking_state, r: row.requested_job_date }, { b: 'scheduled', r: null });
  assert.deepEqual(await liveHolds(shopId(), booked.id), [own(booked)]);
});

test('withdrawing forgets a declined change', async () => {
  const booked = await confirmed();
  assert.equal((await link.change(booked.code, { jobDate: nextDay(), mechanicId: sam, startTime: '14:00' })).status, 200);
  await setJob(shopId(), booked.id, 'change_declined_at = now()');
  const res = await link.withdraw(booked.code);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.changeDeclined, false);
});

test('withdrawing when nothing was asked is refused', async () => {
  const booked = await confirmed();
  const res = await link.withdraw(booked.code);
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: "There's no change request to withdraw", code: 'illegal' });
});

test('withdraw refuses a made-up code', async () => {
  const res = await link.withdraw('0'.repeat(64));
  assert.deepEqual([res.status, res.body], [404, { error: "We can't find that booking" }]);
});

test('withdraw refuses an expired link', async () => {
  const booked = await confirmed();
  assert.equal((await link.change(booked.code, { jobDate: nextDay(), mechanicId: sam, startTime: '14:00' })).status, 200);
  const d = new Date(`${PINNED_TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 31);
  await setJob(shopId(), booked.id, 'job_date = ?', d.toISOString().slice(0, 10));
  const res = await link.withdraw(booked.code);
  assert.deepEqual([res.status, res.body], [410, { error: 'This link has expired' }]);
});

test('replacing a request waits while another booking write holds the day first asked for', async () => {
  const booked = await confirmed();
  const first = nextDay();
  assert.equal((await link.change(booked.code, { jobDate: first, mechanicId: sam, startTime: '14:00' })).status, 200);
  const release = await holdBookingLock(shopId(), first);
  let pending;
  try {
    pending = link.change(booked.code, { jobDate: nextDay(), mechanicId: sam, startTime: '14:00' });
    assert.equal(await stillWaiting(pending), true, 'the new request did not wait for the lock on the old one');
  } finally {
    await release();
  }
  assert.equal((await pending).status, 200);
});

test('two customers asking for overlapping times at once: exactly one gets it', async () => {
  const a = await confirmed();
  const b = await confirmed();
  const day = nextDay();
  // 14:00-15:00 and 14:30-15:30 overlap but start apart, so only the lock and
  // the overlap check - never the hold index - can keep them apart. The day's
  // lock is held from here until both are waiting on it, so neither can check
  // before the other is ready, and a write that skips the lock shows at once.
  const release = await holdBookingLock(shopId(), day);
  let both;
  try {
    both = [
      link.change(a.code, { jobDate: day, mechanicId: sam, startTime: '14:00' }),
      link.change(b.code, { jobDate: day, mechanicId: sam, startTime: '14:30' }),
    ];
    assert.equal(await stillWaiting(both[0]), true, 'the first request did not wait for the lock');
    assert.equal(await stillWaiting(both[1], 50), true, 'the second request did not wait for the lock');
  } finally {
    await release();
  }
  const [ra, rb] = await Promise.all(both);
  const statuses = [ra.status, rb.status].sort();
  assert.deepEqual(statuses, [200, 409], JSON.stringify([ra.body, rb.body]));
  assert.equal((ra.status === 409 ? ra : rb).body.code, 'capacity');
});
