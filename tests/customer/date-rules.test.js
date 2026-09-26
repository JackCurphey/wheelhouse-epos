// The date screen's rules: the range asked for, the job length, which days
// are free, the diary's columns, whether a saved choice is still free,
// "Any mechanic", the summary and the Continue message.
// Spec: docs/superpowers/specs/2026-09-26-book-d4-date-screen-design.md
import test from 'node:test';
import assert from 'node:assert/strict';

const BUILD = new URL('../../.test-build/screens/book/', import.meta.url);
const r = await import(new URL('date-rules.js', BUILD).href);
const q = await import(new URL('date-query.js', BUILD).href);

// The shop's mechanics in its order (the server orders them by name).
const MECHANICS = [
  { id: 1, name: 'Alex', workingDays: [1, 2, 3, 4, 5] },
  { id: 2, name: 'Jo', workingDays: [1, 2, 3, 4, 5] },
  { id: 3, name: 'Sam', workingDays: [1, 2, 3, 4, 5] },
];
const HOURS = { open: '09:00', close: '17:00' };
const TIMED = {
  date: '2026-10-05', mode: 'timed', mechanics: [
    { mechanicId: 1, startTimes: ['09:00', '09:30', '14:00'] },
    { mechanicId: 2, startTimes: [] },
    { mechanicId: 3, startTimes: ['10:00'] },
  ],
};
const DROPOFF = {
  date: '2026-10-06', mode: 'dropoff', dropoffWindow: { start: '08:30', end: '10:00' }, mechanics: [
    { mechanicId: 1, bookable: false }, { mechanicId: 2, bookable: true }, { mechanicId: 3, bookable: true },
  ],
};
const FULL_TIMED = { date: '2026-10-07', mode: 'timed', mechanics: MECHANICS.map((m) => ({ mechanicId: m.id, startTimes: [] })) };
const FULL_DROPOFF = {
  date: '2026-10-08', mode: 'dropoff', dropoffWindow: { start: '08:30', end: '10:00' },
  mechanics: MECHANICS.map((m) => ({ mechanicId: m.id, bookable: false })),
};
const AV = {
  busy: [
    { mechanicId: 1, jobDate: '2026-10-05', startTime: '10:00', endTime: '12:00' },
    { mechanicId: 3, jobDate: '2026-10-05', startTime: '09:00', endTime: '10:00' },
    { mechanicId: 1, jobDate: '2026-10-06', startTime: '09:00', endTime: '11:00' },
  ],
  fullDays: [],
  days: [TIMED, DROPOFF, FULL_TIMED, FULL_DROPOFF],
};

test("today is the device's own date", () => {
  assert.equal(r.localToday(new Date(2026, 9, 5, 23, 30)), '2026-10-05');
  assert.equal(r.localToday(new Date(2027, 0, 1, 0, 5)), '2027-01-01');
});

test('the range is today to the last day of next month', () => {
  assert.deepEqual(r.bookingRange('2026-10-05'), { start: '2026-10-05', end: '2026-11-30', months: ['2026-10', '2026-11'] });
  assert.deepEqual(r.bookingRange('2026-12-31'), { start: '2026-12-31', end: '2027-01-31', months: ['2026-12', '2027-01'] });
  assert.deepEqual(r.bookingRange('2027-01-30'), { start: '2027-01-30', end: '2027-02-28', months: ['2027-01', '2027-02'] });
});

test('the range never asks for more than the server allows (62 days)', () => {
  const days = ({ start, end }) => (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
  assert.equal(days(r.bookingRange('2026-07-01')), 62);
  assert.equal(days(r.bookingRange('2026-12-01')), 62);
});

test("the job length is the ticked services' minutes, or an hour for Not sure", () => {
  const services = {
    shopName: 'North Street Cycles', showPrices: false, full: [], categories: [],
    uncategorised: [
      { id: 11, name: 'Brake service', price: null, minutes: 30, questions: [] },
      { id: 12, name: 'Gear service', price: null, minutes: 45, questions: [] },
    ],
  };
  assert.equal(r.jobMinutes(services, { serviceIds: [11, 12] }), 75);
  assert.equal(r.jobMinutes(services, { notSure: true }), 60);
  assert.equal(r.NOT_SURE_MINUTES, 60);
});

test('a day is free when a mechanic has a start time (timed) or is bookable (drop-off)', () => {
  assert.deepEqual([...r.availableDays(AV)].sort(), ['2026-10-05', '2026-10-06']);
  assert.equal(r.availableDays({ busy: [], fullDays: [], days: [FULL_TIMED, FULL_DROPOFF] }).size, 0);
});

test('the picked day is the saved date only while it is free', () => {
  assert.ok(r.pickedDay(AV, '2026-10-05') === TIMED);
  assert.ok(r.pickedDay(AV, '2026-10-06') === DROPOFF);
  assert.equal(r.pickedDay(AV, '2026-10-07'), undefined);
  assert.equal(r.pickedDay(AV, '2026-09-30'), undefined);
  assert.equal(r.pickedDay(AV, undefined), undefined);
});

test("the calendar opens on the saved day's month, else the first free day's, else this month", () => {
  const range = r.bookingRange('2026-10-05');
  assert.equal(r.initialMonth(range, { date: '2026-11-02' }, new Set(['2026-10-06', '2026-11-02'])), '2026-11');
  assert.equal(r.initialMonth(range, {}, new Set(['2026-11-02'])), '2026-11');
  assert.equal(r.initialMonth(range, { date: '2026-11-03' }, new Set(['2026-10-06'])), '2026-10');
  assert.equal(r.initialMonth(range, {}, new Set()), '2026-10');
});

// Busy is now the complement of startTimes within the diary hours, not
// availability.busy: Alex's 10:00-12:00 server busy row no longer drives
// this (10:00-14:00 covers 12:00-14:00 too, a real gap the server row never
// mentioned; 14:30-17:00 is a second gap after the last start time), and
// Sam's row is likewise replaced by the gaps around his one start time.
// Jack, 26 Sep (.superpowers/sdd/d4-gaps/brief.md).
test("the diary has a column per shown mechanic, in the shop's order, with that day's busy time (the gaps between start times) and start times", () => {
  assert.deepEqual(r.diaryColumns(TIMED, MECHANICS, [3, 1], HOURS), [
    { id: '1', name: 'Alex', busy: [{ start: '10:00', end: '14:00' }, { start: '14:30', end: '17:00' }], startTimes: ['09:00', '09:30', '14:00'] },
    { id: '3', name: 'Sam', busy: [{ start: '09:00', end: '10:00' }, { start: '10:30', end: '17:00' }], startTimes: ['10:00'] },
  ]);
});

test('a mechanic with no start time that day is unavailable all day, not blank', () => {
  assert.deepEqual(r.diaryColumns(TIMED, MECHANICS, [2], HOURS),
    [{ id: '2', name: 'Jo', busy: [{ start: '09:00', end: '17:00' }], startTimes: [] }]);
  const samMissing = { ...TIMED, mechanics: TIMED.mechanics.filter((m) => m.mechanicId !== 3) };
  assert.deepEqual(r.diaryColumns(samMissing, MECHANICS, [3], HOURS)[0].busy, [{ start: '09:00', end: '17:00' }]);
});

// Every gap without a start time is "Unavailable" (Jack, 26 Sep,
// .superpowers/sdd/d4-gaps/brief.md): busy is the complement of startTimes
// within [hours.open, hours.close) on 30-minute steps, merged, with the
// server's availability.busy no longer consulted for this.
test('busy is every 30-minute step that is not a start time, merged into blocks', () => {
  const oneMechDay = (times) => ({ date: '2026-10-05', mode: 'timed', mechanics: [{ mechanicId: 9, startTimes: times }] });
  const MECH9 = [{ id: 9, name: 'Test', workingDays: [1, 2, 3, 4, 5] }];
  const busyFor = (times, hours) => r.diaryColumns(oneMechDay(times), MECH9, [9], hours)[0].busy;

  assert.deepEqual(
    busyFor(['09:00', '09:30', '11:00'], { open: '08:00', close: '12:00' }),
    [{ start: '08:00', end: '09:00' }, { start: '10:00', end: '11:00' }, { start: '11:30', end: '12:00' }],
  );
});

test('starts only late in the day (too soon for an earlier slot): one block from open to the first start', () => {
  const oneMechDay = { date: '2026-10-05', mode: 'timed', mechanics: [{ mechanicId: 9, startTimes: ['15:00', '15:30', '16:00', '16:30'] }] };
  const MECH9 = [{ id: 9, name: 'Test', workingDays: [1, 2, 3, 4, 5] }];
  assert.deepEqual(r.diaryColumns(oneMechDay, MECH9, [9], HOURS)[0].busy, [{ start: '09:00', end: '15:00' }]);
});

test('no start times: one busy block open..close', () => {
  const oneMechDay = { date: '2026-10-05', mode: 'timed', mechanics: [{ mechanicId: 9, startTimes: [] }] };
  const MECH9 = [{ id: 9, name: 'Test', workingDays: [1, 2, 3, 4, 5] }];
  assert.deepEqual(r.diaryColumns(oneMechDay, MECH9, [9], HOURS)[0].busy, [{ start: '09:00', end: '17:00' }]);
});

test('start times covering the whole day: no busy blocks', () => {
  const allDay = [];
  for (let t = 9 * 60; t < 17 * 60; t += 30) allDay.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${t % 60 === 0 ? '00' : '30'}`);
  const oneMechDay = { date: '2026-10-05', mode: 'timed', mechanics: [{ mechanicId: 9, startTimes: allDay }] };
  const MECH9 = [{ id: 9, name: 'Test', workingDays: [1, 2, 3, 4, 5] }];
  assert.deepEqual(r.diaryColumns(oneMechDay, MECH9, [9], HOURS)[0].busy, []);
});

test('an open/close off the 30-minute boundary clamps the first/last busy block', () => {
  const oneMechDay = { date: '2026-10-05', mode: 'timed', mechanics: [{ mechanicId: 9, startTimes: [] }] };
  const MECH9 = [{ id: 9, name: 'Test', workingDays: [1, 2, 3, 4, 5] }];
  assert.deepEqual(
    r.diaryColumns(oneMechDay, MECH9, [9], { open: '09:10', close: '16:50' })[0].busy,
    [{ start: '09:10', end: '16:50' }],
  );
});

test("the drop-off choice is \"Any mechanic\", then each mechanic, those who can't take the job disabled", () => {
  assert.deepEqual(r.dropoffOptions(DROPOFF, MECHANICS), [
    { value: 'any', label: 'Any mechanic' },
    { value: '1', label: 'Alex', disabled: true },
    { value: '2', label: 'Jo', disabled: false },
    { value: '3', label: 'Sam', disabled: false },
  ]);
  assert.equal(r.ANY_MECHANIC, 'any');
});

test("\"Any mechanic\" becomes the first bookable mechanic in the shop's order", () => {
  assert.equal(r.resolveMechanic(DROPOFF, MECHANICS), 2);
  assert.equal(r.resolveMechanic(FULL_DROPOFF, MECHANICS), null);
});

test('a saved choice is still free only while the same day, mechanic and time are offered', () => {
  const free = (draft) => r.choiceStillFree(AV, draft);
  assert.equal(free({}), true, 'nothing saved');
  assert.equal(free({ date: '2026-10-05' }), true, 'a timed day with no time yet');
  assert.equal(free({ date: '2026-10-05', mechanicId: 1, startTime: '09:30' }), true);
  assert.equal(free({ date: '2026-10-05', mechanicId: 1, startTime: '11:00' }), false, 'that time has gone');
  assert.equal(free({ date: '2026-10-05', mechanicId: 2, startTime: '09:00' }), false, "not that mechanic's time");
  assert.equal(free({ date: '2026-10-05', mechanicId: 1 }), false, 'a mechanic with no time on a timed day');
  assert.equal(free({ date: '2026-10-07', mechanicId: 1, startTime: '09:00' }), false, 'the day is now full');
  assert.equal(free({ date: '2026-10-01' }), false, 'a day no longer offered (past)');
  assert.equal(free({ date: '2026-10-06' }), true, 'drop-off, Any mechanic');
  assert.equal(free({ date: '2026-10-06', mechanicId: 3 }), true);
  assert.equal(free({ date: '2026-10-06', mechanicId: 1 }), false, 'that mechanic can no longer take it');
  assert.equal(free({ date: '2026-10-06', mechanicId: 3, startTime: '09:00' }), false, 'the day changed to drop-off');
});

// "Any mechanic" (Jack, 26 Sep, .superpowers/sdd/d4-followups/brief.md): the
// draft now records anyMechanic, and a stored mechanic that stops being
// bookable is silently re-resolved to another bookable mechanic rather than
// being cleared as taken - unless none is bookable that day.
test('reresolveMechanic: an anyMechanic drop-off choice whose mechanic is no longer bookable silently re-resolves to another', () => {
  assert.equal(r.reresolveMechanic(AV, { date: '2026-10-06', mechanicId: 1, anyMechanic: true }, MECHANICS), 2);
});

test('reresolveMechanic: nothing to do when the stored mechanic is still bookable', () => {
  assert.equal(r.reresolveMechanic(AV, { date: '2026-10-06', mechanicId: 3, anyMechanic: true }, MECHANICS), null);
});

test('reresolveMechanic: no mechanic bookable that day - not resolvable (the caller falls back to "taken")', () => {
  assert.equal(r.reresolveMechanic(AV, { date: '2026-10-08', mechanicId: 1, anyMechanic: true }, MECHANICS), null);
});

test('reresolveMechanic: not applicable without anyMechanic, on a timed day, or with no saved day', () => {
  assert.equal(r.reresolveMechanic(AV, { date: '2026-10-06', mechanicId: 1 }, MECHANICS), null, 'no anyMechanic');
  assert.equal(r.reresolveMechanic(AV, { date: '2026-10-05', mechanicId: 1, anyMechanic: true }, MECHANICS), null, 'timed day');
  assert.equal(r.reresolveMechanic(AV, { anyMechanic: true }, MECHANICS), null, 'no saved day');
});

test('a saved choice with anyMechanic and a re-resolvable mechanic still counts as free', () => {
  assert.equal(r.choiceStillFree(AV, { date: '2026-10-06', mechanicId: 1, anyMechanic: true }), true);
});

test('the summary: the day, then the time and mechanic (timed) or the drop-off window', () => {
  const s = (draft) => r.summaryText(AV, draft, MECHANICS);
  assert.equal(s({}), '');
  assert.equal(s({ date: '2026-10-07' }), '', 'a day that is not free shows nothing');
  assert.equal(s({ date: '2026-10-05' }), 'Monday 5 October');
  assert.equal(s({ date: '2026-10-05', mechanicId: 1, startTime: '09:30' }), 'Monday 5 October, 09:30 with Alex');
  assert.equal(s({ date: '2026-10-06' }), 'Tuesday 6 October, drop off 08:30–10:00');
  assert.equal(s({ date: '2026-10-06', mechanicId: 3 }), 'Tuesday 6 October, drop off 08:30–10:00');
  assert.equal(r.dayLabel('2026-11-02'), 'Monday 2 November');
});

test('dayLabel is our own copy: no comma, built from fixed names not a locale formatter', () => {
  assert.equal(r.dayLabel('2026-11-02'), 'Monday 2 November');
  assert.ok(!r.dayLabel('2026-11-02').includes(','), 'must contain no comma');
});

test('the Continue message: a day first, then a time on a timed day', () => {
  const m = (draft) => r.continueMessage(AV, draft);
  assert.equal(m({}), 'Choose a day');
  assert.equal(m({ date: '2026-10-07' }), 'Choose a day');
  assert.equal(m({ date: '2026-10-05' }), 'Choose a time');
  assert.equal(m({ date: '2026-10-05', mechanicId: 1, startTime: '09:30' }), null);
  assert.equal(m({ date: '2026-10-06' }), null, 'drop-off: Any mechanic is fine');
});

test('the addresses carry the shop, the range and the job length', () => {
  assert.equal(
    q.availabilityPath('north shop', { start: '2026-10-05', end: '2026-11-30', minutes: 75 }),
    '/api/portal/north%20shop/availability?start=2026-10-05&end=2026-11-30&minutes=75',
  );
  assert.equal(q.mechanicsPath('north'), '/api/portal/north/mechanics');
});
