// The note-and-coin counter's sums (building block 18; openspec/changes/
// note-coin-counter; cash-up decision 3). Every amount is whole pence.
// The example count is the one drawn in eod-count (cashup.mjs EXAMPLE_COUNT).
import test from 'node:test';
import assert from 'node:assert/strict';
import { DENOMINATIONS, countedPence, parseTotal, penceText } from '../../src/lib/cash-count.ts';

const DRAWN = { '£20': '6', '£10': '5', '£5': '4', '£2': '3', '£1': '8', '50p': '6', '20p': '5', '10p': '7' };

test('the twelve notes and coins, £50 down to 1p, in pence', () => {
  assert.deepEqual(DENOMINATIONS.map((d) => d.label), ['£50', '£20', '£10', '£5', '£2', '£1', '50p', '20p', '10p', '5p', '2p', '1p']);
  assert.deepEqual(DENOMINATIONS.map((d) => d.pence), [5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1]);
});

test('the drawing’s count adds up to £208.70', () => {
  assert.equal(countedPence(DRAWN), 20870);
  assert.equal(penceText(countedPence(DRAWN)), '£208.70');
});

test('coins add up exactly: 10p and 20p is 30 pence', () => {
  const p = countedPence({ '10p': '1', '20p': '1' });
  assert.equal(p, 30);
  assert.ok(Number.isInteger(p));
  assert.equal(countedPence({ '1p': '7', '2p': '1', '5p': '3' }), 24);
});

test('nothing counted while every box is empty', () => {
  assert.equal(countedPence({}), null);
  assert.equal(countedPence({ '£20': '', '1p': '' }), null);
  assert.equal(countedPence({ '£20': '0' }), 0);
});

test('a typed total is read in whole pence', () => {
  assert.deepEqual(parseTotal('208.70'), { pence: 20870 });
  assert.deepEqual(parseTotal('£208.70'), { pence: 20870 });
  assert.deepEqual(parseTotal(' £ 208.7 '), { pence: 20870 });
  assert.deepEqual(parseTotal('150'), { pence: 15000 });
  assert.deepEqual(parseTotal('0.29'), { pence: 29 });
  assert.deepEqual(parseTotal('1.1'), { pence: 110 });
  assert.deepEqual(parseTotal('0.05'), { pence: 5 });
});

test('an empty total is nothing typed', () => {
  assert.equal(parseTotal(''), null);
  assert.equal(parseTotal('   '), null);
});

test('a total that isn’t pounds and pence is wrong', () => {
  for (const bad of ['12.345', 'abc', '-5', '1.2.3', '£', '.5x']) {
    assert.deepEqual(parseTotal(bad), { invalid: true }, bad);
  }
});

test('pence shown as pounds', () => {
  assert.equal(penceText(5), '£0.05');
  assert.equal(penceText(0), '£0.00');
  assert.equal(penceText(12000), '£120.00');
  assert.equal(penceText(20870), '£208.70');
});
