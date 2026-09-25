// The booking request's new fields, checked without a server.
// Spec: docs/superpowers/specs/2026-09-25-book-server-3-booking-request-design.md
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBookingRequest } from '../server/booking-request.js';

const ok = { serviceId: 7, email: 'a@example.com', updateChannel: 'email', termsAccepted: true };
const parse = (over = {}, phone = '') => parseBookingRequest({ ...ok, ...over }, phone);

test('a service id, an email and consent parse', () => {
  assert.deepEqual(parse(), {
    value: {
      serviceId: 7, notSure: false, email: 'a@example.com',
      updateChannel: 'email', termsAccepted: true, marketingPermission: false,
    },
  });
});

test('not sure parses with no service id', () => {
  const r = parseBookingRequest({ notSure: true, email: 'a@example.com', updateChannel: 'email', termsAccepted: true }, '');
  assert.equal(r.value.notSure, true);
  assert.equal(r.value.serviceId, null);
});

test('both a service and not sure is refused', () => {
  assert.match(parse({ notSure: true }).error, /one/i);
});

test('neither a service nor not sure is refused', () => {
  assert.match(parseBookingRequest({ email: 'a@example.com', updateChannel: 'email', termsAccepted: true }, '').error, /service/i);
});

test('a service id that is not a whole number is refused', () => {
  for (const bad of ['7', 1.5, 0, -1, null]) {
    assert.ok(parse({ serviceId: bad }).error, `accepted serviceId ${JSON.stringify(bad)}`);
  }
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
