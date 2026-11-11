// The report periods (openspec/changes/reports-sales-and-takings, design 2,
// Jack's answers 7 and 8 of 10 Nov): each choice, and the period before it.
// Pure date work, no database. 17 September 2026 is a Thursday.
import test from 'node:test';
import assert from 'node:assert/strict';
import { periodFor } from '../server/lib/report-periods.js';
import { ValidationError } from '../server/lib/http.js';

const THU = '2026-09-17';

test('This week on a Thursday is Monday to Thursday so far, against the same days last week', () => {
  const p = periodFor({ period: 'this-week', today: THU });
  assert.deepEqual([p.from, p.to, p.through], ['2026-09-14', '2026-09-20', '2026-09-17']);
  assert.equal(p.soFar, true);
  assert.equal(p.label, 'So far: Mon 14 – Thu 17 September');
  assert.equal(p.against, 'the same days last week');
  assert.deepEqual([p.before.from, p.before.to], ['2026-09-07', '2026-09-10']);
  assert.equal(p.unit, 'day');
  assert.deepEqual(p.buckets.map((b) => b.key), ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20']);
  assert.deepEqual(p.buckets.map((b) => b.notReached), [false, false, false, false, true, true, true]);
  assert.equal(p.buckets[0].label, 'Mon 14 Sep');
  assert.deepEqual(p.buckets.map((b) => b.beforeKey).slice(0, 2), ['2026-09-07', '2026-09-08']);
});

test('This week on a Monday is that one day against last Monday', () => {
  const p = periodFor({ period: 'this-week', today: '2026-09-14' });
  assert.deepEqual([p.from, p.through], ['2026-09-14', '2026-09-14']);
  assert.deepEqual([p.before.from, p.before.to], ['2026-09-07', '2026-09-07']);
  assert.equal(p.label, 'So far: Mon 14 September');
});

test('This week on a Sunday is the whole week, no longer "so far"', () => {
  const p = periodFor({ period: 'this-week', today: '2026-09-20' });
  assert.equal(p.through, '2026-09-20');
  assert.equal(p.soFar, false);
  assert.equal(p.label, 'Mon 14 – Sun 20 September');
  assert.deepEqual([p.before.from, p.before.to], ['2026-09-07', '2026-09-13']);
  assert.ok(p.buckets.every((b) => !b.notReached));
});

test('a week that crosses a month and a year', () => {
  const p = periodFor({ period: 'this-week', today: '2027-01-01' }); // a Friday
  assert.equal(p.from, '2026-12-28');
  assert.equal(p.label, 'So far: Mon 28 December – Fri 1 January 2027');
  assert.deepEqual([p.before.from, p.before.to], ['2026-12-21', '2026-12-25']);
});

test('Today is the day by hour, against the same weekday last week', () => {
  const p = periodFor({ period: 'today', today: THU, openingHour: 9, closingHour: 17 });
  assert.deepEqual([p.from, p.to, p.through], [THU, THU, THU]);
  assert.equal(p.unit, 'hour');
  assert.equal(p.against, 'last Thursday');
  assert.deepEqual([p.before.from, p.before.to], ['2026-09-10', '2026-09-10']);
  assert.deepEqual(p.buckets.map((b) => b.key), [9, 10, 11, 12, 13, 14, 15, 16]);
  assert.equal(p.buckets[0].label, '9am');
  assert.equal(p.buckets[4].label, '1pm');
  assert.equal(p.label, 'Thursday 17 September, so far');
});

test('This month so far is against the same days last month, by day', () => {
  const p = periodFor({ period: 'this-month', today: THU });
  assert.deepEqual([p.from, p.to, p.through], ['2026-09-01', '2026-09-30', '2026-09-17']);
  assert.equal(p.soFar, true);
  assert.equal(p.label, 'So far: 1 – 17 September');
  assert.equal(p.against, 'the same days last month');
  assert.deepEqual([p.before.from, p.before.to], ['2026-08-01', '2026-08-17']);
  assert.equal(p.buckets.length, 30);
  assert.equal(p.buckets[29].notReached, true);
});

test('This month on the 31st does not reach past a shorter last month', () => {
  const p = periodFor({ period: 'this-month', today: '2026-10-31' });
  assert.deepEqual([p.before.from, p.before.to], ['2026-09-01', '2026-09-30']);
});

test('Last month is the whole month against the month before it', () => {
  const p = periodFor({ period: 'last-month', today: THU });
  assert.deepEqual([p.from, p.to, p.through], ['2026-08-01', '2026-08-31', '2026-08-31']);
  assert.equal(p.soFar, false);
  assert.equal(p.label, 'August 2026');
  assert.equal(p.against, 'the month before');
  assert.deepEqual([p.before.from, p.before.to], ['2026-07-01', '2026-07-31']);
  assert.equal(p.buckets.length, 31);
});

test('Last 12 months is twelve months by month, against the twelve before', () => {
  const p = periodFor({ period: 'last-12-months', today: THU });
  assert.deepEqual([p.from, p.to, p.through], ['2025-10-01', '2026-09-30', '2026-09-17']);
  assert.equal(p.label, 'October 2025 – September 2026');
  assert.equal(p.against, 'the 12 months before');
  assert.deepEqual([p.before.from, p.before.to], ['2024-10-01', '2025-09-30']);
  assert.equal(p.unit, 'month');
  assert.equal(p.buckets.length, 12);
  assert.equal(p.buckets[0].key, '2025-10');
  assert.equal(p.buckets[0].beforeKey, '2024-10');
  assert.equal(p.buckets[11].key, '2026-09');
});

test('picked dates compare with the same number of days just before', () => {
  const p = periodFor({ period: 'dates', today: THU, from: '2026-09-01', to: '2026-09-17' });
  assert.deepEqual([p.from, p.to, p.through], ['2026-09-01', '2026-09-17', '2026-09-17']);
  assert.equal(p.label, '1 – 17 September');
  assert.equal(p.against, 'the same number of days just before');
  assert.deepEqual([p.before.from, p.before.to], ['2026-08-15', '2026-08-31']);
  assert.equal(p.buckets.length, 17);
});

test('picked dates beyond 62 days are shown by month', () => {
  const sixtyTwo = periodFor({ period: 'dates', today: THU, from: '2026-07-01', to: '2026-08-31' });
  assert.equal(sixtyTwo.unit, 'day');
  const more = periodFor({ period: 'dates', today: THU, from: '2026-06-30', to: '2026-08-31' });
  assert.equal(more.unit, 'month');
  assert.deepEqual(more.buckets.map((b) => b.key), ['2026-06', '2026-07', '2026-08']);
});

test('To before From, a day after today, or no dates are refused', () => {
  assert.throws(() => periodFor({ period: 'dates', today: THU, from: '2026-09-10', to: '2026-09-09' }), (e) => e instanceof ValidationError && /To/.test(e.message));
  assert.throws(() => periodFor({ period: 'dates', today: THU, from: '2026-09-10', to: '2026-09-18' }), (e) => e instanceof ValidationError && /today/.test(e.message));
  assert.throws(() => periodFor({ period: 'dates', today: THU, from: 'nope', to: '2026-09-18' }), ValidationError);
  assert.throws(() => periodFor({ period: 'fortnight', today: THU }), ValidationError);
});

test('a week with British Summer Time ending inside it still has seven days', () => {
  // The clocks go back on Sunday 25 October 2026.
  const p = periodFor({ period: 'this-week', today: '2026-10-28' });
  assert.equal(p.buckets.length, 7);
  assert.deepEqual(p.buckets.map((b) => b.key)[6], '2026-11-01');
  assert.equal(p.buckets[0].key, '2026-10-26');
});
