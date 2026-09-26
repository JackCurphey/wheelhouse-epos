// The booking request's new fields, checked without a server.
// Spec: docs/superpowers/specs/2026-09-25-book-server-3-booking-request-design.md
// Spec (several services): docs/superpowers/specs/2026-09-26-book-server-7-multiple-services-design.md
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBookingRequest } from '../server/booking-request.js';

const ok = { serviceIds: [7], email: 'a@example.com', updateChannel: 'email', termsAccepted: true };
const parse = (over = {}, phone = '') => parseBookingRequest({ ...ok, ...over }, phone);

test('a list of services is kept in order', () => {
  const r = parseBookingRequest({ serviceIds: [7, 3], email: 'a@example.com', updateChannel: 'email', termsAccepted: true }, '');
  assert.deepEqual(r.value.serviceIds, [7, 3]);
  assert.equal(r.value.notSure, false);
});

test('not sure has no services', () => {
  const r = parseBookingRequest({ notSure: true, email: 'a@example.com', updateChannel: 'email', termsAccepted: true }, '');
  assert.deepEqual(r.value.serviceIds, []);
  assert.equal(r.value.notSure, true);
});

test('service list refusals', () => {
  const base = { email: 'a@example.com', updateChannel: 'email', termsAccepted: true };
  const err = (extra) => parseBookingRequest({ ...base, ...extra }, '').error;
  assert.equal(err({}), 'Please choose a service, or "not sure"');
  assert.equal(err({ serviceId: 7 }), 'Please choose a service, or "not sure"');
  assert.equal(err({ serviceIds: [7], notSure: true }), 'Choose services, or "not sure" - not both');
  assert.equal(err({ serviceIds: [] }), 'That service is not available to book');
  assert.equal(err({ serviceIds: 7 }), 'That service is not available to book');
  assert.equal(err({ serviceIds: [7, 'x'] }), 'That service is not available to book');
  assert.equal(err({ serviceIds: [0] }), 'That service is not available to book');
  assert.equal(err({ serviceIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }), 'Please choose up to 10 services');
  assert.equal(err({ serviceIds: [4, 4] }), 'Each service can be chosen only once');
});

test('an unknown update channel is refused', () => {
  assert.match(parse({ updateChannel: 'fax' }).error, /how you.d like/i);
  assert.match(parse({ updateChannel: undefined }).error, /how you.d like/i);
});

test('the email channel needs an email address', () => {
  assert.match(parse({ email: '' }).error, /email address/i);
  assert.match(parse({ email: 'not-an-email' }).error, /email address/i);
});

test('sms and whatsapp need a phone number, not an email', () => {
  for (const updateChannel of ['sms', 'whatsapp']) {
    assert.match(parse({ updateChannel, email: '' }, '').error, /phone number/i);
    assert.equal(parse({ updateChannel, email: '' }, '07700 900123').value.updateChannel, updateChannel);
  }
});

test('an email that is sent on another channel must still be a real-looking address', () => {
  assert.match(parse({ updateChannel: 'sms', email: 'nope' }, '07700 900123').error, /email address/i);
});

test('terms must be accepted, as exactly true', () => {
  for (const bad of [false, 'true', 1, undefined]) {
    assert.match(parse({ termsAccepted: bad }).error, /terms/i, `accepted ${JSON.stringify(bad)}`);
  }
});

test('marketing permission is true only when sent as true', () => {
  assert.equal(parse({ marketingPermission: true }).value.marketingPermission, true);
  for (const v of [false, 'true', 1, undefined]) {
    assert.equal(parse({ marketingPermission: v }).value.marketingPermission, false);
  }
});
