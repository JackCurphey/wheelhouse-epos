// The staff diary's decision rules, run outside the browser.
// Spec: docs/superpowers/specs/2026-09-27-staff-diary-waiting-design.md
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Loads the scripts in the order index.html loads them, into one context.
export function loadRules(files = ['public/diary-waiting.js', 'public/diary-marks.js', 'public/diary-review.js']) {
  const context = {};
  context.globalThis = context;
  vm.createContext(context);
  for (const f of files) vm.runInContext(readFileSync(path.join(root, f), 'utf8'), context);
  return context;
}

const { DiaryWaiting, DiaryMarks } = loadRules(['public/diary-waiting.js', 'public/diary-marks.js']);
const NOW = new Date('2026-10-05T12:00:00Z');

const newItem = {
  kind: 'new_booking', jobId: 1, reference: 'WH-1042', jobDate: '2026-10-06', startTime: '09:00', endTime: '11:00',
  mechanicId: 7, mechanicName: 'Dave', customerName: 'Sam Example', serviceNames: ['Full service', 'Brake bleed'],
  services: [{ id: 3, name: 'Full service' }, { id: 4, name: 'Brake bleed' }], arrivedAt: '2026-10-05T10:00:00Z',
};
const changeItem = {
  ...newItem, kind: 'change_request', jobId: 2, reference: 'WH-1038', customerName: 'Alex Example',
  arrivedAt: '2026-10-05T11:20:00Z',
  from: { jobDate: '2026-10-07', startTime: '10:00', endTime: '11:00', mechanicId: 7, mechanicName: 'Dave' },
  to: { jobDate: '2026-10-09', startTime: '14:00', endTime: '15:00', mechanicId: 7, mechanicName: 'Dave' },
};
const cancelledItem = { ...newItem, kind: 'customer_cancelled', jobId: 3, arrivedAt: '2026-10-05T11:55:00Z' };

test('dates read as short day and month, whatever the machine time zone', () => {
  assert.equal(DiaryWaiting.dayDate('2026-10-06'), 'Tue 6 Oct');
  assert.equal(DiaryWaiting.dayDate('2026-01-01'), 'Thu 1 Jan');
});

test('a slot reads day, time range and mechanic, leaving out what is missing', () => {
  assert.equal(DiaryWaiting.slotText(newItem), 'Tue 6 Oct, 09:00–11:00 · Dave');
  assert.equal(DiaryWaiting.slotText({ jobDate: '2026-10-06', startTime: '', endTime: '', mechanicName: null }), 'Tue 6 Oct');
});

test('"arrived" wording at each boundary', () => {
  const at = (ms) => new Date(NOW.getTime() - ms).toISOString();
  assert.equal(DiaryWaiting.arrivedText(at(30_000), NOW), 'Arrived just now');
  assert.equal(DiaryWaiting.arrivedText(at(60_000), NOW), 'Arrived 1 minute ago');
  assert.equal(DiaryWaiting.arrivedText(at(59 * 60_000), NOW), 'Arrived 59 minutes ago');
  assert.equal(DiaryWaiting.arrivedText(at(60 * 60_000), NOW), 'Arrived 1 hour ago');
  assert.equal(DiaryWaiting.arrivedText(at(23 * 3_600_000), NOW), 'Arrived 23 hours ago');
  assert.equal(DiaryWaiting.arrivedText(at(24 * 3_600_000), NOW), 'Arrived 1 day ago');
  assert.equal(DiaryWaiting.arrivedText(at(72 * 3_600_000), NOW), 'Arrived 3 days ago');
});

test('a new booking card', () => {
  assert.deepEqual({ ...DiaryWaiting.cardFor(newItem, NOW) }, {
    tone: 'new', label: 'New booking', customer: 'Sam Example', reference: 'WH-1042',
    services: 'Full service, Brake bleed', when: 'Tue 6 Oct, 09:00–11:00 · Dave', arrived: 'Arrived 2 hours ago',
  });
});

test('a change request card shows from and to', () => {
  const card = DiaryWaiting.cardFor(changeItem, NOW);
  assert.equal(card.tone, 'change');
  assert.equal(card.label, 'Change request');
  assert.equal(card.when, 'Wed 7 Oct 10:00 → Fri 9 Oct 14:00');
  assert.equal(card.arrived, 'Arrived 40 minutes ago');
});

test('a change to another mechanic names them', () => {
  const item = { ...changeItem, to: { ...changeItem.to, mechanicId: 8, mechanicName: 'Jo' } };
  assert.equal(DiaryWaiting.cardFor(item, NOW).when, 'Wed 7 Oct 10:00 → Fri 9 Oct 14:00 with Jo');
});

test('a cancellation card', () => {
  const card = DiaryWaiting.cardFor(cancelledItem, NOW);
  assert.equal(card.tone, 'cancelled');
  assert.equal(card.label, 'Cancelled by customer');
  assert.equal(card.when, 'Tue 6 Oct, 09:00–11:00 · Dave');
});

test('a card with no customer name says so plainly', () => {
  assert.equal(DiaryWaiting.cardFor({ ...newItem, customerName: null }, NOW).customer, 'Customer');
});

test('each job marking', () => {
  const job = (over) => ({ bookingState: 'scheduled', requested: null, cancelledBy: null, cancellationSeenAt: null, ...over });
  assert.equal(DiaryMarks.markOf(job({})), 'normal');
  assert.equal(DiaryMarks.markOf(job({ bookingState: 'pending' })), 'normal');
  assert.equal(DiaryMarks.markOf(job({ bookingState: 'reschedule_requested', requested: { jobDate: '2026-10-09' } })), 'move-requested');
  assert.equal(DiaryMarks.markOf(job({ bookingState: 'reschedule_requested', requested: null })), 'normal');
  assert.equal(DiaryMarks.markOf(job({ bookingState: 'cancelled', cancelledBy: 'customer' })), 'cancelled-unseen');
  assert.equal(DiaryMarks.markOf(job({ bookingState: 'cancelled', cancelledBy: 'customer', cancellationSeenAt: '2026-10-05T12:00:00Z' })), 'hidden');
  assert.equal(DiaryMarks.markOf(job({ bookingState: 'cancelled', cancelledBy: 'staff' })), 'hidden');
  assert.equal(DiaryMarks.markOf(job({ bookingState: 'declined' })), 'hidden');
  assert.equal(DiaryMarks.markOf(job({ bookingState: 'expired' })), 'hidden');
});

test('a change request outline belongs only on its day, for a shown mechanic', () => {
  const items = [newItem, changeItem];
  const all = () => true;
  assert.deepEqual(DiaryMarks.outlinesOn(items, '2026-10-09', all).map((i) => i.jobId), [2]);
  assert.deepEqual(DiaryMarks.outlinesOn(items, '2026-10-08', all), []);
  assert.deepEqual(DiaryMarks.outlinesOn(items, '2026-10-09', (m) => m === 8), []);
  const untimed = { ...changeItem, to: { ...changeItem.to, startTime: '' } };
  assert.deepEqual(DiaryMarks.outlinesOn([untimed], '2026-10-09', all), []);
});

const { DiaryReview } = loadRules();

test('pop-up headings name the kind and reference', () => {
  assert.equal(DiaryReview.headingFor(newItem), 'New online booking · WH-1042');
  assert.equal(DiaryReview.headingFor(changeItem), 'Change request · WH-1038');
  assert.equal(DiaryReview.headingFor({ ...cancelledItem, reference: null }), 'Cancelled by customer');
});

test('each kind of answer reads plainly', () => {
  assert.equal(DiaryReview.answerText({ kind: 'text', answer: 'Gears slipping' }), 'Gears slipping');
  assert.equal(DiaryReview.answerText({ kind: 'text', answer: null }), 'No answer');
  assert.equal(DiaryReview.answerText({ kind: 'choice', answer: 'Yes', text: null }), 'Yes');
  assert.equal(DiaryReview.answerText({ kind: 'choice', answer: 'No', text: 'rear only' }), 'No — rear only');
  assert.equal(DiaryReview.answerText({ kind: 'choice', answer: { notSure: true }, text: null }), 'Not sure');
  assert.equal(DiaryReview.answerText({ kind: 'choice', answer: null, text: 'see photo' }), 'see photo');
});

test('answers group under their service, in service order', () => {
  const answers = [
    { serviceId: 4, id: 'b', wording: 'Which brakes?', kind: 'choice', answer: { notSure: true }, text: null },
    { serviceId: 3, id: 'a', wording: "What's wrong?", kind: 'text', answer: 'Gears slipping' },
    { serviceId: 99, id: 'c', wording: 'Old question', kind: 'text', answer: 'x' },
  ];
  const groups = DiaryReview.groupAnswers(answers, newItem.services);
  assert.deepEqual(groups.map((g) => [g.name, g.answers.map((a) => a.id)]), [
    ['Full service', ['a']], ['Brake bleed', ['b']], ['Other answers', ['c']],
  ]);
  assert.deepEqual([...DiaryReview.groupAnswers(null, newItem.services)], []);
});

test('the change line names both times', () => {
  assert.equal(DiaryReview.changeLine(changeItem),
    'Customer asked to move from Wed 7 Oct, 10:00–11:00 · Dave to Fri 9 Oct, 14:00–15:00 · Dave');
});

test('the decline confirmation names the customer and day', () => {
  assert.equal(DiaryReview.declineConfirmText(newItem), "Decline Sam Example's booking for Tue 6 Oct? This can't be undone.");
  assert.equal(DiaryReview.declineConfirmText({ ...newItem, customerName: null }), "Decline this booking for Tue 6 Oct? This can't be undone.");
});

test('each refusal becomes a plain sentence', () => {
  assert.equal(DiaryReview.refusalText({ status: 409, code: 'stale', message: 'x' }), 'This job changed while you were looking at it.');
  assert.equal(DiaryReview.refusalText({ status: 409, code: 'capacity', message: 'x' }), 'The requested time is no longer free.');
  assert.equal(DiaryReview.refusalText({ status: 409, code: 'illegal', message: "There's no change request to accept" }), "There's no change request to accept");
  assert.equal(DiaryReview.refusalText({ status: 404, message: 'Job not found' }), 'This job no longer exists.');
  assert.equal(DiaryReview.refusalText({ name: 'TypeError', message: 'Failed to fetch' }), "Couldn't reach the server — try again.");
  assert.equal(DiaryReview.refusalText({ status: 400, message: 'A valid date is required' }), 'A valid date is required');
  assert.equal(DiaryReview.refusalText({ name: 'Error', message: 'boom' }), 'boom');
});
