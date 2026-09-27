import test from 'node:test';
import assert from 'node:assert/strict';
import { vatFromGrossPence, receiptLabel } from '../server/till/money.js';

test('VAT is extracted from a VAT-inclusive price', () => {
  assert.equal(vatFromGrossPence(1200, 2000), 200); // £12.00 at 20% → £2.00
  assert.equal(vatFromGrossPence(999, 2000), 167);  // 166.5 rounds half-up to 167
  assert.equal(vatFromGrossPence(1050, 500), 50);   // 5%
  assert.equal(vatFromGrossPence(1234, 0), 0);      // zero-rated
  assert.equal(vatFromGrossPence(0, 2000), 0);
});

test('VAT on a negative line (a discount line) is negative', () => {
  assert.equal(vatFromGrossPence(-1200, 2000), -200);
});

test('receipt labels are till code plus a padded number', () => {
  assert.equal(receiptLabel('B1', 42), 'B1-0042');
  assert.equal(receiptLabel('B1', 1042), 'B1-1042');
  assert.equal(receiptLabel('SAL2', 12345), 'SAL2-12345');
});
