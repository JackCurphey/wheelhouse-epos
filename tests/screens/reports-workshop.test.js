// The Workshop report, the screen (openspec/changes/reports-ready-made,
// group 1; drawn as rp-workshop in generator/reports.mjs; decision 6).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openReports, closeReports, calls, HOME } from '../helpers/reports-screen.js';

afterEach(closeReports);

const DAYS = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20'];
const LABELS = ['Mon 14 Sep', 'Tue 15 Sep', 'Wed 16 Sep', 'Thu 17 Sep', 'Fri 18 Sep', 'Sat 19 Sep', 'Sun 20 Sep'];
const FINISHED = [0, 2, 0, 1];
const BEFORE = [0, 0, 1, 0];

// This week on Thursday 17 September, as server/lib/report-workshop.js gives it.
const WEEK = {
  period: { period: 'this-week', from: '2026-09-14', to: '2026-09-20', through: '2026-09-17', soFar: true, unit: 'day', label: 'So far: Mon 14 – Thu 17 September', against: 'the same days last week' },
  before: { from: '2026-09-07', to: '2026-09-10' },
  columns: { now: 'This week so far', before: 'Same days last week' },
  figures: {
    bookedIn: { count: 4, beforeCount: 1, diff: 3 },
    finished: { count: 3, beforeCount: 1, diff: 2 },
    collected: { count: 1, beforeCount: 1, diff: 0 },
    bookedInToReady: { days: 2, beforeDays: 1, diff: 1 },
  },
  rows: DAYS.map((key, i) => ({ key, label: LABELS[i], notReached: i > 3, finished: i > 3 ? null : FINISHED[i], beforeFinished: BEFORE[i] ?? 0 })),
  takings: { labour: { pence: 6367, beforePence: 2500 }, parts: { pence: 5533, beforePence: 0 }, total: { pence: 11900, beforePence: 2500 } },
  quotes: { approved: { count: 2, beforeCount: 1 }, declined: { count: 1, beforeCount: 0 }, noAnswer: { count: 2, beforeCount: 0 } },
  mechanics: [
    { id: 7, name: 'Alex Morgan', bookedHours: 1, availableHours: 0, percent: null, noSetHours: true },
    { id: 8, name: 'Jo Taylor', bookedHours: 8, availableHours: 23, percent: 35, noSetHours: false },
  ],
  sharedQueue: { bookedHours: 3 },
  shopLine: 'North Street Cycles, Bolton', today: '2026-09-17',
};
const MONTHS = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
const LAST_12 = {
  ...WEEK,
  period: { period: 'last-12-months', from: '2025-10-01', to: '2026-09-30', through: '2026-09-17', soFar: true, unit: 'month', label: 'October 2025 – September 2026', against: 'the 12 months before' },
  columns: { now: 'Last 12 months', before: '12 months before' },
  rows: MONTHS.map((key, i) => ({ key, label: key, notReached: false, finished: i === 4 ? 9 : 3, beforeFinished: 2 })),
};

const served = (week = WEEK) => ({
  '/api/reports/workshop': (query) => [200, query.get('period') === 'last-12-months' ? LAST_12 : week],
  '/api/reports/workshop.csv': () => [200, 'Workshop takings\r\n', { 'content-disposition': 'attachment; filename="workshop-north-street-2026-09-14-to-2026-09-17.csv"' }],
});
const workshopCalls = () => calls.filter((c) => c.path === '/api/reports/workshop');

test('the Workshop card on Reports opens the report', async () => {
  const { ui, within } = await openReports('/workshop/reports', { answers: { ...served(), '/api/reports/home': () => [200, HOME] } });
  const cards = within(await ui.findByRole('region', { name: 'Ready-made reports' }));
  assert.equal(cards.getByRole('link', { name: /^Workshop/ }).getAttribute('href'), '/workshop/reports/workshop');
});

test('Workshop opens on This week with the four figures compared in words and the graph described', async () => {
  const { ui, within } = await openReports('/workshop/reports/workshop', { answers: served() });
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'Workshop' }) !== null);
  assert.ok(await ui.findByText('North Street Cycles, Bolton · So far: Mon 14 – Thu 17 September, against the same days last week') !== null);
  assert.equal(workshopCalls()[0].query.get('period'), 'this-week');
  const periods = within(ui.getByRole('group', { name: 'Period' })).getAllByRole('radio');
  assert.deepEqual(periods.map((r) => r.labels[0].textContent), ['Today', 'This week', 'This month', 'Last month', 'Last 12 months', 'Pick dates']);
  assert.deepEqual(periods.map((r) => r.checked), [false, true, false, false, false, false]);
  const figure = (name) => within(ui.getByRole('group', { name }));
  assert.ok(figure('Jobs booked in').queryByText('4') !== null);
  assert.ok(figure('Jobs booked in').queryByText('Up 3 on the same days last week') !== null);
  assert.ok(figure('Finished').queryByText('Up 2 on the same days last week') !== null);
  assert.ok(figure('Collected').queryByText('No change on the same days last week') !== null);
  assert.ok(figure('Booked in to ready').queryByText('2 days') !== null);
  assert.ok(figure('Booked in to ready').queryByText('Average · Up 1 day on the same days last week') !== null);
  // No table of jobs by day sits under this graph, so its description carries the figures itself.
  const graph = ui.getByRole('img', { name: 'Jobs finished by day: busiest day Tue 15 Sep; up 2 on the same days last week. Each day: Mon 14 Sep 0, Tue 15 Sep 2, Wed 16 Sep 0, Thu 17 Sep 1.' });
  assert.equal(within(graph).getAllByText('Not yet').length, 3);
  assert.ok(within(graph).queryByText('This week so far') !== null);
  assert.ok(within(graph).queryByText('Same days last week') !== null);
  assert.equal(ui.getByRole('link', { name: 'All reports' }).getAttribute('href'), '/workshop/reports');
});

test('the takings and quotes tables, and how full each mechanic was with the Shared queue and the note', async () => {
  const { ui, within } = await openReports('/workshop/reports/workshop', { answers: served() });
  const cells = (name) => within(ui.getByRole('table', { name })).getAllByRole('row').map((r) => [...r.querySelectorAll('th,td')].map((c) => c.textContent));
  await ui.findByRole('table', { name: 'Workshop takings' });
  assert.deepEqual(cells('Workshop takings'), [
    ['Money', 'This week so far', 'Same days last week'], ['Labour', '£63.67', '£25.00'], ['Parts', '£55.33', '£0.00'], ['Total', '£119.00', '£25.00'],
  ]);
  assert.deepEqual(cells('Quotes'), [
    ['Quote', 'This week so far', 'Same days last week'], ['Approved', '2', '1'], ['Declined', '1', '0'], ['No answer', '2', '0'],
  ]);
  const full = within(ui.getByRole('region', { name: 'How full each mechanic was' }));
  assert.ok(full.queryByRole('heading', { level: 3, name: 'How full each mechanic was' }) !== null);
  const rows = full.getAllByRole('listitem');
  assert.deepEqual(rows.map((r) => r.textContent), [
    'Alex Morgan1 hour booked · no set hours', 'Jo Taylor8 of 23 hours booked · 35% full', 'Shared queue3 hours booked · no set hours',
  ]);
  // A bar only for a mechanic with set hours, as full as they were.
  assert.ok(rows[0].querySelector('[data-bar]') === null);
  assert.equal(rows[1].querySelector('[data-bar] > div').style.width, '35%');
  assert.ok(rows[2].querySelector('[data-bar]') === null);
  assert.ok(full.queryByText('Hours booked in the diary against the hours each mechanic is in, from their working days.') !== null);
});

test('a mechanic booked past their hours shows the true figure with the bar full, not overflowing', async () => {
  const over = { ...WEEK, mechanics: [{ id: 8, name: 'Jo Taylor', bookedHours: 28, availableHours: 23, percent: 122, noSetHours: false }] };
  const { ui, within } = await openReports('/workshop/reports/workshop', { answers: served(over) });
  const full = within(await ui.findByRole('region', { name: 'How full each mechanic was' }));
  const row = full.getAllByRole('listitem')[0];
  assert.equal(row.textContent, 'Jo Taylor28 of 23 hours booked · 122% full');
  assert.equal(row.querySelector('[data-bar] > div').style.width, '100%');
});

test('Last 12 months is a line by month, and the tables name its columns', async () => {
  const { ui, within } = await openReports('/workshop/reports/workshop?period=last-12-months', { answers: served() });
  const graph = await ui.findByRole('img', { name: /^Jobs finished by month: busiest month 2026-02; up 2 on the 12 months before\. Each month: / });
  assert.equal(graph.querySelectorAll('polyline').length, 2);
  const head = within(ui.getByRole('table', { name: 'Quotes' })).getAllByRole('columnheader').map((h) => h.textContent);
  assert.deepEqual(head, ['Quote', 'Last 12 months', '12 months before']);
});

test('with Show graphs off the graph goes and the figures and tables stay', async () => {
  const { ui } = await openReports('/workshop/reports/workshop', { answers: served(), accessibility: { showGraphs: false } });
  await ui.findByRole('table', { name: 'Workshop takings' });
  assert.ok(ui.queryByRole('img', { name: /^Jobs finished by day/ }) === null);
  assert.ok(ui.queryByRole('group', { name: 'Finished' }) !== null);
});

test('"Download as spreadsheet" downloads this period\'s file under the server\'s name', async () => {
  const { ui, fireEvent, waitFor } = await openReports('/workshop/reports/workshop', { answers: served() });
  await ui.findByRole('table', { name: 'Workshop takings' });
  const saved = [];
  window.URL.createObjectURL = () => 'blob:test';
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function click() { saved.push(this.download); };
  fireEvent.click(ui.getByRole('button', { name: 'Download as spreadsheet' }));
  await waitFor(() => assert.deepEqual(saved, ['workshop-north-street-2026-09-14-to-2026-09-17.csv']));
  assert.equal(calls.filter((c) => c.path === '/api/reports/workshop.csv')[0].query.get('period'), 'this-week');
});

test('Staff are told the report is the owner\'s, in the server\'s words', async () => {
  const { ui } = await openReports('/workshop/reports/workshop', {
    answers: { '/api/reports/workshop': () => [403, { error: "Only the shop's owner can see reports" }] },
  });
  assert.ok(await ui.findByText("Only the shop's owner can see reports") !== null);
});
