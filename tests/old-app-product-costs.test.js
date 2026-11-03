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
const { costFromForm, marginOf, costBoxHidden, poLineCost, poLineTotal } = new Function(
  `${fn('money')}\n${fn('costOrDash')}\n${fn('costFromForm')}\n${fn('marginOf')}\n${fn('costBoxHidden')}\n${fn('poLineCost')}\n${fn('poLineTotal')}\nreturn { costFromForm, marginOf, costBoxHidden, poLineCost, poLineTotal };`,
)();

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
  assert.match(src, /costBoxHidden\(product, currentUser\)[\s\S]{0,200}costOrDash\(product\?\.cost\)/);
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
    'poLineTotal(it.qty, it.unitCost)',
    'poLineTotal(poFormItems[idx].qty, poFormItems[idx].unitCost)',
  ]) assert.ok(src.includes(shown), shown);
  for (const gone of ['money(p.cost)', 'money(product.cost)', 'money(it.price)', 'money(item.price)', 'money(it.qty * it.unitCost)', 'costOrDash(it.qty * it.unitCost)', 'costOrDash(poFormItems[idx].qty * poFormItems[idx].unitCost)', '(netPrice - p.cost)', '(netPrice - product.cost)']) {
    assert.ok(!src.includes(gone), gone);
  }
});

test('an order’s line with no cost sent has no box to save one from; an emptied box stays a box', () => {
  assert.match(src, /it\.costHidden\s*\?\s*'—'\s*:\s*`£<input[^`]*po-cost-input[^`]*value="\$\{it\.unitCost \?\? ''\}"/);
  assert.ok(src.includes('unitCost: product.cost, costHidden: !Number.isFinite(product.cost)'), 'a line added');
  assert.ok(src.includes('unitCost: it.unitCost, costHidden: !Number.isFinite(it.unitCost)'), 'a draft’s line');
});

test('adding a product: no cost box when the server says costs are hidden', () => {
  assert.equal(costBoxHidden(null, { canSeeCosts: false }), true, 'a typed cost would be thrown away');
  assert.equal(costBoxHidden(null, { canSeeCosts: true }), false);
  assert.equal(costBoxHidden(null, { isOwner: true }), false, 'just signed up, not yet told: the shop’s new Owner');
  assert.equal(costBoxHidden({ cost: null }, { canSeeCosts: true }), true, 'editing: the product’s own reply decides');
  assert.equal(costBoxHidden({ cost: 12 }, { canSeeCosts: false }), false);
});

test('an order line’s cost box: empty is no cost, not £0; £0 typed on purpose is £0', () => {
  assert.equal(poLineCost(''), null);
  assert.equal(poLineCost('   '), null);
  assert.equal(poLineCost('0'), 0);
  assert.equal(poLineCost('12.50'), 12.5);
  assert.equal(poLineCost('-1'), 0, 'never below nothing, as before');
  assert.ok(src.includes('poFormItems[idx].unitCost = poLineCost(e.target.value);'));
});

test('an order line’s total: a dash, not a false £0.00, with no cost', () => {
  assert.equal(poLineTotal(2, null), '—');
  assert.equal(poLineTotal(2, undefined), '—');
  assert.equal(poLineTotal(2, 0), '£0.00');
  assert.equal(poLineTotal(2, 1.5), '£3.00');
});
