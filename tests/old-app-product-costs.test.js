// The old app when the server sends no cost (openspec/changes/product-costs-hidden):
// a dash, never £0.00, and a product's form never writes back an empty cost.
// public/app.js has no modules, so its small functions are taken from the file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const fn = (name) => {
  const at = src.indexOf(`function ${name}(`);
  assert.ok(at >= 0, `${name} is in app.js`);
  return src.slice(at, src.indexOf('\n}\n', at) + 3);
};
const { costFromForm, marginOf } = new Function(`${fn('costFromForm')}\n${fn('marginOf')}\nreturn { costFromForm, marginOf };`)();

test('a cost box left empty, or not there, sends no cost; a figure, 0 included, is sent', () => {
  assert.equal(costFromForm(null), undefined, 'no box: the cost wasn’t shown');
  assert.equal(costFromForm({ value: '' }), undefined);
  assert.equal(costFromForm({ value: 'x' }), undefined);
  assert.equal(costFromForm({ value: '12.50' }), 12.5);
  assert.equal(costFromForm({ value: '0' }), 0);
  assert.equal(JSON.stringify({ name: '[Product]', cost: costFromForm({ value: '' }) }), '{"name":"[Product]"}', 'and so isn’t in what’s saved');
});

test('the form uses it, offers no box for a cost not sent, and never turns an empty box into 0', () => {
  assert.ok(src.includes("cost: costFromForm(document.getElementById('f-cost'))"));
  assert.ok(!src.includes("parseFloat(document.getElementById('f-cost').value) || 0"));
  assert.match(src, /product && !Number\.isFinite\(product\.cost\)[\s\S]{0,200}costOrDash\(product\.cost\)/);
});

test('margin: from a cost sent; none, not 100%, without one', () => {
  assert.equal(Math.round(marginOf(24, 12)), 50);
  assert.equal(marginOf(24, null), null);
  assert.equal(marginOf(24, undefined), null);
  assert.equal(marginOf(0, 12), null);
});

test('every place the old app shows a cost uses a dash when it isn’t sent', () => {
  for (const shown of [
    '<td class="num">${costOrDash(p.cost)}</td>',
    '${costOrDash(p.cost)} cost',
    '<span class="detail-value">${costOrDash(product.cost)}</span>',
    '<td class="num">${costOrDash(it.price)}</td>',
    'value="${costOrDash(item.price)}" disabled',
    'costOrDash(it.qty * it.unitCost)',
    'costOrDash(poFormItems[idx].qty * poFormItems[idx].unitCost)',
  ]) assert.ok(src.includes(shown), shown);
  for (const gone of ['money(p.cost)', 'money(product.cost)', 'money(it.price)', 'money(item.price)', 'money(it.qty * it.unitCost)', '(netPrice - p.cost)', '(netPrice - product.cost)']) {
    assert.ok(!src.includes(gone), gone);
  }
});

test('an order’s line with no cost sent has no box to save one from', () => {
  assert.match(src, /Number\.isFinite\(it\.unitCost\)\s*\?\s*`£<input[^`]*po-cost-input/);
});
