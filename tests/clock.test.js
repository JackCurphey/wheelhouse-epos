// The shop's clock: today, now and the earliest bookable moment, in the shop's
// own time zone. Pure arithmetic on a given moment, no database.
// Spec: docs/superpowers/specs/2026-09-26-book-server-10-notice-timezone-design.md
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shopNow, shopToday, earliestBookable, isKnownTimeZone, currentMoment, startIsInTime, dropoffIsInTime,
} from '../server/clock.js';

const at = (iso) => new Date(iso);

test('in summer, now is UK time, not UTC', () => {
  // 23:30 UTC on 1 July is 00:30 on 2 July in the UK (BST, UTC+1).
  assert.deepEqual(shopNow('Europe/London', at('2026-07-01T23:30:00Z')), { date: '2026-07-02', minutes: 30 });
  assert.equal(shopToday('Europe/London', at('2026-07-01T23:30:00Z')), '2026-07-02');
});

test('in winter, UK time and UTC agree', () => {
  assert.deepEqual(shopNow('Europe/London', at('2026-12-01T23:30:00Z')), { date: '2026-12-01', minutes: 23 * 60 + 30 });
});

test('on the clock-change days, now follows the UK clock', () => {
  // Spring forward, 29 March 2026: 08:00 UTC is 09:00 BST.
  assert.deepEqual(shopNow('Europe/London', at('2026-03-29T08:00:00Z')), { date: '2026-03-29', minutes: 9 * 60 });
  // Fall back, 25 October 2026: 00:30 UTC is still 01:30 BST; 01:30 UTC is 01:30 GMT.
  assert.deepEqual(shopNow('Europe/London', at('2026-10-25T00:30:00Z')), { date: '2026-10-25', minutes: 90 });
  assert.deepEqual(shopNow('Europe/London', at('2026-10-25T01:30:00Z')), { date: '2026-10-25', minutes: 90 });
});

test('a non-UK zone moves today', () => {
  // 02:00 UTC on 1 September is 22:00 on 31 August in New York.
  assert.equal(shopToday('America/New_York', at('2026-09-01T02:00:00Z')), '2026-08-31');
  assert.equal(shopToday('Europe/London', at('2026-09-01T02:00:00Z')), '2026-09-01');
});

test('the earliest bookable moment is now plus the notice, and can fall on a later date', () => {
  const shop = { timeZone: 'Europe/London', minNoticeMinutes: 120 };
  assert.deepEqual(earliestBookable(shop, at('2026-09-01T06:00:00Z')), { date: '2026-09-01', minutes: 9 * 60 });
  // 22:00 BST plus three hours is 01:00 the next day.
  assert.deepEqual(earliestBookable({ ...shop, minNoticeMinutes: 180 }, at('2026-09-01T21:00:00Z')), { date: '2026-09-02', minutes: 60 });
  // Zero notice: the earliest moment is now.
  assert.deepEqual(earliestBookable({ ...shop, minNoticeMinutes: 0 }, at('2026-09-01T06:00:00Z')), { date: '2026-09-01', minutes: 7 * 60 });
});

test('the notice is real time, so it crosses the spring clock change correctly', () => {
  // 23:30 GMT on 28 March plus two real hours is 01:30 UTC = 02:30 BST on 29 March.
  const shop = { timeZone: 'Europe/London', minNoticeMinutes: 120 };
  assert.deepEqual(earliestBookable(shop, at('2026-03-28T23:30:00Z')), { date: '2026-03-29', minutes: 150 });
});

test('known and unknown time zones', () => {
  assert.equal(isKnownTimeZone('Europe/London'), true);
  assert.equal(isKnownTimeZone('America/New_York'), true);
  assert.equal(isKnownTimeZone('Mars/Olympus_Mons'), false);
  assert.equal(isKnownTimeZone(''), false);
  assert.equal(isKnownTimeZone(42), false);
});

test('a pinned test clock is read from the environment', () => {
  const before = process.env.WHEELHOUSE_TEST_CLOCK;
  try {
    process.env.WHEELHOUSE_TEST_CLOCK = '2026-09-01T06:00:00Z';
    assert.equal(currentMoment().toISOString(), '2026-09-01T06:00:00.000Z');
    delete process.env.WHEELHOUSE_TEST_CLOCK;
    assert.ok(Math.abs(currentMoment().getTime() - Date.now()) < 5000);
    process.env.WHEELHOUSE_TEST_CLOCK = 'not a moment';
    assert.throws(() => currentMoment(), /WHEELHOUSE_TEST_CLOCK/);
  } finally {
    if (before === undefined) delete process.env.WHEELHOUSE_TEST_CLOCK;
    else process.env.WHEELHOUSE_TEST_CLOCK = before;
  }
});

test('a start time is in time from the earliest bookable moment on', () => {
  const earliest = { date: '2026-09-01', minutes: 10 * 60 };
  assert.equal(startIsInTime(earliest, '2026-09-01', '09:30'), false);
  assert.equal(startIsInTime(earliest, '2026-09-01', '10:00'), true, 'the earliest bookable moment is itself bookable');
  assert.equal(startIsInTime(earliest, '2026-09-01', '10:30'), true);
  assert.equal(startIsInTime(earliest, '2026-08-31', '17:00'), false, 'an earlier date');
  assert.equal(startIsInTime(earliest, '2026-09-02', '00:00'), true, 'a later date');
});

test('a drop-off day is in time only while the earliest moment is before its window closes', () => {
  const earliest = { date: '2026-09-01', minutes: 9 * 60 + 59 };
  assert.equal(dropoffIsInTime(earliest, '2026-09-01', '10:00'), true);
  assert.equal(dropoffIsInTime({ ...earliest, minutes: 10 * 60 }, '2026-09-01', '10:00'), false, 'the window has closed');
  assert.equal(dropoffIsInTime(earliest, '2026-08-31', '10:00'), false);
  assert.equal(dropoffIsInTime({ date: '2026-09-02', minutes: 0 }, '2026-09-01', '23:00'), false, 'notice spilled past the day');
  assert.equal(dropoffIsInTime(earliest, '2026-09-02', '10:00'), true);
});

test('in production the test pin is ignored and the real time is used', () => {
  const pin = process.env.WHEELHOUSE_TEST_CLOCK;
  const env = process.env.NODE_ENV;
  try {
    process.env.WHEELHOUSE_TEST_CLOCK = '2026-09-01T06:00:00Z';
    process.env.NODE_ENV = 'production';
    assert.ok(Math.abs(currentMoment().getTime() - Date.now()) < 5000, 'a pinned clock took effect in production');
  } finally {
    if (pin === undefined) delete process.env.WHEELHOUSE_TEST_CLOCK;
    else process.env.WHEELHOUSE_TEST_CLOCK = pin;
    if (env === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = env;
  }
});
