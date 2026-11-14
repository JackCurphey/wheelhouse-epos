// Cycle to Work: owed and paid, the screen (openspec/changes/cycle-to-work,
// task 10.3; drawn as rp-c2w in generator/reports.mjs; UX walk-through 5 H3).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openReports, closeReports, calls, HOME } from '../helpers/reports-screen.js';

afterEach(closeReports);

// This month on Saturday 17 October, as server/lib/report-c2w.js gives it. Provider names stay bracketed.
const MONTH = {
  period: { period: 'this-month', from: '2026-10-01', to: '2026-10-31', through: '2026-10-17', soFar: true, unit: 'day', label: 'So far: 1 – 17 October', against: 'the same days last month' },
  before: { from: '2026-09-01', to: '2026-09-17' },
  columns: { now: 'This month so far', before: 'Same days last month' },
  figures: {
    owedNow: { pence: 100000, bikes: 2, late: 1 },
    paid: { pence: 125000, beforePence: 47500, diffPence: 77500 },
    commission: { pence: 5000, beforePence: 2500, diffPence: 2500 },
    shortfalls: { pence: 5000, orders: 1 },
  },
  providers: [
    { id: 1, name: '[Provider A]', bikesCollected: 1, owedPence: 40000, paidPence: 95000, beforePaidPence: 47500, commissionPence: 5000, late: 0 },
    { id: 2, name: '[Provider B]', bikesCollected: 2, owedPence: 60000, paidPence: 30000, beforePaidPence: 0, commissionPence: 0, late: 1 },
  ],
  total: { label: 'All providers', bikesCollected: 3, owedPence: 100000, paidPence: 125000, beforePaidPence: 47500, commissionPence: 5000, late: 1 },
  shopLine: 'North Street Cycles, Bolton', today: '2026-10-17',
};
const NONE = {
  ...MONTH,
  providers: [],
  total: { label: 'All providers', bikesCollected: 0, owedPence: 0, paidPence: 0, beforePaidPence: 0, commissionPence: 0, late: 0 },
  figures: { owedNow: { pence: 0, bikes: 0, late: 0 }, paid: { pence: 0, beforePence: 0, diffPence: 0 }, commission: { pence: 0, beforePence: 0, diffPence: 0 }, shortfalls: { pence: 0, orders: 0 } },
};

const served = (month = MONTH) => ({
  '/api/reports/c2w': () => [200, month],
  '/api/reports/c2w.csv': () => [200, 'Cycle to Work by provider\r\n', { 'content-disposition': 'attachment; filename="c2w-north-street-2026-10-01-to-2026-10-17.csv"' }],
});

test('the Cycle to Work card is last on Reports and opens the report', async () => {
  const { ui, within } = await openReports('/workshop/reports', { answers: { ...served(), '/api/reports/home': () => [200, HOME] } });
  const cards = within(await ui.findByRole('region', { name: 'Ready-made reports' }));
  const links = cards.getAllByRole('link');
  const last = links[links.length - 1];
  assert.match(last.textContent, /^Cycle to Work: owed and paid/);
  assert.match(last.textContent, /What each provider owes, has paid, and kept as commission/);
  assert.equal(last.getAttribute('href'), '/workshop/reports/c2w');
});

test('opens on This month with the four figures in words and the graph by provider described', async () => {
  const { ui, within } = await openReports('/workshop/reports/c2w', { answers: served() });
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'Cycle to Work: owed and paid' }) !== null);
  assert.ok(await ui.findByText('North Street Cycles, Bolton · So far: 1 – 17 October, against the same days last month') !== null);
  assert.equal(calls.filter((c) => c.path === '/api/reports/c2w')[0].query.get('period'), 'this-month');
  const periods = within(ui.getByRole('group', { name: 'Period' })).getAllByRole('radio');
  assert.deepEqual(periods.map((r) => r.checked), [false, false, true, false, false, false]);
  const figure = (name) => within(ui.getByRole('group', { name }));
  assert.ok(figure('Owed now').queryByText('£1,000.00') !== null);
  assert.ok(figure('Owed now').queryByText('2 bikes · 1 late') !== null);
  assert.ok(figure('Paid').queryByText('£1,250.00') !== null);
  assert.ok(figure('Paid').queryByText('Up £775.00 on the same days last month') !== null);
  assert.ok(figure('Commission').queryByText('Up £25.00 on the same days last month') !== null);
  assert.ok(figure('Shortfalls closed').queryByText('£50.00') !== null);
  assert.ok(figure('Shortfalls closed').queryByText('1 order closed with a reason') !== null);
  const graph = ui.getByRole('img', { name: 'Paid by provider: most paid by [Provider A]; up £775.00 on the same days last month.' });
  assert.ok(within(graph).queryByText('Paid this month so far') !== null);
  assert.ok(within(graph).queryByText('Same days last month') !== null);
});

test('the table by provider with its All providers row, the link to the Owed page and the note', async () => {
  const { ui, within } = await openReports('/workshop/reports/c2w', { answers: served() });
  const table = await ui.findByRole('table', { name: 'Cycle to Work by provider' });
  const cells = within(table).getAllByRole('row').map((r) => [...r.querySelectorAll('th,td')].map((c) => c.textContent));
  assert.deepEqual(cells, [
    ['Provider', 'Bikes collected', 'Owed now', 'Paid', 'Commission', 'Late'],
    ['[Provider A]', '1', '£400.00', '£950.00', '£50.00', '0'],
    ['[Provider B]', '2', '£600.00', '£300.00', '£0.00', '1'],
    ['All providers', '3', '£1,000.00', '£1,250.00', '£50.00', '1'],
  ]);
  assert.ok(ui.queryByText('Each bike, and what’s owed on it right now, is on Cycle to Work’s Owed page.') !== null);
  assert.equal(ui.getByRole('link', { name: 'See what Cycle to Work providers owe now' }).getAttribute('href'), '/workshop/c2w/owed');
  assert.ok(ui.queryByText('Paid and commission are counted on the day the payment was received. They go to Xero with that day’s summary.') !== null);
});

test('with no providers set up it says so in one line, with no graph or table', async () => {
  const { ui } = await openReports('/workshop/reports/c2w', { answers: served(NONE) });
  // cw-first-use's words (generator/c2w.mjs).
  assert.ok(await ui.findByText('No scheme providers yet.') !== null);
  assert.ok(ui.queryByRole('table', { name: 'Cycle to Work by provider' }) === null);
  assert.ok(ui.queryByRole('img', { name: /^Paid by provider/ }) === null);
});

test('"Download as spreadsheet" downloads this period\'s file under the server\'s name', async () => {
  const { ui, fireEvent, waitFor } = await openReports('/workshop/reports/c2w?period=last-month', { answers: served() });
  await ui.findByRole('table', { name: 'Cycle to Work by provider' });
  const saved = [];
  window.URL.createObjectURL = () => 'blob:test';
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function click() { saved.push(this.download); };
  fireEvent.click(ui.getByRole('button', { name: 'Download as spreadsheet' }));
  await waitFor(() => assert.deepEqual(saved, ['c2w-north-street-2026-10-01-to-2026-10-17.csv']));
  assert.equal(calls.filter((c) => c.path === '/api/reports/c2w.csv')[0].query.get('period'), 'last-month');
});

test('Staff who can’t see costs are told so in the server\'s words', async () => {
  const { ui } = await openReports('/workshop/reports/c2w', {
    answers: { '/api/reports/c2w': () => [403, { error: "Only the shop's owner can see reports" }] },
  });
  assert.ok(await ui.findByText("Only the shop's owner can see reports") !== null);
});
