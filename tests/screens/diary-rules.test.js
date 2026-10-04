// The staff diary's pure rules: which colour a job is, which days a week
// holds, which hours the grid covers, how overlapping jobs share a column,
// and what a "Waiting for you" card says.
// Spec: docs/superpowers/specs/2026-10-03-staff-diary-view-design.md
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  diaryState, weekOf, addDays, gridRange, toMinutes, layoutLanes, waitingCard, dayLabel, weekLabel,
} from '../../src/screens/diary/rules.ts';

const job = (over = {}) => ({
  bookingState: 'scheduled', workState: 'not_started', custodyState: 'expected',
  requested: null, cancelledBy: null, cancellationSeenAt: null, ...over,
});

test('a booking request is Pending (purple)', () => {
  assert.equal(diaryState(job({ bookingState: 'pending' })), 'pending');
});

test('a change request is Change requested (amber)', () => {
  assert.equal(diaryState(job({ bookingState: 'reschedule_requested', requested: { jobDate: '2026-10-06', startTime: '14:00' } })), 'hold');
});

test('waiting for parts and finished work have their own colours', () => {
  assert.equal(diaryState(job({ workState: 'waiting_parts' })), 'waiting');
  assert.equal(diaryState(job({ workState: 'complete' })), 'ready');
  assert.equal(diaryState(job({ workState: 'complete', custodyState: 'collected' })), 'ready');
});

test('started or paused work shows as Expected', () => {
  assert.equal(diaryState(job({ workState: 'in_progress' })), 'scheduled');
  assert.equal(diaryState(job({ workState: 'on_hold' })), 'scheduled');
  assert.equal(diaryState(job()), 'scheduled');
});

test("a customer's cancellation shows until someone marks it seen, then it goes", () => {
  assert.equal(diaryState(job({ bookingState: 'cancelled', cancelledBy: 'customer' })), 'cancelled');
  assert.equal(diaryState(job({ bookingState: 'cancelled', cancelledBy: 'customer', cancellationSeenAt: '2026-10-03T10:00:00Z' })), 'hidden');
});

test('declined, expired and shop-cancelled jobs are hidden', () => {
  for (const bookingState of ['declined', 'expired']) assert.equal(diaryState(job({ bookingState })), 'hidden');
  assert.equal(diaryState(job({ bookingState: 'cancelled', cancelledBy: 'staff' })), 'hidden');
});

test('a week runs Monday to Sunday, whatever day you start from', () => {
  const week = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];
  assert.deepEqual(weekOf('2026-10-03'), week); // a Saturday
  assert.deepEqual(weekOf('2026-09-28'), week); // the Monday
  assert.deepEqual(weekOf('2026-10-04'), week); // the Sunday
});

test('adding days crosses months and clock changes without slipping', () => {
  assert.equal(addDays('2026-09-30', 1), '2026-10-01');
  assert.equal(addDays('2026-10-25', 1), '2026-10-26'); // UK clocks go back on the 25th
  assert.equal(addDays('2026-10-05', -7), '2026-09-28');
});

test('dates read as people say them', () => {
  assert.equal(dayLabel('2026-10-03'), 'Saturday 3 October');
  assert.equal(weekLabel('2026-09-28'), '28 September – 4 October 2026');
  assert.equal(weekLabel('2026-10-05'), '5–11 October 2026');
});

test('the grid covers the shop\'s widest opening hours', () => {
  const settings = { openingHours: [{ weekday: 1, open: '09:00', close: '17:00' }, { weekday: 6, open: '08:00', close: '13:00' }] };
  assert.deepEqual(gridRange(settings, []), { start: toMinutes('08:00'), end: toMinutes('17:00') });
});

test('the grid is 09:00 to 18:00 when no hours are set, and stretches to show a job outside them', () => {
  assert.deepEqual(gridRange({ openingHours: [] }, []), { start: 540, end: 1080 });
  const late = [{ startTime: '17:30', endTime: '19:00' }];
  assert.deepEqual(gridRange({ openingHours: [{ weekday: 1, open: '09:00', close: '17:00' }] }, late), { start: 540, end: 1140 });
});

test('jobs that overlap share the column side by side; others keep it to themselves', () => {
  const lanes = layoutLanes([
    { id: 1, start: 540, end: 600 },
    { id: 2, start: 570, end: 630 },
    { id: 3, start: 700, end: 760 },
  ]);
  assert.deepEqual(lanes.get(1), { lane: 0, total: 2 });
  assert.deepEqual(lanes.get(2), { lane: 1, total: 2 });
  assert.deepEqual(lanes.get(3), { lane: 0, total: 1 });
});

test('a waiting card says what it is, who, what and when', () => {
  assert.deepEqual(
    waitingCard({ kind: 'new_booking', customerName: 'Sam Reed', serviceNames: ['Brake service'], jobDate: '2026-10-09', startTime: '10:00', endTime: '10:45' }),
    { tone: 'pending', label: 'New booking request', customer: 'Sam Reed', detail: 'Brake service · Fri 9 Oct, 10:00–10:45' },
  );
  assert.deepEqual(
    waitingCard({ kind: 'change_request', customerName: 'Oliver Chen', serviceNames: [], from: { jobDate: '2026-10-05', startTime: '10:00' }, to: { jobDate: '2026-10-05', startTime: '14:00' } }),
    { tone: 'hold', label: 'Change request', customer: 'Oliver Chen', detail: 'Mon 5 Oct 10:00 → Mon 5 Oct 14:00' },
  );
  assert.equal(waitingCard({ kind: 'customer_cancelled', customerName: 'Aisha Khan', serviceNames: ['Safety check'], jobDate: '2026-10-07' }).label, 'Cancelled by customer');
});

// Piece 3: where a dragged job lands. The pointer's height in the column is
// turned into a time, snapped to 15 minutes like the old diary, and kept
// inside the grid's hours.
import { dropStart } from '../../src/screens/diary/rules.ts';

test('a dropped job starts where it was dropped, snapped to 15 minutes', () => {
  // The grid starts at 09:00 and each 30-minute row is 29px.
  assert.equal(dropStart(58, { start: 540, end: 1080 }, 60), 600); // exactly 10:00
  assert.equal(dropStart(65, { start: 540, end: 1080 }, 60), 600); // a little after: still 10:00
  assert.equal(dropStart(73, { start: 540, end: 1080 }, 60), 615); // nearer 10:15
});

test('a dropped job never starts before the grid or runs past its end', () => {
  assert.equal(dropStart(-40, { start: 540, end: 1080 }, 60), 540);
  assert.equal(dropStart(10_000, { start: 540, end: 1080 }, 60), 1020); // 17:00, so it ends at 18:00
});

// Quote stage piece 4 (UX walk-through M3): a job whose quote waits for the
// customer has its own teal state, so purple only ever means a booking request.
test('a job waiting for the customer to answer a quote is teal', () => {
  assert.equal(diaryState(job({ custodyState: 'in_shop', quote: { id: 9, state: 'sent', revision: 1 } })), 'answer');
  assert.equal(diaryState(job({ custodyState: 'in_shop', quote: { id: 9, state: 'approved', revision: 1 } })), 'scheduled');
  assert.equal(diaryState(job({ workState: 'complete', quote: { id: 9, state: 'sent', revision: 1 } })), 'ready');
});
