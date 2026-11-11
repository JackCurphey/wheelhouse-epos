// The Sales report (openspec/changes/reports-sales-and-takings, group 2;
// drawn as rp-sales, rp-sales-year, rp-sales-empty and rp-pick-dates in
// generator/reports.mjs; Jack's answers 3, 7 and 8 of 10 Nov).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openReports, closeReports, salesFor, THIS_WEEK, LAST_12, calls } from '../helpers/reports-screen.js';

afterEach(closeReports);
const served = (fixtures) => ({ '/api/reports/sales': (query) => [200, salesFor(query, fixtures)] });
const salesCalls = () => calls.filter((c) => c.path === '/api/reports/sales');

test('Sales opens on This week with its heading, the three figures compared in words, the graph and the table', async () => {
  const { ui, within, fireEvent } = await openReports('/workshop/reports/sales', { answers: served() });
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'Sales' }) !== null);
  assert.ok(await ui.findByText('North Street Cycles, Bolton · So far: Mon 14 – Thu 17 September, against the same days last week') !== null);
  assert.equal(salesCalls()[0].query.get('period'), 'this-week');
  const periods = within(ui.getByRole('group', { name: 'Period' })).getAllByRole('radio');
  assert.deepEqual(periods.map((r) => r.labels[0].textContent), ['Today', 'This week', 'This month', 'Last month', 'Last 12 months', 'Pick dates']);
  assert.deepEqual(periods.map((r) => r.checked), [false, true, false, false, false, false]);
  // Takings, Number of sales and Average sale: no Refunds until step C (answer 3).
  const figure = (name) => within(ui.getByRole('group', { name }));
  assert.ok(figure('Takings').queryByText('£88.00') !== null);
  assert.ok(figure('Takings').queryByText('Down £92.00 on the same days last week') !== null);
  assert.ok(figure('Number of sales').queryByText('6') !== null);
  assert.ok(figure('Number of sales').queryByText('Up 2 on the same days last week') !== null);
  assert.ok(figure('Average sale').queryByText('£14.67') !== null);
  assert.ok(figure('Average sale').queryByText('Down £30.33 on the same days last week') !== null);
  assert.ok(ui.queryByText('Refunds') === null);
  // The graph's spoken description names the busiest day and the change.
  const graph = ui.getByRole('img', { name: /^Takings by day: busiest day Tue 15 Sep; down £92\.00 on the same days last week\. The figures are in the table below\.$/ });
  assert.equal(within(graph).getAllByText('Not yet').length, 3);
  // The table: a row per day, "—" for days to come, a "So far" row equal to Takings.
  const table = within(ui.getByRole('table', { name: 'Sales by day' }));
  assert.deepEqual(table.getAllByRole('columnheader').map((h) => h.textContent), ['Day', 'Takings', 'Sales', 'Average']);
  const rows = table.getAllByRole('row').map((r) => [...r.querySelectorAll('th,td')].map((c) => c.textContent));
  assert.deepEqual(rows[2], ['Tue 15 Sep', '£45.00', '4', '£11.25']);
  assert.deepEqual(rows[5], ['Fri 18 Sep', '—', '—', '—']);
  assert.deepEqual(rows[8], ['So far', '£88.00', '6', '£14.67']);
  assert.ok(ui.queryByText('Takings include VAT, take refunds off, and count online and Cycle to Work money; today counts so far.') !== null);
  // "All reports" goes back to the page.
  assert.equal(ui.getByRole('link', { name: 'All reports' }).getAttribute('href'), '/workshop/reports');
  assert.ok(fireEvent);
});

test('each period choice asks the server for it', async () => {
  const { ui, fireEvent } = await openReports('/workshop/reports/sales', { answers: served() });
  await ui.findByRole('table', { name: 'Sales by day' });
  for (const [name, period] of [['Today', 'today'], ['This month', 'this-month'], ['Last month', 'last-month'], ['Last 12 months', 'last-12-months']]) {
    fireEvent.click(ui.getByRole('radio', { name }));
    await ui.findByRole('radio', { name, checked: true });
    assert.equal(salesCalls().at(-1).query.get('period'), period, name);
  }
});

test('Last 12 months is a line by month with the 12 months before, and its table has a "12 months" row', async () => {
  const { ui, within } = await openReports('/workshop/reports/sales?period=last-12-months', { answers: served() });
  assert.ok(await ui.findByText('North Street Cycles, Bolton · October 2025 – September 2026, against the 12 months before') !== null);
  const graph = ui.getByRole('img', { name: /^Takings by month: busiest month .*; up £200\.00 on the 12 months before\. The figures are in the table below\.$/ });
  assert.ok(graph.querySelector('polyline') !== null, 'a line, not bars');
  assert.equal(graph.querySelectorAll('polyline').length, 2, 'this period and the 12 months before it');
  const rows = within(ui.getByRole('table', { name: 'Takings by month' })).getAllByRole('row');
  assert.equal(rows.length, 14);
  assert.deepEqual([...rows[13].querySelectorAll('th,td')].map((c) => c.textContent), ['12 months', '£1200.00', '48', '£25.00']);
});

test('Pick dates opens its box, shows the range, and refuses To before From beside the field', async () => {
  const { ui, within, fireEvent } = await openReports('/workshop/reports/sales', { answers: served() });
  await ui.findByRole('table', { name: 'Sales by day' });
  fireEvent.click(ui.getByRole('radio', { name: 'Pick dates' }));
  const box = within(await ui.findByRole('dialog', { name: 'Pick dates' }));
  assert.ok(box.queryByText('Compared with the same number of days just before.') !== null);
  const before = salesCalls().length;
  fireEvent.change(box.getByLabelText('From'), { target: { value: '2026-09-10' } });
  fireEvent.change(box.getByLabelText('To'), { target: { value: '2026-09-07' } });
  fireEvent.click(box.getByRole('button', { name: 'Show report' }));
  assert.ok(box.queryByText('To is before From: pick a To on or after From') !== null);
  assert.equal(box.getByLabelText('To').getAttribute('aria-invalid'), 'true');
  assert.equal(salesCalls().length, before, 'the report did not change');
  // A day after today is refused too.
  fireEvent.change(box.getByLabelText('To'), { target: { value: '2026-09-18' } });
  fireEvent.click(box.getByRole('button', { name: 'Show report' }));
  assert.ok(box.queryByText("To can't be after today") !== null);
  // A good range shows the report.
  fireEvent.change(box.getByLabelText('To'), { target: { value: '2026-09-17' } });
  fireEvent.click(box.getByRole('button', { name: 'Show report' }));
  await ui.findByRole('radio', { name: 'Pick dates', checked: true });
  const last = salesCalls().at(-1).query;
  assert.deepEqual([last.get('period'), last.get('from'), last.get('to')], ['dates', '2026-09-10', '2026-09-17']);
  assert.ok(ui.queryByRole('dialog', { name: 'Pick dates' }) === null);
});

test('Cancel closes Pick dates and keeps the report that was shown', async () => {
  const { ui, within, fireEvent } = await openReports('/workshop/reports/sales', { answers: served() });
  await ui.findByRole('table', { name: 'Sales by day' });
  fireEvent.click(ui.getByRole('radio', { name: 'Pick dates' }));
  const box = within(await ui.findByRole('dialog', { name: 'Pick dates' }));
  fireEvent.click(box.getByRole('button', { name: 'Cancel' }));
  assert.ok(ui.queryByRole('dialog', { name: 'Pick dates' }) === null);
  assert.equal(ui.getByRole('radio', { name: 'This week' }).checked, true);
});

test('nothing sold: says so, and says there is nothing to compare with when nothing is before the period', async () => {
  const empty = () => ({
    ...THIS_WEEK,
    period: { ...THIS_WEEK.period, period: 'today', label: 'Thursday 17 September, so far', against: 'last Thursday', unit: 'hour' },
    rows: [], empty: true, nothingBefore: true, firstSaleOn: null, startedOn: '2026-08-30',
    figures: { takings: { pence: 0, beforePence: 0, diffPence: null }, sales: { count: 0, beforeCount: 0, diff: null }, average: { pence: null, beforePence: null, diffPence: null } },
    total: { label: 'So far', takingsPence: 0, sales: 0, averagePence: null },
  });
  const { ui } = await openReports('/workshop/reports/sales?period=today', { answers: served({ today: empty }) });
  assert.ok(await ui.findByText('Nothing sold yet today') !== null);
  assert.ok(ui.queryByText('Sales show here as soon as the first one goes through a till.') !== null);
  assert.ok(ui.queryByText('Nothing to compare with yet') !== null);
  assert.ok(ui.queryByText('The shop started on Wheelhouse on 30 August 2026, so there’s no period before this one. Comparisons start once there is.') !== null);
  // No £0.00 comparisons, no table.
  assert.ok(ui.queryByText(/on last Thursday/) === null);
  assert.ok(ui.queryByRole('table') === null);
});

test('a first sale with nothing before the period names the day the shop started', async () => {
  const first = () => ({ ...THIS_WEEK, nothingBefore: true, firstSaleOn: '2026-09-15', figures: { ...THIS_WEEK.figures, takings: { pence: 8800, beforePence: 0, diffPence: null }, sales: { count: 6, beforeCount: 0, diff: null }, average: { pence: 1467, beforePence: null, diffPence: null } } });
  const { ui } = await openReports('/workshop/reports/sales', { answers: served({ 'this-week': first }) });
  assert.ok(await ui.findByText('Nothing to compare with yet') !== null);
  assert.ok(ui.queryByText('The shop started on Wheelhouse on 15 September 2026, so there’s no period before this one. Comparisons start once there is.') !== null);
  assert.ok(ui.queryAllByText('£88.00').length > 0, 'its figures still show');
  assert.ok(ui.queryByText(/on the same days last week/) === null);
});

test('a server refusal is shown in its own words', async () => {
  const { ui } = await openReports('/workshop/reports/sales', { answers: { '/api/reports/sales': () => [403, { error: "Only the shop's owner can see reports", code: 'owner_only' }] } });
  assert.ok(await ui.findByText("Only the shop's owner can see reports") !== null);
  assert.ok(ui.queryByRole('table') === null);
  assert.ok(LAST_12);
});

test('the chosen period is dark with a tick, the others plain (audit M3)', async () => {
  const { ui } = await openReports('/workshop/reports/sales', { answers: served() });
  await ui.findByRole('table', { name: 'Sales by day' });
  const chip = (name) => ui.getByRole('radio', { name }).labels[0];
  assert.ok(chip('This week').querySelector('svg') !== null, 'a tick on the chosen one');
  assert.ok(chip('This week').className.includes('bg-[var(--wh-ink)]'), 'dark');
  assert.ok(chip('Today').querySelector('svg') === null);
  assert.ok(!chip('Today').className.includes('bg-[var(--wh-ink)]'));
});
