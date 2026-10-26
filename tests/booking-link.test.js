// The booking link's pure parts: code, hash, path, expiry, stage.
// Spec: docs/superpowers/specs/2026-09-25-book-server-4-guest-link-design.md
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { newLinkCode, hashLinkCode, linkPath, isLinkExpired, linkExpiry, bookingStage } from '../server/booking-link.js';

test('a code is 64 hex characters and never repeats', () => {
  const a = newLinkCode();
  const b = newLinkCode();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, b);
});

test('the hash is SHA-256 of the code, and is not the code', () => {
  const code = newLinkCode();
  assert.equal(hashLinkCode(code), createHash('sha256').update(code).digest('hex'));
  assert.notEqual(hashLinkCode(code), code);
});

test('the path is /book/<shop>/booking/<code>', () => {
  assert.equal(linkPath('acme', 'abc'), '/book/acme/booking/abc');
});

test('the link works up to and including day 30 after the booked date', () => {
  assert.equal(isLinkExpired('2030-01-01', '2030-01-01'), false);
  assert.equal(isLinkExpired('2030-01-01', '2029-12-01'), false);
  assert.equal(isLinkExpired('2030-01-01', '2030-01-31'), false);
  assert.equal(isLinkExpired('2030-01-01', '2030-02-01'), true);
});

test('expiry counts across a month and a year end', () => {
  assert.equal(isLinkExpired('2030-12-15', '2031-01-14'), false);
  assert.equal(isLinkExpired('2030-12-15', '2031-01-15'), true);
});

test('an unparseable job date reads as expired rather than throwing', () => {
  assert.equal(isLinkExpired('2026-13-01', '2026-01-01'), true);
});

const stage = (booking_state, custody_state = 'expected', work_state = 'not_started') =>
  bookingStage({ booking_state, custody_state, work_state });

test('booking states other than scheduled decide the stage', () => {
  assert.equal(stage('pending'), 'awaiting_confirmation');
  assert.equal(stage('reschedule_requested'), 'change_requested');
  assert.equal(stage('declined'), 'declined');
  assert.equal(stage('expired'), 'request_expired');
  assert.equal(stage('cancelled'), 'cancelled');
  assert.equal(stage('pending', 'in_shop', 'complete'), 'awaiting_confirmation');
});

test('a scheduled booking follows custody and work', () => {
  assert.equal(stage('scheduled'), 'confirmed');
  assert.equal(stage('scheduled', 'in_shop', 'not_started'), 'in_workshop');
  assert.equal(stage('scheduled', 'in_shop', 'waiting_parts'), 'in_workshop');
  assert.equal(stage('scheduled', 'in_shop', 'complete'), 'ready_to_collect');
  assert.equal(stage('scheduled', 'collected', 'complete'), 'collected');
});

// Build-plan Q8 (Jack, 3 Oct; booking page stages, 21 Oct): 30 days after
// collection, or after the booked date if the bike never came in; a bike
// still in the shop keeps its link.
test('a collected bike’s link works for 30 days after collection, whatever the booked date', () => {
  assert.deepEqual(linkExpiry({ jobDate: '2026-10-01', custodyState: 'collected', collectedOn: '2026-11-10' }, '2026-12-10'), { expired: false, reason: null });
  assert.deepEqual(linkExpiry({ jobDate: '2026-10-01', custodyState: 'collected', collectedOn: '2026-11-10' }, '2026-12-11'), { expired: true, reason: 'collected' });
});

test('a bike in the shop keeps its link, however long ago it was booked', () => {
  assert.deepEqual(linkExpiry({ jobDate: '2026-10-01', custodyState: 'in_shop', collectedOn: null }, '2027-01-01'), { expired: false, reason: null });
});

test('a bike that never came in: 30 days after the booked date', () => {
  assert.deepEqual(linkExpiry({ jobDate: '2026-10-01', custodyState: 'expected', collectedOn: null }, '2026-10-31'), { expired: false, reason: null });
  assert.deepEqual(linkExpiry({ jobDate: '2026-10-01', custodyState: 'expected', collectedOn: null }, '2026-11-01'), { expired: true, reason: 'never_came_in' });
});

test('a bike collected before collection was recorded counts from its booked date', () => {
  assert.deepEqual(linkExpiry({ jobDate: '2026-10-01', custodyState: 'collected', collectedOn: null }, '2026-11-01'), { expired: true, reason: 'collected' });
});
