// An unconfirmed booking moves at once through its private link (piece 12,
// decision 4): it stays awaiting confirmation, its hold moves with it, and
// the new time passes every check a new booking's time passes - with the
// booking's own time never counted against itself.
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
  linkActions, bookOnline, tryBooking, liveHolds, jobRow, setJob, dayMaker, holdBookingLock, stillWaiting,
} from './helpers/linkActions.js';

let server;
let owner;
let sam;
let alex;
let types;
let customer;
let link;
const nextDay = dayMaker();
const PINNED_TODAY = shopToday('Europe/London', new Date(TEST_CLOCK_PIN));
const TOO_SOON = "That's too soon for the shop - please choose a later time or day.";

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  alex = await seedMechanic(owner.shop.id, { name: 'Alex' });
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
const book = (jobDate = nextDay(), startTime = '10:00') => bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, {
  mechanicId: sam, jobDate, startTime, serviceIds: [types.repair],
});
const shopId = () => owner.shop.id;

test('an unconfirmed booking moves at once and stays awaiting confirmation', async () => {
  const booked = await book();
  const to = nextDay();
  const res = await link.change(booked.code, { jobDate: to, mechanicId: sam, startTime: '14:00' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.jobDate, to);
  assert.equal(res.body.startTime, '14:00');
  assert.equal(res.body.stage, 'awaiting_confirmation');
  assert.equal(res.body.requested, null);
  const row = await jobRow(shopId(), booked.id);
  assert.deepEqual({ d: row.job_date, s: row.start_time, e: row.end_time, b: row.booking_state }, { d: to, s: '14:00', e: '15:00', b: 'pending' });
  assert.deepEqual(await liveHolds(shopId(), booked.id), [{ job_date: to, start_time: '14:00', mechanic_id: sam, purpose: 'booking' }]);
});

test('an unconfirmed booking can move to another mechanic', async () => {
  const booked = await book();
  const res = await link.change(booked.code, { jobDate: booked.jobDate, mechanicId: alex, startTime: '10:00' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal((await jobRow(shopId(), booked.id)).mechanic_id, alex);
  assert.equal((await liveHolds(shopId(), booked.id))[0].mechanic_id, alex);
});

test('moving within its own time does not collide with itself', async () => {
  const booked = await book(); // 10:00-11:00
  const res = await link.change(booked.code, { jobDate: booked.jobDate, mechanicId: sam, startTime: '10:30' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
});

test("an unconfirmed booking cannot move into another booking's time", async () => {
  const day = nextDay();
  await book(day, '14:00');
  const mine = await book();
  const res = await link.change(mine.code, { jobDate: day, mechanicId: sam, startTime: '14:30' });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, {
    error: 'That mechanic is already booked over part of that window - please choose another time.', code: 'capacity',
  });
});

test("a day before the shop's today is refused", async () => {
  const booked = await book();
  const d = new Date(`${PINNED_TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  const res = await link.change(booked.code, { jobDate: d.toISOString().slice(0, 10), mechanicId: sam, startTime: '10:00' });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: 'That date has passed - please choose another day.' });
});

test("a time sooner than the shop's notice is refused", async () => {
  const booked = await book();
  // 07:00 on the pinned day plus 2h50 makes 09:50 the earliest start.
  const put = await staff('/api/workshop-settings', { method: 'PUT', body: { minNoticeMinutes: 170 } });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  const res = await link.change(booked.code, { jobDate: PINNED_TODAY, mechanicId: sam, startTime: '09:30' });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: TOO_SOON });
});

test("time the mechanic isn't available is refused", async () => {
  const booked = await book();
  const day = nextDay();
  const block = await staff('/api/workshop-unavailability', {
    method: 'POST', body: { kind: 'dates', mechanicId: sam, startDate: day, endDate: day, startTime: '13:00', endTime: '15:00', reason: 'Dentist' },
  });
  assert.equal(block.status, 201, JSON.stringify(block.body));
  const res = await link.change(booked.code, { jobDate: day, mechanicId: sam, startTime: '14:00' });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: 'That mechanic is unavailable at that time - please choose another time or day.' });
});

test("a day without the mechanic's free minutes is refused", async () => {
  const booked = await book();
  const day = nextDay();
  // 09:00-18:00 is 540 minutes; 500 of them taken leaves 40, short of the hour.
  const big = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Rebuild', jobDate: day, mechanicId: sam, plannedMinutes: 500 } });
  assert.equal(big.status, 201, JSON.stringify(big.body));
  const res = await link.change(booked.code, { jobDate: day, mechanicId: sam, startTime: '10:00' });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, {
    error: 'That mechanic does not have enough free time that day - please choose another day, or a shorter job.', code: 'capacity',
  });
});

test("the booking's own minutes are not counted against its new time on the same day", async () => {
  const day = nextDay();
  const booked = await book(day, '10:00');
  // 540 - 60 (this booking) - 440 = 40 free with it counted; 100 without.
  const big = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Rebuild', jobDate: day, mechanicId: sam, plannedMinutes: 440 } });
  assert.equal(big.status, 201, JSON.stringify(big.body));
  const res = await link.change(booked.code, { jobDate: day, mechanicId: sam, startTime: '14:00' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
});

test('a change needs a real date and a mechanic', async () => {
  const booked = await book();
  const noDate = await link.change(booked.code, { jobDate: '2026-02-30', mechanicId: sam, startTime: '10:00' });
  assert.deepEqual([noDate.status, noDate.body], [400, { error: 'A valid date is required' }]);
  const noMechanic = await link.change(booked.code, { jobDate: nextDay(), startTime: '10:00' });
  assert.deepEqual([noMechanic.status, noMechanic.body], [400, { error: 'Please choose a mechanic' }]);
});

test('change refuses a made-up code', async () => {
  const res = await link.change('0'.repeat(64), { jobDate: nextDay(), mechanicId: sam, startTime: '10:00' });
  assert.deepEqual([res.status, res.body], [404, { error: "We can't find that booking" }]);
  // The refusal is the whole answer: the route stops there, and the server carries on.
  assert.equal((await staff('/api/workshop-settings')).status, 200);
});

test('change refuses an expired link', async () => {
  const booked = await book();
  const d = new Date(`${PINNED_TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 31);
  await setJob(shopId(), booked.id, 'job_date = ?', d.toISOString().slice(0, 10));
  const res = await link.change(booked.code, { jobDate: nextDay(), mechanicId: sam, startTime: '10:00' });
  assert.deepEqual([res.status, res.body], [410, { error: 'This link has expired' }]);
});

test('a change waits while another booking write holds the new day', async () => {
  const booked = await book();
  const to = nextDay();
  const release = await holdBookingLock(shopId(), to);
  let pending;
  try {
    pending = link.change(booked.code, { jobDate: to, mechanicId: sam, startTime: '14:00' });
    assert.equal(await stillWaiting(pending), true, 'the change did not wait for the lock');
  } finally {
    await release();
  }
  assert.equal((await pending).status, 200);
});

test('a change and a new booking for overlapping times at once: exactly one gets it', async () => {
  const mine = await book();
  const day = nextDay();
  // 14:00-15:00 and 14:30-15:30 overlap but start apart, so only the lock and
  // the overlap check - never the hold index - can keep them apart. The day's
  // lock is held from here until both are waiting on it, so neither can check
  // before the other is ready, and a write that skips the lock shows at once.
  const release = await holdBookingLock(shopId(), day);
  let both;
  try {
    both = [
      link.change(mine.code, { jobDate: day, mechanicId: sam, startTime: '14:00' }),
      tryBooking(server.baseUrl, customer.cookie, owner.shop.slug, { mechanicId: sam, jobDate: day, startTime: '14:30', serviceIds: [types.repair] }),
    ];
    assert.equal(await stillWaiting(both[0]), true, 'the change did not wait for the lock');
    assert.equal(await stillWaiting(both[1], 50), true, 'the booking did not wait for the lock');
  } finally {
    await release();
  }
  const [moved, booked] = await Promise.all(both);
  const won = [moved.status === 200, booked.status === 201].filter(Boolean).length;
  assert.equal(won, 1, JSON.stringify([moved, booked]));
  const loser = moved.status === 200 ? booked : moved;
  assert.equal(loser.status, 409, JSON.stringify(loser.body));
  assert.equal(loser.body.code, 'capacity');
});

test('a bike already in the shop cannot be moved through the link', async () => {
  const booked = await book();
  await setJob(shopId(), booked.id, "booking_state = 'scheduled', custody_state = 'in_shop'");
  const res = await link.change(booked.code, { jobDate: nextDay(), mechanicId: sam, startTime: '10:00' });
  assert.deepEqual([res.status, res.body], [409, {
    error: 'Your bike is already with the shop - please contact them to change it', code: 'in_shop',
  }]);
});

// Once work has started, or once the booking's day has passed, the customer
// is told to contact the shop - the same words as a bike already there (Jack, 27 Sep).
const IN_SHOP_CHANGE = { error: 'Your bike is already with the shop - please contact them to change it', code: 'in_shop' };
const daysFromToday = (n) => {
  const d = new Date(`${PINNED_TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

for (const status of ['waiting_parts', 'complete']) {
  test(`once work has started (${status}) the booking cannot be moved through the link`, async () => {
    const booked = await book();
    const saved = await staff(`/api/workshop-jobs/${booked.id}`, { method: 'PUT', body: { status } });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal((await jobRow(shopId(), booked.id)).custody_state, 'expected', 'the bike has not been marked in the shop');
    const res = await link.change(booked.code, { jobDate: nextDay(), mechanicId: sam, startTime: '10:00' });
    assert.deepEqual([res.status, res.body], [409, IN_SHOP_CHANGE]);
    const row = await jobRow(shopId(), booked.id);
    assert.deepEqual([row.job_date, row.booking_state, row.requested_job_date], [booked.jobDate, 'scheduled', null]);
  });
}

test('once the booking day has passed it cannot be moved through the link', async () => {
  const booked = await book();
  const yesterday = daysFromToday(-1);
  await setJob(shopId(), booked.id, 'job_date = ?', yesterday);
  const res = await link.change(booked.code, { jobDate: nextDay(), mechanicId: sam, startTime: '10:00' });
  assert.deepEqual([res.status, res.body], [409, IN_SHOP_CHANGE]);
  assert.equal((await jobRow(shopId(), booked.id)).job_date, yesterday);
});

test('on the booking day itself the customer may still move it', async () => {
  const booked = await book();
  await setJob(shopId(), booked.id, 'job_date = ?', PINNED_TODAY);
  const to = nextDay();
  const res = await link.change(booked.code, { jobDate: to, mechanicId: sam, startTime: '14:00' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal((await jobRow(shopId(), booked.id)).job_date, to);
});

// Last: moves a date far ahead to drop-off, so nothing else in this file meets it.
test('a drop-off day takes the day, not a time', async () => {
  const far = new Date(`${nextDay()}T00:00:00Z`);
  far.setUTCDate(far.getUTCDate() + 150);
  const dropDay = far.toISOString().slice(0, 10);
  const put = await staff('/api/workshop-settings', { method: 'PUT', body: { nextBookingMode: 'dropoff', nextBookingModeFrom: dropDay } });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  const booked = await book();
  const timed = await link.change(booked.code, { jobDate: dropDay, mechanicId: sam, startTime: '10:00' });
  assert.equal(timed.status, 400, JSON.stringify(timed.body));
  assert.deepEqual(timed.body, { error: 'This shop takes drop-offs on that day - choose the day, not a time.' });
  const day = await link.change(booked.code, { jobDate: dropDay, mechanicId: sam });
  assert.equal(day.status, 200, JSON.stringify(day.body));
  assert.equal(day.body.startTime, '');
});
