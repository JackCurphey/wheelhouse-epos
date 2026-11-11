// A product's margin (openspec/changes/stock-list; stock decision 11; its review, 26 Oct):
// on the price before VAT, with the product's own rate; none without a price, or without a cost.
import test from 'node:test';
import assert from 'node:assert/strict';

const { margin, marginText, money } = await import(new URL('../.test-build/screens/stock/stock-bits.js', import.meta.url).href);

test('a figure in pence shows exactly: every one to £1,000.00, and the most a product can hold', () => {
  for (let p = 0; p <= 100000; p += 1) {
    const pounds = String(Math.floor(p / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    assert.equal(money(p), `£${pounds}.${String(p % 100).padStart(2, '0')}`);
  }
  assert.equal(money(2800), '£28.00');
  assert.equal(money(9999999999), '£99,999,999.99');
});

test('£28 at 20% VAT with a £14 cost is a 40% margin', () => {
  assert.equal(margin({ pricePence: 2800, costPence: 1400, vatRateBp: 2000 }), 40);
});

test('a half point rounds up, worked on whole pence: £12.00 with a £9.55 cost at 20% VAT is 4.5%, so 5%', () => {
  assert.equal(margin({ pricePence: 1200, costPence: 955, vatRateBp: 2000 }), 5);
});

test('no cost recorded (0, as the old app saves it) is no margin, not 100%', () => {
  assert.equal(margin({ pricePence: 2800, costPence: 0, vatRateBp: 2000 }), null);
  assert.equal(marginText({ pricePence: 2800, costPence: 0, vatRateBp: 2000 }), '—');
  assert.equal(margin({ pricePence: 2800, costPence: null, vatRateBp: 2000 }), null);
});

test('no price is no margin', () => {
  assert.equal(margin({ pricePence: 0, costPence: 500, vatRateBp: 2000 }), null);
});
