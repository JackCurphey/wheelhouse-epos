// Returning customers, the screen (openspec/changes/reports-ready-made,
// group 2; drawn as rp-returning in generator/reports.mjs; Jack's answer 4:
// no Message button).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openReports, closeReports, calls, HOME } from '../helpers/reports-screen.js';

afterEach(closeReports);

const MONTHS = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
const LABELS = ['Oct 25', 'Nov 25', 'Dec 25', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
const RETURNING = [0, 1, 0, 0, 3, 0, 0, 1, 0, 0, 0, 0];
const NEW = [0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0];

// The last 12 months on 17 September, as server/lib/report-customers.js gives it.
const YEAR = {
  period: { period: 'last-12-months', from: '2025-10-01', to: '2026-09-30', through: '2026-09-17', soFar: true, unit: 'month', label: 'the last 12 months', against: 'the 12 months before' },
  before: { from: '2024-10-01', to: '2025-09-30' },
  figures: {
    customers: { count: 5, beforeCount: 3, diff: 2 },
    new: { count: 2, beforeCount: 2, diff: 0 },
    cameBack: { percent: 67, beforePercent: 100, diff: -33 },
  },
  rows: MONTHS.map((key, i) => ({ key, label: LABELS[i], notReached: false, returning: RETURNING[i], new: NEW[i], all: RETURNING[i] + NEW[i] })),
  total: { label: 'All 12 months', returning: 3, new: 2, all: 5 },
  notSeen: {
    months: 6,
    column: 'Spent in the last 12 months',
    customers: [
      { id: 11, name: 'Ann Lee', lastVisit: '2026-02-20', spentPence: 3000, happyToHear: true },
      { id: 12, name: 'Dan Roe', lastVisit: '2025-01-20', spentPence: 0, happyToHear: false },
    ],
  },
  shopLine: 'North Street Cycles, Bolton', today: '2026-09-17',
};

const served = (report = YEAR) => ({
  '/api/reports/returning': () => [200, report],
  '/api/reports/returning.csv': () => [200, 'New and returning customers by month\r\n', { 'content-disposition': 'attachment; filename="returning-north-street-2025-10-01-to-2026-09-17.csv"' }],
});
const returningCalls = () => calls.filter((c) => c.path === '/api/reports/returning');

test('the Returning customers card on Reports opens the report', async () => {
  const { ui, within } = await openReports('/workshop/reports', { answers: { ...served(), '/api/reports/home': () => [200, HOME] } });
  const cards = within(await ui.findByRole('region', { name: 'Ready-made reports' }));
  const card = cards.getByRole('link', { name: /^Returning customers/ });
  assert.equal(card.getAttribute('href'), '/workshop/reports/returning');
  assert.ok(within(card).queryByText('Who comes back, and who hasn’t been in for a while') !== null);
});

test('Returning customers opens on the last 12 months with the three figures compared in words', async () => {
  const { ui, within } = await openReports('/workshop/reports/returning', { answers: served() });
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'Returning customers' }) !== null);
  assert.ok(await ui.findByText('North Street Cycles, Bolton · the last 12 months') !== null);
  assert.equal(returningCalls()[0].query.get('period'), 'last-12-months');
  const periods = within(ui.getByRole('group', { name: 'Period' })).getAllByRole('radio');
  assert.deepEqual(periods.map((r) => r.labels[0].textContent), ['Last 12 months', 'Last 24 months', 'Pick dates']);
  assert.deepEqual(periods.map((r) => r.checked), [true, false, false]);
  const figure = (name) => within(ui.getByRole('group', { name }));
  assert.ok(figure('Customers').queryByText('5') !== null);
  assert.ok(figure('Customers').queryByText('Up 2 on the 12 months before') !== null);
  assert.ok(figure('New').queryByText('No change on the 12 months before') !== null);
  assert.ok(figure('Came back within 12 months').queryByText('67%') !== null);
  assert.ok(figure('Came back within 12 months').queryByText('Down 33 points on the 12 months before') !== null);
  assert.equal(ui.getByRole('link', { name: 'All reports' }).getAttribute('href'), '/workshop/reports');
});

test('Last 24 months asks for it and keeps the months box', async () => {
  const { ui, fireEvent, waitFor } = await openReports('/workshop/reports/returning?months=9', { answers: served() });
  await ui.findByRole('table', { name: 'Not seen lately' });
  fireEvent.click(ui.getByRole('radio', { name: 'Last 24 months' }));
  await waitFor(() => assert.equal(returningCalls().at(-1).query.get('period'), 'last-24-months'));
  assert.equal(returningCalls().at(-1).query.get('months'), '9');
});

test('Pick dates asks for those dates and keeps the months box', async () => {
  const { ui, within, fireEvent } = await openReports('/workshop/reports/returning?months=9', { answers: served() });
  await ui.findByRole('table', { name: 'Not seen lately' });
  fireEvent.click(ui.getByRole('radio', { name: 'Pick dates' }));
  const box = within(await ui.findByRole('dialog', { name: 'Pick dates' }));
  fireEvent.change(box.getByLabelText('From'), { target: { value: '2026-03-01' } });
  fireEvent.change(box.getByLabelText('To'), { target: { value: '2026-08-31' } });
  fireEvent.click(box.getByRole('button', { name: 'Show report' }));
  await ui.findByRole('radio', { name: 'Pick dates', checked: true });
  const last = returningCalls().at(-1).query;
  assert.deepEqual([last.get('period'), last.get('from'), last.get('to'), last.get('months')], ['dates', '2026-03-01', '2026-08-31', '9']);
});

test('the stacked graph, Returning solid below New striped, described in words; the note and the table by month', async () => {
  const { ui, within } = await openReports('/workshop/reports/returning', { answers: served() });
  const graph = await ui.findByRole('img', { name: 'New and returning customers by month: most returning in Feb, most new in Mar. The figures are in the table below.' });
  assert.ok(within(graph).queryByText('Returning') !== null);
  assert.ok(within(graph).queryByText('New') !== null);
  // February: a solid Returning part and no New part; March: a striped New part only.
  const feb = graph.querySelector('[data-month="2026-02"]');
  const mar = graph.querySelector('[data-month="2026-03"]');
  assert.ok(feb.querySelector('[data-part="lower"]') !== null);
  assert.ok(feb.querySelector('[data-part="upper"]') === null);
  assert.ok(mar.querySelector('[data-part="lower"]') === null);
  const upper = mar.querySelector('[data-part="upper"]');
  const pattern = upper.getAttribute('fill').match(/^url\(#(.+)\)$/)[1];
  assert.ok(graph.querySelector(`pattern[id="${pattern}"]`) !== null, 'the stripes are there');
  assert.ok(ui.queryByText('A customer counts when they buy something or a repair is collected — in the shop or online. Sales with no customer on them are not counted.') !== null);
  const rows = within(ui.getByRole('table', { name: 'New and returning customers by month' })).getAllByRole('row')
    .map((r) => [...r.querySelectorAll('th,td')].map((c) => c.textContent));
  assert.deepEqual(rows[0], ['Month', 'Returning', 'New', 'All']);
  assert.deepEqual(rows[5], ['Feb', '3', '0', '3']);
  assert.deepEqual(rows.at(-1), ['All 12 months', '3', '2', '5']);
  assert.equal(rows.length, 14);
});

test('Not seen lately: the months box, the note, names that open the customer, and no Message button', async () => {
  const { ui, within, fireEvent, waitFor } = await openReports('/workshop/reports/returning', { answers: served() });
  const table = await ui.findByRole('table', { name: 'Not seen lately' });
  assert.ok(ui.queryByRole('heading', { level: 3, name: 'Not seen lately' }) !== null);
  const box = ui.getByRole('textbox', { name: /^Not seen for/ });
  assert.equal(box.value, '6');
  assert.equal(box.getAttribute('inputmode'), 'numeric');
  assert.ok(ui.queryByText('Customers who used to come in. “Happy to hear about offers” is what they said yes or no to.') !== null);
  const rows = within(table).getAllByRole('row').map((r) => [...r.querySelectorAll('th,td')].map((c) => c.textContent));
  assert.deepEqual(rows, [
    ['Customer', 'Last bought or collected', 'Spent in the last 12 months', 'Happy to hear about offers'],
    ['Ann Lee', '20 February 2026', '£30.00', 'Yes'],
    ['Dan Roe', '20 January 2025', '£0.00', 'No'],
  ]);
  assert.equal(within(table).getByRole('link', { name: 'Ann Lee' }).getAttribute('href'), '/workshop/customers/11');
  assert.ok(ui.queryByRole('button', { name: /^Message/ }) === null);
  fireEvent.change(box, { target: { value: '12' } });
  await waitFor(() => assert.equal(returningCalls().at(-1).query.get('months'), '12'));
  assert.equal(returningCalls().at(-1).query.get('period'), 'last-12-months');
});

test('the months box changes the address in place, follows the address when it changes, and puts back the months when left with something else', async () => {
  const { ui, fireEvent, waitFor, act } = await openReports('/workshop/reports/returning', { answers: served() });
  await ui.findByRole('table', { name: 'Not seen lately' });
  const box = () => ui.getByRole('textbox', { name: /^Not seen for/ });
  const entries = window.history.length;
  fireEvent.change(box(), { target: { value: '12' } });
  await waitFor(() => assert.match(window.location.search, /months=12/));
  assert.equal(window.history.length, entries, 'no new history entry for each number typed');
  // Back, or a link, changes the address: the box follows.
  act(() => { window.history.pushState({}, '', '/workshop/reports/returning?months=3'); window.dispatchEvent(new window.PopStateEvent('popstate')); });
  await waitFor(() => assert.equal(box().value, '3'));
  // Something that isn't 1 to 1200 is put back when the box is left.
  fireEvent.change(box(), { target: { value: 'abc' } });
  fireEvent.blur(box());
  assert.equal(box().value, '3');
  assert.equal(returningCalls().at(-1).query.get('months'), '3');
});

test('with Show graphs off the graph goes and the figures and tables stay', async () => {
  const { ui } = await openReports('/workshop/reports/returning', { answers: served(), accessibility: { showGraphs: false } });
  await ui.findByRole('table', { name: 'New and returning customers by month' });
  assert.ok(ui.queryByRole('img', { name: /^New and returning customers by month/ }) === null);
  assert.ok(ui.queryByRole('group', { name: 'Customers' }) !== null);
});

test('"Download as spreadsheet" downloads this period\'s file under the server\'s name', async () => {
  const { ui, fireEvent, waitFor } = await openReports('/workshop/reports/returning?months=9', { answers: served() });
  await ui.findByRole('table', { name: 'Not seen lately' });
  const saved = [];
  window.URL.createObjectURL = () => 'blob:test';
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function click() { saved.push(this.download); };
  fireEvent.click(ui.getByRole('button', { name: 'Download as spreadsheet' }));
  await waitFor(() => assert.deepEqual(saved, ['returning-north-street-2025-10-01-to-2026-09-17.csv']));
  const asked = calls.filter((c) => c.path === '/api/reports/returning.csv')[0].query;
  assert.deepEqual([asked.get('period'), asked.get('months')], ['last-12-months', '9']);
});

test('Staff are told the report is the owner\'s, in the server\'s words', async () => {
  const { ui } = await openReports('/workshop/reports/returning', {
    answers: { '/api/reports/returning': () => [403, { error: "Only the shop's owner can see reports" }] },
  });
  assert.ok(await ui.findByText("Only the shop's owner can see reports") !== null);
});
