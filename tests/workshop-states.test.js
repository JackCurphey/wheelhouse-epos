// tests/workshop-states.test.js
//
// The workshop's state machines. These exist because workshop_jobs.status is
// one TEXT column with five values and no transition rules, so today any value
// can become any other and "complete" means four different things: work done,
// bike collected, quote agreed, or the job closed. Phase 2 derives its schema
// from these declarations, so an illegal transition that passes here becomes an
// illegal row later.
//
// Every machine is pure: a state plus an event gives a state. Expiry is an
// event, not a clock, so these tests never wait.
import test from 'node:test';
import assert from 'node:assert/strict';
import { defineMachine, custody, bookingRequest } from '../server/workshop/state-machines.js';

test('defineMachine rejects a transition to a state it does not declare', () => {
  assert.throws(
    () => defineMachine({
      name: 'broken',
      initial: 'a',
      states: ['a', 'b'],
      transitions: { a: { go: 'c' } },
    }),
    /broken: transition a --go--> c names an undeclared state/,
  );
});

test('defineMachine rejects an initial state it does not declare', () => {
  assert.throws(
    () => defineMachine({ name: 'broken', initial: 'z', states: ['a'], transitions: {} }),
    /broken: initial state z is not declared/,
  );
});

test('a legal custody transition returns the next state', () => {
  assert.equal(custody.next('expected', 'book_in'), 'in_shop');
  assert.equal(custody.next('in_shop', 'collect'), 'collected');
});

test('an illegal custody transition throws, naming machine, state and event', () => {
  assert.throws(
    () => custody.next('expected', 'collect'),
    /custody: cannot collect from expected/,
  );
});

test('a bike can come back after collection, because shops reopen jobs', () => {
  assert.equal(custody.next('collected', 'reopen'), 'in_shop');
});

test('can() answers without throwing', () => {
  assert.equal(custody.can('expected', 'book_in'), true);
  assert.equal(custody.can('expected', 'collect'), false);
});

test('events() lists what is possible from a state', () => {
  assert.deepEqual(custody.events('in_shop').sort(), ['collect']);
});

test('a request the shop accepts becomes scheduled', () => {
  assert.equal(bookingRequest.next('pending', 'accept'), 'scheduled');
});

test('a request can be declined, expire, or be withdrawn by the customer', () => {
  assert.equal(bookingRequest.next('pending', 'decline'), 'declined');
  assert.equal(bookingRequest.next('pending', 'expire'), 'expired');
  assert.equal(bookingRequest.next('pending', 'cancel'), 'cancelled');
});

test('an expired request cannot be accepted afterwards', () => {
  // The four-hour hold released its capacity. Accepting now would promise
  // space that another booking may already have taken.
  assert.throws(() => bookingRequest.next('expired', 'accept'),
    /bookingRequest: cannot accept from expired/);
});

test('a declined request is terminal - a shop that changes its mind starts a new one', () => {
  assert.deepEqual(bookingRequest.events('declined'), []);
  assert.ok(bookingRequest.terminal.includes('declined'));
});

test('asking to move a confirmed booking keeps the original until the shop agrees', () => {
  // The old date must still be held. A failed move that had already released
  // the original slot would lose the customer their booking.
  assert.equal(bookingRequest.next('scheduled', 'request_reschedule'), 'reschedule_requested');
  assert.equal(bookingRequest.next('reschedule_requested', 'accept'), 'scheduled');
  assert.equal(bookingRequest.next('reschedule_requested', 'decline'), 'scheduled');
});

test('a scheduled booking can still be cancelled by either side', () => {
  assert.equal(bookingRequest.next('scheduled', 'cancel'), 'cancelled');
});
