// The note-and-coin counter (building block 18; openspec/changes/
// note-coin-counter): drawn as denomGrid and totalBox in eod-count
// (docs/design/user-journeys/generator/cashup.mjs:71-94), and the same count
// for op-float-count (consolidate/j10.mjs:11). Cash-up decision 3: a box for
// every note and coin, adding up to a total that can be typed over.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const COUNTER = new URL('../../.test-build/components/ui/note-coin-counter.js', import.meta.url).href;
const LABELS = ['£50', '£20', '£10', '£5', '£2', '£1', '50p', '20p', '10p', '5p', '2p', '1p'];
// The drawing's example count (cashup.mjs EXAMPLE_COUNT): £208.70.
const DRAWN = { '£20': '6', '£10': '5', '£5': '4', '£2': '3', '£1': '8', '50p': '6', '20p': '5', '10p': '7' };

let current;
afterEach(async () => {
  if (!current) return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current.uninstall();
  current = undefined;
});

async function open() {
  const uninstall = installDom('http://localhost/workshop/till');
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  const { NoteCoinCounter } = await importFresh(COUNTER);
  const told = [];
  const ui = rtl.render(createElement(NoteCoinCounter, { onChange: (p) => told.push(p) }));
  current = { uninstall };
  const box = (label) => ui.getByLabelText(`Number of ${label}`);
  const total = () => ui.getByLabelText('Cash counted, total');
  const type = (el, value) => rtl.fireEvent.change(el, { target: { value } });
  const last = () => told[told.length - 1];
  const blur = (el) => rtl.fireEvent.blur(el);
  return { ui, box, total, type, told, last, blur };
}

test('twelve boxes, £50 down to 1p, in one group, and an empty Cash counted', async () => {
  const { ui, total } = await open();
  const group = ui.getByRole('group', { name: 'Count each note and coin' });
  const boxes = [...group.querySelectorAll('input')];
  assert.deepEqual(boxes.map((b) => b.getAttribute('aria-label')), LABELS.map((l) => `Number of ${l}`));
  for (const b of boxes) {
    assert.equal(b.value, '');
    assert.equal(b.getAttribute('inputmode'), 'numeric');
  }
  assert.equal(total().value, '');
  assert.ok(ui.getByText('Cash counted'));
  assert.ok(ui.getByText('Adds up from the boxes — or type the total'));
});

test('nothing typed: the page hears nothing is counted', async () => {
  const { told, last, box, type } = await open();
  assert.ok(told.length === 0 || last() === null);
  type(box('£20'), '2');
  type(box('£20'), '');
  assert.equal(last(), null);
});

test('the drawing’s count adds up to £208.70, with each box’s worth', async () => {
  const { ui, box, total, type, last } = await open();
  for (const [label, n] of Object.entries(DRAWN)) type(box(label), n);
  assert.equal(total().value, '£208.70');
  assert.equal(last(), 20870);
  assert.ok(ui.getByText('£120.00'));
  assert.ok(ui.queryByText('£0.00') === null);
});

test('coins add up exactly in pence', async () => {
  const { box, total, type, last } = await open();
  type(box('10p'), '1');
  type(box('20p'), '1');
  assert.equal(last(), 30);
  assert.equal(total().value, '£0.30');
});

test('a box keeps only digits', async () => {
  const { box, type, last } = await open();
  type(box('£5'), '3a');
  assert.equal(box('£5').value, '3');
  type(box('£5'), '-2');
  assert.equal(box('£5').value, '2');
  assert.equal(last(), 1000);
});

test('a typed total takes over from the boxes', async () => {
  const { box, total, type, last } = await open();
  for (const [label, n] of Object.entries(DRAWN)) type(box(label), n);
  type(total(), '£150.00');
  assert.equal(total().value, '£150.00');
  assert.equal(last(), 15000);
  assert.equal(box('£20').value, '6');
});

test('changing a box after typing the total adds up the boxes again', async () => {
  const { box, total, type, last } = await open();
  type(box('£20'), '6');
  type(total(), '150');
  assert.equal(last(), 15000);
  type(box('£10'), '1');
  assert.equal(last(), 13000);
  assert.equal(total().value, '£130.00');
});

test('clearing the typed total shows the boxes’ sum again once the box is left', async () => {
  const { box, total, type, last, blur } = await open();
  type(box('£20'), '6');
  type(total(), '150');
  type(total(), '');
  // Still typing: the box stays empty rather than snapping back.
  assert.equal(total().value, '');
  assert.equal(last(), null);
  blur(total());
  assert.equal(last(), 12000);
  assert.equal(total().value, '£120.00');
});

test('leaving a total that has a number keeps it', async () => {
  const { box, total, type, last, blur } = await open();
  type(box('£20'), '6');
  type(total(), '150');
  blur(total());
  assert.equal(total().value, '150');
  assert.equal(last(), 15000);
});

test('a total that isn’t pounds and pence is marked wrong and counts as nothing', async () => {
  const { box, total, type, last } = await open();
  type(box('£20'), '6');
  type(total(), '12.345');
  assert.equal(total().getAttribute('aria-invalid'), 'true');
  assert.equal(last(), null);
  type(total(), '12.34');
  assert.ok(total().getAttribute('aria-invalid') === null);
  assert.equal(last(), 1234);
});

// Review fixes, 26 Oct (coordinator's review of jack/note-coin-counter).
test('each box takes at most five digits', async () => {
  const { box } = await open();
  for (const l of LABELS) assert.equal(box(l).getAttribute('maxlength'), '5');
});

test('half-typed totals aren’t wrong: "12." is £12.00, a lone £ is empty', async () => {
  const { box, total, type, last } = await open();
  type(box('£20'), '6');
  type(total(), '12.');
  assert.ok(total().getAttribute('aria-invalid') === null);
  assert.equal(last(), 1200);
  type(total(), '£');
  assert.ok(total().getAttribute('aria-invalid') === null);
  type(total(), '£1,234.50');
  assert.equal(last(), 123450);
});

test('a wrong total says why, politely, and the box points at it and the hint', async () => {
  const { ui, total, type } = await open();
  const said = ui.getByText('Adds up from the boxes — or type the total');
  assert.ok(total().getAttribute('aria-describedby').split(' ').includes(said.id));
  assert.ok(ui.queryByText('Pounds and pence, like 208.70') === null);
  type(total(), '12.345');
  const why = ui.getByText('Pounds and pence, like 208.70');
  assert.ok(why.closest('[aria-live="polite"]') !== null);
  const ids = total().getAttribute('aria-describedby').split(' ');
  assert.ok(ids.includes(said.id) && ids.includes(why.id), ids.join(' '));
  type(total(), '12.34');
  assert.ok(ui.queryByText('Pounds and pence, like 208.70') === null);
});

test('a box set to 0 shows no worth', async () => {
  const { ui, box, type, last } = await open();
  type(box('£20'), '0');
  assert.ok(ui.queryByText('£0.00') === null);
  assert.equal(last(), 0);
});

test('a letter typed into a box keeps a typed total', async () => {
  const { box, total, type, last } = await open();
  type(box('£20'), '6');
  type(total(), '150');
  type(box('£20'), '6a');
  assert.equal(box('£20').value, '6');
  assert.equal(total().value, '150');
  assert.equal(last(), 15000);
});

test('keyboard focus looks like the rest of the app’s fields', async () => {
  const { box, total } = await open();
  for (const el of [box('£50'), total()]) assert.ok(el.className.includes('focus:outline-[var(--accent)]'), el.className);
});
