// The pending screen's rules: status words, and the summary lines built from
// the booking link's reply.
// Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md
import test from 'node:test';
import assert from 'node:assert/strict';

const BUILD = new URL('../../.test-build/screens/book/', import.meta.url);
const r = await import(new URL('pending-rules.js', BUILD).href);
const q = await import(new URL('pending-query.js', BUILD).href);

const LINK = {
  reference: 'WH-1042', shopName: 'North Street Cycles', jobDate: '2026-10-05', startTime: '09:30',
  description: 'Squeals when braking', bikeNote: 'Blue Trek road bike', answers: [], bike: null,
  stage: 'awaiting_confirmation', photoCount: 0,
  services: [{ name: 'Brake service', price: 20 }, { name: 'Gear service', price: 25.5 }], totalPrice: 45.5,
};

test('every stage has its words', () => {
  assert.deepEqual(r.STAGE_TEXT, {
    awaiting_confirmation: 'Awaiting shop confirmation',
    confirmed: 'Confirmed',
    in_workshop: 'In the workshop',
    ready_to_collect: 'Ready to collect',
    collected: 'Collected',
    change_requested: 'Change requested',
    declined: 'Declined',
    cancelled: 'Cancelled',
    request_expired: 'Request expired',
  });
  assert.equal(r.statusText('ready_to_collect'), 'Ready to collect');
});

test('the failure headings and how long "Copied" shows', () => {
  assert.equal(r.NOT_FOUND, "We can't find that booking");
  assert.equal(r.EXPIRED, 'This link has expired');
  assert.equal(r.LOAD_FAILED, "We couldn't load this booking");
  assert.equal(r.COPIED_MS, 2000);
});

test('the day and time: a timed booking has its time, a drop-off booking the day alone', () => {
  assert.equal(r.whenLine(LINK), 'Monday 5 October, 09:30');
  assert.equal(r.whenLine({ ...LINK, startTime: '' }), 'Monday 5 October');
});

test('services with their booked prices when shown, and the total as "From £T" with two or more services', () => {
  assert.deepEqual(r.serviceLines(LINK), [{ name: 'Brake service', price: '£20' }, { name: 'Gear service', price: '£25.50' }]);
  assert.equal(r.totalLine(LINK), 'From £45.50');
  const hidden = { ...LINK, services: [{ name: 'Brake service', price: null }], totalPrice: null };
  assert.deepEqual(r.serviceLines(hidden), [{ name: 'Brake service', price: null }]);
  assert.equal(r.totalLine(hidden), null);
});

test('with only one service there is no "From £" total line, even when its price is shown', () => {
  const one = { ...LINK, services: [{ name: 'Brake service', price: 20 }], totalPrice: 20 };
  assert.equal(r.totalLine(one), null);
});

test('answers read like the staff notes: the choice or "I\'m not sure", then any words; unanswered left out', () => {
  const link = {
    ...LINK,
    answers: [
      { wording: "What's wrong with the brakes?", answer: 'Squeaking', text: 'Front only' },
      { wording: 'Tubeless?', answer: 'Yes' },
      { wording: 'Which gear slips?', answer: { notSure: true } },
      { wording: 'Rattle?', answer: { notSure: true }, text: 'Somewhere at the back' },
      { wording: 'Anything else?', answer: null, text: 'Only in the rain' },
      { wording: 'Which wheel needs truing?', answer: 'The front' },
      { wording: 'Mudguards?', answer: null },
    ],
  };
  assert.deepEqual(r.answerLines(link), [
    { wording: "What's wrong with the brakes?", answer: 'Squeaking - Front only' },
    { wording: 'Tubeless?', answer: 'Yes' },
    { wording: 'Which gear slips?', answer: "I'm not sure" },
    { wording: 'Rattle?', answer: "I'm not sure - Somewhere at the back" },
    { wording: 'Anything else?', answer: 'Only in the rain' },
    { wording: 'Which wheel needs truing?', answer: 'The front' },
  ]);
});

test('the contact line names the shop', () => {
  assert.equal(r.contactLine('North Street Cycles'), 'Need to change or cancel? Contact North Street Cycles');
});

test('the address carries the shop and the code', () => {
  assert.equal(q.bookingLinkPath('north shop', 'ab12'), '/api/portal/north%20shop/booking-links/ab12');
});

// Telling the customer when to drop the bike off (Jack, 19 Oct,
// docs/decisions/2026-10-19-retire-old-workshop-settings.md answers 3 and 7;
// drawn in bk-confirmed and bk-when-dropoff).
test('the drop-off line: by the lead time before a set time, in the window for the whole day', () => {
  const trek = { ...LINK, bike: { make: 'Trek', model: 'Domane AL 3' } };
  const set = (leadMinutes, by) => ({ ...trek, dropOff: { by, booked: '11:30', leadMinutes } });
  assert.equal(r.dropOffLine(set(30, '11:00')), 'Drop your Trek Domane AL 3 off by 11:00, half an hour before your booking at 11:30.');
  assert.equal(r.dropOffLine(set(60, '10:30')), 'Drop your Trek Domane AL 3 off by 10:30, an hour before your booking at 11:30.');
  assert.equal(r.dropOffLine(set(90, '10:00')), 'Drop your Trek Domane AL 3 off by 10:00, an hour and a half before your booking at 11:30.');
  assert.equal(r.dropOffLine(set(15, '11:15')), 'Drop your Trek Domane AL 3 off by 11:15, 15 minutes before your booking at 11:30.');
  assert.equal(r.dropOffLine(set(120, '09:30')), 'Drop your Trek Domane AL 3 off by 09:30, 2 hours before your booking at 11:30.');
  assert.equal(r.dropOffLine(set(0, '11:30')), 'Drop your Trek Domane AL 3 off at your booking time, 11:30.');
  assert.equal(r.dropOffLine({ ...LINK, dropOff: { by: '09:00', booked: '09:30', leadMinutes: 30 } }), 'Drop your bike off by 09:00, half an hour before your booking at 09:30.');
  assert.equal(r.dropOffLine({ ...LINK, dropOff: { from: '09:00', to: '10:00' } }), 'Drop your bike off between 09:00 and 10:00.');
  assert.equal(r.dropOffLine({ ...LINK, dropOff: null }), null);
  assert.equal(r.dropOffLine(LINK), null);
});
