// The days and times a booking could move to, through its link (Jack, 20 Oct:
// Change the date; openspec/changes/change-date): for the booking's own
// mechanic and length, with the booking itself left out, so its own slot can
// be chosen again. Link calls in this file must stay under 30 (the limiter).
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
import { jsonRequest } from './helpers/http.js';
import { bookOnline, setJob, dayMaker } from './helpers/linkActions.js';

let server;
let owner;
let sam;
let jo;
let types;
let customer;
const nextDay = dayMaker();
const PINNED_TODAY = shopToday('Europe/London', new Date(TEST_CLOCK_PIN));

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  jo = await seedMechanic(owner.shop.id, { name: 'Jo', workingDays: [1, 2, 3, 4, 5] });
  types = await seedJobTypes(owner.shop.id);
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const book = (jobDate, startTime = '10:00', mechanicId = sam) => bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, {
  mechanicId, jobDate, startTime, serviceIds: [types.repair],
});
const days = (code, start, end = start) => jsonRequest(server.baseUrl, null,
  `/api/portal/${owner.shop.slug}/booking-links/${code}/availability?start=${start}&end=${end}`);
const plusDays = (date, n) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

test('the booking’s mechanic and length, and its own slot offered again', async () => {
  const day = nextDay();
  const booked = await book(day, '10:00');
  const res = await days(booked.code, day);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.mechanicId, sam);
  assert.equal(res.body.minutes, 60);
  assert.equal(res.body.days.length, 1);
  const [d] = res.body.days;
  assert.equal(d.date, day);
  assert.equal(d.mode, 'timed');
  assert.equal(d.closed, false);
  assert.ok(d.startTimes.includes('10:00'), JSON.stringify(d.startTimes));
});

// So the offer and the change route can't drift apart (fresh review).
test('a time it offers is one the change route takes', async () => {
  const day = nextDay();
  const booked = await book(day, '10:00');
  const { mechanicId, days: [d] } = (await days(booked.code, day)).body;
  const other = d.startTimes.find((t) => t !== '10:00');
  const res = await jsonRequest(server.baseUrl, null, `/api/portal/${owner.shop.slug}/booking-links/${booked.code}/change`, {
    method: 'POST', body: { jobDate: day, mechanicId, startTime: other },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.startTime, other);
});

test('another booking’s time isn’t offered', async () => {
  const day = nextDay();
  const mine = await book(day, '10:00');
  await book(day, '14:00');
  const { startTimes } = (await days(mine.code, day)).body.days[0];
  assert.ok(!startTimes.includes('14:00'), JSON.stringify(startTimes));
  assert.ok(!startTimes.includes('13:30'), 'a 60-minute job at 13:30 runs into 14:00');
  assert.ok(startTimes.includes('10:00'));
});

test('a day the mechanic doesn’t work is closed, and a day gone by offers nothing', async () => {
  const day = nextDay();
  const booked = await book(day, '10:00', jo); // Jo works Monday to Friday
  const week = (await days(booked.code, day, plusDays(day, 6))).body.days;
  const closed = week.find((d) => d.closed);
  assert.ok(closed, 'a week has a day the mechanic isn’t working');
  assert.deepEqual(closed.startTimes, []);
  const past = (await days(booked.code, plusDays(PINNED_TODAY, -1))).body.days[0];
  assert.deepEqual(past.startTimes, []);
});

test('bad dates are refused, and an unknown link isn’t found', async () => {
  const day = nextDay();
  const booked = await book(day);
  assert.equal((await days(booked.code, 'nope', day)).status, 400);
  assert.equal((await days(booked.code, day, plusDays(day, -1))).status, 400);
  assert.equal((await days(booked.code, day, plusDays(day, 200))).status, 400);
  assert.equal((await days('c'.repeat(64), day)).status, 404);
});

test('a booking that can’t be changed online, or has no mechanic, is refused as the change route refuses it', async () => {
  const day = nextDay();
  const booked = await book(day);
  await setJob(owner.shop.id, booked.id, "custody_state = 'in_shop'");
  const inShop = await days(booked.code, day);
  assert.equal(inShop.status, 409);
  assert.deepEqual(inShop.body, { error: 'Your bike is already with the shop - please contact them to change it', code: 'in_shop' });
  await setJob(owner.shop.id, booked.id, "custody_state = 'expected', booking_state = 'cancelled'");
  const cancelled = await days(booked.code, day);
  assert.equal(cancelled.status, 409);
  assert.deepEqual(cancelled.body, { error: "This booking can't be changed online", code: 'illegal' });
  await setJob(owner.shop.id, booked.id, "booking_state = 'scheduled', mechanic_id = NULL");
  const noMechanic = await days(booked.code, day);
  assert.equal(noMechanic.status, 409);
  assert.deepEqual(noMechanic.body, { error: "This booking can't be changed online", code: 'illegal' });
});

// Last: moves a date far ahead to drop-off, so nothing else in this file meets it.
test('a drop-off day says whether the booking fits, with the window', async () => {
  const booked = await book(nextDay());
  const far = plusDays(nextDay(), 150);
  const put = await staff('/api/workshop-settings', { method: 'PUT', body: { nextBookingMode: 'dropoff', nextBookingModeFrom: far, dropoffWindowStart: '09:00', dropoffWindowEnd: '10:00' } });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  const res = await days(booked.code, far, plusDays(far, 6));
  const open = res.body.days.find((d) => !d.closed);
  assert.equal(open.mode, 'dropoff');
  assert.equal(open.bookable, true);
  assert.deepEqual(open.dropoffWindow, { start: '09:00', end: '10:00' });
  assert.equal(open.startTimes, undefined);
});
