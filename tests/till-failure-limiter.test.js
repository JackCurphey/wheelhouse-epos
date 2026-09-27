// tests/till-failure-limiter.test.js
// A pure, injected-clock limiter that counts only failures - see the review
// finding on Task 6: a limiter that counts every request (valid or not) can
// lock out a working till after a burst of legitimate traffic. This one only
// ever advances on recordFailure(); a successful lookup calls clear(), never
// isBlocked() or recordFailure().
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFailureLimiter } from '../server/till/failure-limiter.js';

test('19 failures are not blocked, the 20th blocks', () => {
  let now = 1000;
  const limiter = makeFailureLimiter(20, 60 * 1000, () => now);
  for (let i = 0; i < 19; i++) limiter.recordFailure('k');
  assert.equal(limiter.isBlocked('k'), false);
  limiter.recordFailure('k');
  assert.equal(limiter.isBlocked('k'), true);
});

test('isBlocked calls do not themselves count as failures', () => {
  let now = 1000;
  const limiter = makeFailureLimiter(20, 60 * 1000, () => now);
  for (let i = 0; i < 19; i++) limiter.recordFailure('k');
  for (let i = 0; i < 50; i++) limiter.isBlocked('k');
  assert.equal(limiter.isBlocked('k'), false);
});

test('clear unblocks the key', () => {
  let now = 1000;
  const limiter = makeFailureLimiter(20, 60 * 1000, () => now);
  for (let i = 0; i < 20; i++) limiter.recordFailure('k');
  assert.equal(limiter.isBlocked('k'), true);
  limiter.clear('k');
  assert.equal(limiter.isBlocked('k'), false);
});

test('the window expires and unblocks the key', () => {
  let now = 1000;
  const limiter = makeFailureLimiter(20, 60 * 1000, () => now);
  for (let i = 0; i < 20; i++) limiter.recordFailure('k');
  assert.equal(limiter.isBlocked('k'), true);
  now += 60 * 1000; // window started at the first failure; now expired
  assert.equal(limiter.isBlocked('k'), false);
});

test('keys are independent', () => {
  let now = 1000;
  const limiter = makeFailureLimiter(20, 60 * 1000, () => now);
  for (let i = 0; i < 20; i++) limiter.recordFailure('a');
  assert.equal(limiter.isBlocked('a'), true);
  assert.equal(limiter.isBlocked('b'), false);
});
