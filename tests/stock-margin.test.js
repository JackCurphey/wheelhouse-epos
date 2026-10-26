// A product's margin (openspec/changes/stock-list; stock decision 11; its review, 26 Oct):
// on the price before VAT, with the product's own rate; none without a price, or without a cost.
import test from 'node:test';
import assert from 'node:assert/strict';

const { margin, marginText } = await import(new URL('../.test-build/screens/stock/stock-bits.js', import.meta.url).href);

test('£28 at 20% VAT with a £14 cost is a 40% margin', () => {
  assert.equal(margin({ price: 28, cost: 14, vatRateBp: 2000 }), 40);
});

test('no cost recorded (0, as the old app saves it) is no margin, not 100%', () => {
  assert.equal(margin({ price: 28, cost: 0, vatRateBp: 2000 }), null);
  assert.equal(marginText({ price: 28, cost: 0, vatRateBp: 2000 }), '—');
  assert.equal(margin({ price: 28, cost: null, vatRateBp: 2000 }), null);
});

test('no price is no margin', () => {
  assert.equal(margin({ price: 0, cost: 5, vatRateBp: 2000 }), null);
});
