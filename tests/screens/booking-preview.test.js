// Preview what the customer sees (Jack, 19 Oct, docs/decisions/2026-10-19-booking-preview.md;
// drawn as bk-settings-preview): the drawings' example booking, worded with
// the shop's own saved settings.
import test from 'node:test';
import assert from 'node:assert/strict';

const BUILD = new URL('../../.test-build/screens/settings/', import.meta.url);
const { previewLines } = await import(new URL('booking-preview.js', BUILD).href);

const NOTE = 'Please bring the lock key, and tell us about any accessories.';
const TIMED = { bookingMode: 'timed', timedLeadMinutes: 30, dropoffWindowStart: '09:00', dropoffWindowEnd: '10:00', confirmationNote: NOTE, showPricesOnline: true };

test('a set time: the drop-off time, then the note, and the booked time', () => {
  const p = previewLines(TIMED);
  assert.equal(p.arrival, `Drop your Trek Domane AL 3 off by 11:00, half an hour before your booking at 11:30. ${NOTE}`);
  assert.equal(p.when, 'Thursday 17 September, 11:30');
  assert.equal(p.service, 'Standard service · £65');
  assert.equal(p.heading, 'See you on Thursday 17 September, Maya');
  assert.equal(p.bike, 'Trek Domane AL 3 · green');
});

test('the shop’s own lead time, and a lead of 0', () => {
  assert.equal(previewLines({ ...TIMED, timedLeadMinutes: 60, confirmationNote: '' }).arrival, 'Drop your Trek Domane AL 3 off by 10:30, an hour before your booking at 11:30.');
  assert.equal(previewLines({ ...TIMED, timedLeadMinutes: 0, confirmationNote: '' }).arrival, 'Drop your Trek Domane AL 3 off at your booking time, 11:30.');
});

test('the whole day: the drop-off window, and the day without a time', () => {
  const p = previewLines({ ...TIMED, bookingMode: 'dropoff', dropoffWindowStart: '08:30', dropoffWindowEnd: '09:30' });
  assert.equal(p.arrival, `Drop your Trek Domane AL 3 off between 08:30 and 09:30. ${NOTE}`);
  assert.equal(p.when, 'Thursday 17 September');
});

test('with no note nothing follows; with prices off, no price', () => {
  const p = previewLines({ ...TIMED, confirmationNote: '', showPricesOnline: false });
  assert.equal(p.arrival, 'Drop your Trek Domane AL 3 off by 11:00, half an hour before your booking at 11:30.');
  assert.equal(p.service, 'Standard service');
});
