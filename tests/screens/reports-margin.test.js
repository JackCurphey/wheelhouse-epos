// Margin and stock value, the stock half of the screen (openspec/changes/
// reports-ready-made, group 4; drawn as rp-margin in generator/reports.mjs;
// design 6). The margin figures, graph and labour line come with PR 5.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openReports, closeReports, calls, HOME } from '../helpers/reports-screen.js';

afterEach(closeReports);

const row = (key, label, items, valuePence) => ({ key, label, items, valuePence });
// This week on Thursday 17 September, as server/lib/report-stock.js gives it.
const WEEK = {
  period: { period: 'this-week', from: '2026-09-14', to: '2026-09-20', through: '2026-09-17', soFar: true, label: 'So far: Mon 14 – Thu 17 September' },
  stock: { rows: [{ label: 'Bearings', items: 5, valuePence: 2000 }, { label: 'Drivetrain', items: 5, valuePence: 8100 }], all: { items: 10, valuePence: 10100 }, noCostProducts: 1 },
  writtenOff: {
    rows: [
      row('counted-under', 'Stock takes · counted under', 2, -1800),
      row('counted-over', 'Stock takes · counted over', 1, 400),
      row('damaged', 'Adjusted · Damaged', 2, -2000),
      row('lost_stolen', 'Adjusted · Lost or stolen', 0, 0),
      row('used_workshop', 'Adjusted · Used in the workshop', 1, -500),
      row('faulty_return', 'Adjusted · Faulty — to return to supplier', 0, 0),
      row('found', 'Adjusted · Found', 1, 1000),
      row('other', 'Adjusted · Other', 3, -500),
    ],
    all: { items: 10, valuePence: -3400 },
  },
  shopLine: 'North Street Cycles, Bolton', today: '2026-09-17',
};
const MONTH = { ...WEEK, period: { ...WEEK.period, period: 'this-month', from: '2026-09-01', to: '2026-09-30', label: 'So far: 1 – 17 September' } };

const served = (week = WEEK) => ({
  '/api/reports/margin': (query) => [200, query.get('period') === 'this-month' ? MONTH : week],
  '/api/reports/margin.csv': () => [200, 'Stock value by category\r\n', { 'content-disposition': 'attachment; filename="margin-north-street-2026-09-14-to-2026-09-17.csv"' }],
});
const cells = (ui, within, name) => within(ui.getByRole('table', { name })).getAllByRole('row').map((r) => [...r.querySelectorAll('th,td')].map((c) => c.textContent));

test('the Margin and stock value card on Reports opens the report', async () => {
  const { ui, within } = await openReports('/workshop/reports', { answers: { ...served(), '/api/reports/home': () => [200, HOME] } });
  const cards = within(await ui.findByRole('region', { name: 'Ready-made reports' }));
  assert.equal(cards.getByRole('link', { name: /^Margin and stock value/ }).getAttribute('href'), '/workshop/reports/margin');
});

test('On the shelves today: the stock value, the line about products with no cost, and the table by category', async () => {
  const { ui, within } = await openReports('/workshop/reports/margin', { answers: served() });
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'Margin and stock value' }) !== null);
  assert.ok(await ui.findByText('North Street Cycles, Bolton · So far: Mon 14 – Thu 17 September') !== null);
  assert.equal(calls.filter((c) => c.path === '/api/reports/margin')[0].query.get('period'), 'this-week');
  const periods = within(ui.getByRole('group', { name: 'Period' })).getAllByRole('radio');
  assert.deepEqual(periods.map((r) => r.checked), [false, true, false, false, false, false]);
  const shelves = within(ui.getByRole('region', { name: 'On the shelves today' }));
  assert.ok(shelves.queryByRole('heading', { level: 3, name: 'On the shelves today' }) !== null);
  assert.equal(shelves.getByText(/^Stock value, at what it cost you:/).textContent, 'Stock value, at what it cost you: £101.00');
  assert.ok(shelves.queryByText('1 product on the shelves has no cost, so it isn’t in this') !== null);
  assert.deepEqual(cells(ui, within, 'Stock value by category'), [
    ['Category', 'Items', 'What it cost you'], ['Bearings', '5', '£20.00'], ['Drivetrain', '5', '£81.00'], ['All', '10', '£101.00'],
  ]);
  assert.equal(ui.getByRole('link', { name: 'All reports' }).getAttribute('href'), '/workshop/reports');
});

test('no line about products with no cost when every product on the shelves has one', async () => {
  const { ui } = await openReports('/workshop/reports/margin', { answers: served({ ...WEEK, stock: { ...WEEK.stock, noCostProducts: 0 } }) });
  await ui.findByRole('table', { name: 'Stock value by category' });
  assert.ok(ui.queryByText(/has no cost|have no cost/) === null);
});

test('Stock written off: the eight rows signed, the All row, and each stock take row opening the counts', async () => {
  const { ui, within } = await openReports('/workshop/reports/margin', { answers: served() });
  const off = within(await ui.findByRole('region', { name: 'Stock written off' }));
  assert.ok(off.queryByText('Stock takes and adjustments this week, at what it cost you.') !== null);
  await ui.findByRole('table', { name: 'Stock written off' });
  assert.deepEqual(cells(ui, within, 'Stock written off').map((r) => r.slice(0, 3)), [
    ['Why', 'Items', 'At cost'],
    ['Stock takes · counted under', '2', '−£18.00'],
    ['Stock takes · counted over', '1', '+£4.00'],
    ['Adjusted · Damaged', '2', '−£20.00'],
    ['Adjusted · Lost or stolen', '0', '£0.00'],
    ['Adjusted · Used in the workshop', '1', '−£5.00'],
    ['Adjusted · Faulty — to return to supplier', '0', '£0.00'],
    ['Adjusted · Found', '1', '+£10.00'],
    ['Adjusted · Other', '3', '−£5.00'],
    ['All', '10', '−£34.00'],
  ]);
  assert.equal(off.getByRole('link', { name: 'See the stock takes counted under' }).getAttribute('href'), '/workshop/stocktake');
  assert.equal(off.getByRole('link', { name: 'See the stock takes counted over' }).getAttribute('href'), '/workshop/stocktake');
});

test('the written-off note names the period chosen', async () => {
  const { ui } = await openReports('/workshop/reports/margin?period=this-month', { answers: served() });
  assert.ok(await ui.findByText('Stock takes and adjustments this month, at what it cost you.') !== null);
});

test('"Download as spreadsheet" downloads this period\'s file under the server\'s name', async () => {
  const { ui, fireEvent, waitFor } = await openReports('/workshop/reports/margin', { answers: served() });
  await ui.findByRole('table', { name: 'Stock written off' });
  const saved = [];
  window.URL.createObjectURL = () => 'blob:test';
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function click() { saved.push(this.download); };
  fireEvent.click(ui.getByRole('button', { name: 'Download as spreadsheet' }));
  await waitFor(() => assert.deepEqual(saved, ['margin-north-street-2026-09-14-to-2026-09-17.csv']));
  assert.equal(calls.filter((c) => c.path === '/api/reports/margin.csv')[0].query.get('period'), 'this-week');
});

test('Staff are told the report is the owner\'s, in the server\'s words', async () => {
  const { ui } = await openReports('/workshop/reports/margin', {
    answers: { '/api/reports/margin': () => [403, { error: "Only the shop's owner can see reports" }] },
  });
  assert.ok(await ui.findByText("Only the shop's owner can see reports") !== null);
});
