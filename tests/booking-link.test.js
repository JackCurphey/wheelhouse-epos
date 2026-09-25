// The private link's pure parts: code, hash, path, expiry, stage.
// Spec: docs/superpowers/specs/2026-09-25-book-server-4-guest-link-design.md
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { newLinkCode, hashLinkCode, linkPath, isLinkExpired, bookingStage } from '../server/booking-link.js';

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
