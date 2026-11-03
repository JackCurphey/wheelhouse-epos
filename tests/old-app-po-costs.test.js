// The old app's order pages when the server sends no costs
// (openspec/changes/delivery-booked-in, design 7): a dash, not £0.00, which
// would read as a real cost. public/app.js has no modules, so its two small
// functions are taken from the file itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const fn = (name) => {
  const at = src.indexOf(`function ${name}(`);
  assert.ok(at >= 0, `${name} is in app.js`);
  return src.slice(at, src.indexOf('\n}\n', at) + 3);
};
const { poTotalCost, costOrDash } = new Function(`${fn('money')}\n${fn('costOrDash')}\n${fn('poTotalCost')}\nreturn { poTotalCost, costOrDash };`)();

test('a cost sent shows as money, £0.00 included; a cost not sent shows a dash', () => {
  assert.equal(costOrDash(28), '£28.00');
  assert.equal(costOrDash(0), '£0.00');
  assert.equal(costOrDash(undefined), '—');
  assert.equal(costOrDash(NaN), '—');
});

test('an order’s total: the sum when costs are sent; not a number at all when they aren’t', () => {
  assert.equal(poTotalCost({ items: [{ qtyOrdered: 2, unitCost: 3 }, { qtyOrdered: 1, unitCost: 4 }] }), 10);
  assert.equal(costOrDash(poTotalCost({ items: [{ qtyOrdered: 2 }] })), '—');
});

test('an order’s list, its lines and its total all use it', () => {
  assert.ok(src.includes('${costOrDash(poTotalCost(po))}'), 'the list and the total');
  assert.ok(src.includes('${costOrDash(it.unitCost)}'), 'a line’s cost');
  assert.ok(src.includes('${costOrDash(it.qtyOrdered * it.unitCost)}'), 'a line’s total');
  assert.ok(!src.includes('money(poTotalCost(po))'));
  assert.ok(!src.includes('${money(it.unitCost)}'));
  assert.ok(!src.includes('${money(it.qtyOrdered * it.unitCost)}'));
});
