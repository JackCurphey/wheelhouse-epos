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
import {
  defineMachine, custody, bookingRequest, work, readLegacyStatus, quote, canApprove,
  capacityHold, settleRace,
} from '../server/workshop/state-machines.js';

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

test('work moves through the states a mechanic actually works in', () => {
  assert.equal(work.next('not_started', 'start'), 'in_progress');
  assert.equal(work.next('in_progress', 'await_parts'), 'waiting_parts');
  assert.equal(work.next('waiting_parts', 'parts_arrived'), 'in_progress');
  assert.equal(work.next('in_progress', 'finish'), 'complete');
});

test('a job can be put on hold from anywhere it is live, and resumed', () => {
  assert.equal(work.next('in_progress', 'hold'), 'on_hold');
  assert.equal(work.next('waiting_parts', 'hold'), 'on_hold');
  assert.equal(work.next('on_hold', 'resume'), 'in_progress');
});

test('finished work can be reopened, because final checks fail', () => {
  assert.equal(work.next('complete', 'reopen'), 'in_progress');
});

test('work completion says nothing about collection', () => {
  // The whole reason this phase exists: "complete" used to mean both.
  assert.equal(work.states.includes('collected'), false);
  assert.deepEqual(work.events('complete'), ['reopen']);
});

test('the old single status is read as three independent facts', () => {
  assert.deepEqual(readLegacyStatus('pending'),
    { booking: 'pending', work: 'not_started', custody: 'expected' });
  assert.deepEqual(readLegacyStatus('scheduled'),
    { booking: 'scheduled', work: 'not_started', custody: 'expected' });
  assert.deepEqual(readLegacyStatus('waiting_parts'),
    { booking: 'scheduled', work: 'waiting_parts', custody: 'in_shop' });
  assert.deepEqual(readLegacyStatus('on_hold'),
    { booking: 'scheduled', work: 'on_hold', custody: 'in_shop' });
});

test('the old "complete" cannot say whether the bike went home', () => {
  // This is the ambiguity being broken, and it cannot be resolved by reading
  // the old column - the information was never recorded. Phase 2 must decide
  // what to backfill; it must not guess silently here.
  assert.deepEqual(readLegacyStatus('complete'),
    { booking: 'scheduled', work: 'complete', custody: null });
});

test('an unrecognised legacy status is refused rather than guessed', () => {
  assert.throws(() => readLegacyStatus('nonsense'), /unknown legacy status: nonsense/);
});

test('a quote is sent, and the customer decides line by line', () => {
  assert.equal(quote.next('draft', 'send'), 'sent');
  assert.equal(quote.next('sent', 'approve_all'), 'approved');
  assert.equal(quote.next('sent', 'approve_some'), 'partly_approved');
  assert.equal(quote.next('sent', 'decline_all'), 'declined');
});

test('revising a sent quote supersedes it rather than editing it', () => {
  // The amounts the customer saw must survive. A new revision is a new
  // proposal; the old one becomes history.
  assert.equal(quote.next('sent', 'revise'), 'superseded');
  assert.equal(quote.next('partly_approved', 'revise'), 'superseded');
});

test('a superseded quote can never be approved', () => {
  assert.throws(() => quote.next('superseded', 'approve_all'),
    /quote: cannot approve_all from superseded/);
});

test('a stale approval link is refused, naming why', () => {
  const result = canApprove({ quoteState: 'sent', linkRevision: 1, currentRevision: 2 });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /revision 1.*revision 2/);
});

test('an approval link for the current revision is allowed', () => {
  assert.deepEqual(canApprove({ quoteState: 'sent', linkRevision: 2, currentRevision: 2 }),
    { allowed: true, reason: null });
});

test('a current link against a superseded quote is still refused', () => {
  // Both checks must hold. Matching revision numbers are not enough if the
  // quote itself is no longer the live one.
  const result = canApprove({ quoteState: 'superseded', linkRevision: 2, currentRevision: 2 });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /superseded/);
});

test('approving twice is refused rather than silently repeated', () => {
  const result = canApprove({ quoteState: 'approved', linkRevision: 1, currentRevision: 1 });
  assert.equal(result.allowed, false);
});

test('a hold is taken, then confirmed or let go', () => {
  assert.equal(capacityHold.next('held', 'confirm'), 'confirmed');
  assert.equal(capacityHold.next('held', 'expire'), 'expired');
  assert.equal(capacityHold.next('held', 'release'), 'released');
});

test('an expired or released hold stops consuming capacity and cannot return', () => {
  // A hold that still counted after expiry would make the diary lie about
  // available space.
  assert.throws(() => capacityHold.next('expired', 'confirm'),
    /capacityHold: cannot confirm from expired/);
  assert.throws(() => capacityHold.next('released', 'confirm'),
    /capacityHold: cannot confirm from released/);
});

test('a confirmed hold can be released when the booking is cancelled', () => {
  assert.equal(capacityHold.next('confirmed', 'release'), 'released');
});

test('two requests for the last slot produce exactly one winner', () => {
  const result = settleRace([
    { id: 'a', state: 'held' },
    { id: 'b', state: 'held' },
  ]);
  assert.equal(result.winner, 'a');
  assert.deepEqual(result.losers, ['b']);
});

test('an expired hold does not win, even if it asked first', () => {
  const result = settleRace([
    { id: 'a', state: 'expired' },
    { id: 'b', state: 'held' },
  ]);
  assert.equal(result.winner, 'b');
});

test('no live holds means no winner, not an arbitrary one', () => {
  assert.deepEqual(settleRace([{ id: 'a', state: 'expired' }]),
    { winner: null, losers: ['a'] });
});
