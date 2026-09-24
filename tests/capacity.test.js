// The capacity calculator: pure arithmetic, no database.
// Spec: docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md (2a, The calculator)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  effectiveHours, widestHours, resolveOpeningHours, parseWeekdayHours, modeForDate,
  subtractIntervals, computeCapacity, startTimesFor, fitsDropoff, fitsFreeTime,
  legacyView, blockClashes, validateBlock, dayCount, datesBetween,
} from '../server/capacity.js';

const MONDAY = '2026-09-07';
const SATURDAY = '2026-09-12';
const SUNDAY = '2026-09-13';

const settings = (over = {}) => ({
  openingTime: '09:00', closingTime: '18:00', openingDays: [1, 2, 3, 4, 5, 6],
  weekdayHours: { 6: { open: '09:00', close: '17:00' } }, reserveMinutes: 0,
  bookingMode: 'timed', nextBookingMode: null, nextBookingModeFrom: null,
  dropoffWindowStart: '09:00', dropoffWindowEnd: '10:00', ...over,
});
const SAM = { id: 1, workingDays: [1, 2, 3, 4, 5, 6] };
const ALEX = { id: 2, workingDays: [1, 2, 3, 4, 5] };
const lunch = { id: 10, mechanicId: 1, kind: 'weekly', weekdays: [1, 2, 3, 4, 5], startDate: null, endDate: null, startTime: '13:00', endTime: '13:30', reason: 'Lunch' };
const job = (over) => ({ id: 100, mechanicId: 1, jobDate: MONDAY, startTime: '', endTime: '', plannedMinutes: null, ...over });
const day = (input) => computeCapacity({ settings: settings(), mechanics: [SAM, ALEX], blocks: [], jobs: [], dates: [MONDAY], ...input })[0];
const mech = (d, id) => d.mechanics.find((m) => m.mechanicId === id);

test('a weekday uses its own hours, else the usual ones; a closed day has none', () => {
  assert.deepEqual(effectiveHours(settings(), 6), { open: '09:00', close: '17:00' });
  assert.deepEqual(effectiveHours(settings(), 1), { open: '09:00', close: '18:00' });
  assert.equal(effectiveHours(settings(), 0), null);
});

test('the widest hours span the earliest open and the latest close', () => {
  assert.deepEqual(widestHours(settings({ weekdayHours: { 6: { open: '08:00', close: '17:00' } } })), { open: '08:00', close: '18:00' });
});

test('opening hours keep only the days that differ from the usual hours', () => {
  const r = resolveOpeningHours(
    [{ weekday: 1, open: '09:00', close: '18:00' }, { weekday: 6, open: '09:00', close: '17:00' }],
    { openingTime: '09:00', closingTime: '18:00' });
  assert.deepEqual(r, { openingDays: [1, 6], weekdayHours: { 6: { open: '09:00', close: '17:00' } } });
  assert.match(resolveOpeningHours([{ weekday: 1, open: '18:00', close: '09:00' }], { openingTime: '09:00', closingTime: '18:00' }).error, /after/);
  assert.match(resolveOpeningHours([{ weekday: 1, open: '09:00', close: '18:00' }, { weekday: 1, open: '09:00', close: '18:00' }], { openingTime: '09:00', closingTime: '18:00' }).error, /once/);
});

test('stored weekday hours that are malformed are ignored, not trusted', () => {
  assert.deepEqual(parseWeekdayHours('{"6":{"open":"09:00","close":"17:00"},"9":{"open":"x"}}'), { 6: { open: '09:00', close: '17:00' } });
  assert.deepEqual(parseWeekdayHours('not json'), {});
});

test('a scheduled mode change applies from its date on, not before', () => {
  const s = settings({ nextBookingMode: 'dropoff', nextBookingModeFrom: '2026-11-01' });
  assert.equal(modeForDate(s, '2026-10-31'), 'timed');
  assert.equal(modeForDate(s, '2026-11-01'), 'dropoff');
});

test('subtracting intervals splits and trims windows', () => {
  assert.deepEqual(subtractIntervals([[540, 1080]], [[780, 810]]), [[540, 780], [810, 1080]]);
  assert.deepEqual(subtractIntervals([[540, 1080]], [[500, 600], [1000, 1200]]), [[600, 1000]]);
});

test('lunch removes its half hour from the mechanic\'s day and their start times', () => {
  const sam = mech(day({ blocks: [lunch] }), 1);
  assert.deepEqual(sam.availableWindows, [[540, 780], [810, 1080]]);
  assert.equal(sam.freeMinutes, 510);
  const starts = startTimesFor(sam, 60);
  assert.ok(starts.includes('12:00'));
  assert.ok(!starts.includes('12:30'), 'a 60-minute job at 12:30 would run into lunch');
  assert.ok(!starts.includes('13:00'));
  assert.ok(starts.includes('13:30'));
});

test('Saturday\'s shorter day ends the start times earlier', () => {
  const sam = mech(day({ dates: [SATURDAY] }), 1);
  const starts = startTimesFor(sam, 60);
  assert.equal(starts.at(-1), '16:00');
});

test('a shop closure removes the day for everyone; leave removes it for one', () => {
  const closed = { id: 11, mechanicId: null, kind: 'dates', weekdays: null, startDate: MONDAY, endDate: MONDAY, startTime: null, endTime: null, reason: 'Training' };
  const leave = { ...closed, id: 12, mechanicId: 2, reason: 'Holiday' };
  const d1 = day({ blocks: [closed] });
  assert.equal(d1.shopClosed, true);
  assert.ok(d1.mechanics.every((m) => !m.working && m.freeMinutes === 0));
  const d2 = day({ blocks: [leave] });
  assert.equal(mech(d2, 1).working, true);
  assert.equal(mech(d2, 2).working, false);
});

test('a day off and a closed weekday are not scheduled', () => {
  assert.equal(mech(day({ dates: [SATURDAY] }), 2).scheduled, false, 'Alex does not work Saturdays');
  assert.equal(mech(day({ dates: [SUNDAY] }), 1).scheduled, false, 'the shop is closed Sundays');
});

test('timed jobs cut their time out; untimed jobs take their minutes; the reserve comes off last', () => {
  const sam = mech(day({
    settings: settings({ reserveMinutes: 60 }),
    jobs: [job({ startTime: '10:00', endTime: '11:00' }), job({ id: 101, plannedMinutes: 45 })],
  }), 1);
  assert.deepEqual(sam.freeWindows, [[540, 600], [660, 1080]]);
  assert.equal(sam.freeMinutes, 540 - 60 - 45 - 60);
});

test('overlapping timed jobs are counted once, not twice', () => {
  const sam = mech(day({ jobs: [job({ startTime: '10:00', endTime: '14:00' }), job({ id: 101, startTime: '12:00', endTime: '16:00' })] }), 1);
  assert.equal(sam.freeMinutes, 180);
});

test('an unassigned walk-in is split across the mechanics working that day', () => {
  const d = day({ jobs: [job({ mechanicId: null, plannedMinutes: 60 })] });
  assert.equal(d.queueMinutes, 60);
  assert.equal(mech(d, 1).freeMinutes, 540 - 30);
  assert.equal(mech(d, 2).freeMinutes, 540 - 30);
});

test('an unassigned timed job also joins the shared queue, not just untimed ones', () => {
  const d = day({ jobs: [job({ mechanicId: null, startTime: '10:00', endTime: '11:00' })] });
  assert.equal(d.queueMinutes, 60);
  assert.equal(mech(d, 1).freeMinutes, 540 - 30);
  assert.equal(mech(d, 2).freeMinutes, 540 - 30);
});

test('a mechanic on leave takes no share of the walk-in queue', () => {
  const leave = { id: 12, mechanicId: 2, kind: 'dates', weekdays: null, startDate: MONDAY, endDate: MONDAY, startTime: null, endTime: null, reason: '' };
  const d = day({ blocks: [leave], jobs: [job({ mechanicId: null, plannedMinutes: 60 })] });
  assert.equal(mech(d, 1).freeMinutes, 540 - 60);
});

test('a drop-off day fits a job only while free minutes remain', () => {
  const sam = mech(day({ jobs: [job({ plannedMinutes: 480 })] }), 1);
  assert.equal(fitsDropoff(sam, 60), true);
  assert.equal(fitsDropoff(sam, 61), false);
});

test('start times need the free minutes as well as the gap', () => {
  const sam = mech(day({ settings: settings({ reserveMinutes: 480 }) }), 1);
  assert.deepEqual(startTimesFor(sam, 90), [], 'only 60 minutes are bookable once the reserve is held back');
});

test('fitsFreeTime refuses a time inside a block', () => {
  const sam = mech(day({ blocks: [lunch] }), 1);
  assert.equal(fitsFreeTime(sam, '12:00', '13:00'), true);
  assert.equal(fitsFreeTime(sam, '12:30', '13:30'), false);
});

test('the old booking page sees blocks and short days as busy, with no reason', () => {
  const s = settings();
  const monday = day({ blocks: [lunch], jobs: [job({ startTime: '10:00', endTime: '11:00' })] });
  const { busy } = legacyView(monday, s, [job({ startTime: '10:00', endTime: '11:00' })]);
  assert.deepEqual(busy.filter((b) => b.mechanicId === 1), [
    { mechanicId: 1, jobDate: MONDAY, startTime: '10:00', endTime: '11:00' },
    { mechanicId: 1, jobDate: MONDAY, startTime: '13:00', endTime: '13:30' },
  ]);
  assert.ok(!JSON.stringify(busy).includes('Lunch'));
  const saturday = computeCapacity({ settings: s, mechanics: [SAM], blocks: [], jobs: [], dates: [SATURDAY] })[0];
  assert.deepEqual(legacyView(saturday, s, []).busy, [{ mechanicId: 1, jobDate: SATURDAY, startTime: '17:00', endTime: '18:00' }]);
});

test('the old booking page sees a day as full once nothing more fits', () => {
  const s = settings({ reserveMinutes: 120 });
  const full = computeCapacity({ settings: s, mechanics: [SAM], blocks: [], jobs: [job({ startTime: '09:00', endTime: '17:30' })], dates: [MONDAY] })[0];
  assert.deepEqual(legacyView(full, s, []).fullDays, [{ mechanicId: 1, jobDate: MONDAY }]);
  const sunday = computeCapacity({ settings: s, mechanics: [SAM], blocks: [], jobs: [], dates: [SUNDAY] })[0];
  assert.deepEqual(legacyView(sunday, s, []).fullDays, [], 'a closed weekday is the old page\'s to grey, not a full day');
});

test('a block clashes with the live jobs it overlaps', () => {
  const jobs = [
    job({ id: 1, startTime: '12:30', endTime: '13:15' }),
    job({ id: 2, startTime: '14:00', endTime: '15:00' }),
    job({ id: 3, plannedMinutes: 60 }),
    job({ id: 4, mechanicId: 2, startTime: '13:00', endTime: '14:00' }),
  ];
  assert.deepEqual(blockClashes(lunch, jobs).map((j) => j.id), [1]);
  const leave = { ...lunch, kind: 'dates', weekdays: null, startDate: MONDAY, endDate: MONDAY, startTime: null, endTime: null };
  assert.deepEqual(blockClashes(leave, jobs).map((j) => j.id), [1, 2, 3]);
});

test('blocks are validated before they are stored', () => {
  assert.ok(validateBlock({ kind: 'weekly', mechanicId: 1, weekdays: [1, 5, 1], startTime: '13:00', endTime: '13:30' }).block);
  assert.deepEqual(validateBlock({ kind: 'weekly', mechanicId: 1, weekdays: [5, 1], startTime: '13:00', endTime: '13:30' }).block.weekdays, [1, 5]);
  assert.match(validateBlock({ kind: 'weekly', mechanicId: null, weekdays: [1], startTime: '13:00', endTime: '13:30' }).error, /needs a mechanic/);
  assert.match(validateBlock({ kind: 'weekly', mechanicId: 1, weekdays: [1], startTime: '14:00', endTime: '13:30' }).error, /after the start/);
  assert.match(validateBlock({ kind: 'dates', mechanicId: null, startDate: '2026-12-25', endDate: '2026-12-26', startTime: '09:00', endTime: '12:00' }).error, /whole days/);
  assert.match(validateBlock({ kind: 'dates', mechanicId: 1, startDate: '2026-12-26', endDate: '2026-12-25' }).error, /on or after/);
  assert.match(validateBlock({ kind: 'monthly' }).error, /kind/);
});

test('date ranges are counted without building them first', () => {
  assert.equal(dayCount('2026-09-07', '2026-09-13'), 7);
  assert.deepEqual(datesBetween('2026-09-30', '2026-10-01'), ['2026-09-30', '2026-10-01']);
});
