// Takings and cash-ups and a closed day's report, the screens
// (openspec/changes/reports-sales-and-takings, group 3; rp-takings and rp-day in
// generator/reports.mjs; Jack's answers 4, 5 and 9 of 10 Nov).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openReports, closeReports, TAKINGS_WEEK, TUESDAY_CLOSE, calls } from '../helpers/reports-screen.js';

afterEach(closeReports);
const served = (extra = {}) => ({
  '/api/reports/takings': () => [200, TAKINGS_WEEK],
  '/api/reports/days/30': () => [200, TUESDAY_CLOSE],
  ...extra,
});
const rowsOf = (table) => table.getAllByRole('row').map((r) => [...r.querySelectorAll('th,td')].map((c) => c.textContent));

test('Takings and cash-ups opens on This week with its seven figures, compared in words', async () => {
  const { ui, within } = await openReports('/workshop/reports/takings', { answers: served() });
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'Takings and cash-ups' }) !== null);
  assert.ok(await ui.findByText('North Street Cycles, Bolton · So far: Mon 14 – Thu 17 September, against the same days last week') !== null);
  assert.equal(calls.find((c) => c.path === '/api/reports/takings').query.get('period'), 'this-week');
  const figure = (name) => within(ui.getByRole('group', { name }));
  assert.ok(figure('Closed days’ takings').queryByText('£600.00') !== null);
  assert.ok(figure('Closed days’ takings').queryByText('Up £200.00 on the same days last week') !== null);
  assert.ok(figure('Card').queryByText('£330.00') !== null);
  assert.ok(figure('Cash').queryByText('Up £95.00 on the same days last week') !== null);
  assert.ok(figure('Other').queryByText('£25.00') !== null);
  assert.ok(figure('Other').queryByText('Gift cards, store credit and customer accounts') !== null);
  // Cycle to Work money, owed by the providers, between Other and Online (UX walk-through 5 H3).
  assert.ok(figure('Cycle to Work').queryByText('£15.00') !== null);
  assert.ok(figure('Cycle to Work').queryByText('Owed by providers, not in the drawer') !== null);
  const names = ui.getAllByRole('group').map((g) => g.getAttribute('aria-label') ?? '');
  assert.ok(names.indexOf('Other') + 1 === names.indexOf('Cycle to Work') && names.indexOf('Cycle to Work') + 1 === names.indexOf('Online'), names.join(' | '));
  assert.ok(figure('Online').queryByText('£55.00') !== null);
  assert.ok(figure('Online').queryByText('Paid on the website · separate from the tills') !== null);
  assert.ok(figure('Cash differences').queryByText('−£5.00') !== null);
  assert.ok(figure('Cash differences').queryByText('Down £3.00 on the same days last week') !== null);
  // The headline says it in words too, for a screen reader.
  assert.equal(ui.getByRole('group', { name: 'Cash differences' }).textContent.includes('short'), true);
});

test('the table lists each closed day newest first, today as "Not closed yet", and each day\'s Online row', async () => {
  const { ui, within } = await openReports('/workshop/reports/takings', { answers: served() });
  const table = within(await ui.findByRole('table', { name: 'Closed days' }));
  assert.deepEqual(table.getAllByRole('columnheader').map((h) => h.textContent), ['Day', 'Takings', 'Cash banked', 'Cash difference', 'Closed by']);
  const rows = rowsOf(table);
  assert.deepEqual(rows[1], ['Thu 17 Sep', '—', '—', '—', 'Not closed yet']);
  // Today's online money so far, as drawn ("[£] so far"; rp-takings).
  assert.deepEqual(rows[2], ['Thu 17 Sep · Online', '£12.50 so far', '—', '—', 'Not a till']);
  assert.deepEqual(rows[3].slice(1), ['£100.00', '£25.00', '£0.00', 'Jo Taylor']);
  assert.deepEqual(rows[4], ['Wed 16 Sep · Online', '£0.00', '—', '—', 'Not a till']);
  assert.deepEqual(rows[5].slice(1), ['£300.00', '£115.00', '−£5.00 short', 'Jack Lewis']);
  assert.deepEqual(rows[6], ['Tue 15 Sep · Online', '£25.00', '—', '—', 'Not a till']);
  assert.equal(rows.length, 9);
  // A short day stands out in words for a screen reader and in the warning colour.
  const short = table.getByText('−£5.00');
  assert.ok(short.className.includes('wh-warn-ink'));
  assert.ok(ui.queryByText('Online is what customers paid on the website, from your payment provider. It’s separate from the tills: no till counts it, and it’s in no till’s close.') !== null);
  assert.ok(ui.queryByText('Open a closed day for its end-of-day report. The owner can reopen the latest closed day from there, with a reason.') !== null);
});

test('the graph is by closed day, with the same days last week behind it', async () => {
  const { ui, within } = await openReports('/workshop/reports/takings', { answers: served() });
  const graph = await ui.findByRole('img', { name: /^Takings by closed day: busiest day Tue 15 Sep; up £200\.00 on the same days last week\. The figures are in the table below\.$/ });
  assert.equal(within(graph).getAllByText('Not yet').length, 3);
  assert.ok(within(graph).queryByText('Closed days this week') !== null);
});

test('a closed day opens its end-of-day report as it was saved, headed with the day and who closed it', async () => {
  const { ui, within, fireEvent } = await openReports('/workshop/reports/takings', { answers: served() });
  const table = within(await ui.findByRole('table', { name: 'Closed days' }));
  fireEvent.click(table.getByRole('button', { name: /^Tue 15 Sep/ }));
  const box = within(await ui.findByRole('dialog', { name: 'Tue 15 September' }));
  assert.ok(await box.findByText('Closed by Jack Lewis at 17:30') !== null);
  const text = box.getByRole('list').textContent;
  for (const part of ['Takings£300.00', 'Card£150.00', 'Cash£140.00', 'Gift cards, store credit, customer accounts, other£10.00', 'Cycle to WorkOwed by providers, not in the drawer£15.00', 'Cash difference£5.00 short', 'Banked£115.00']) assert.ok(text.includes(part), part);
  assert.ok(box.queryByText('Online money is not in this till’s takings: £25.00 on Tuesday 15 September') !== null);
  assert.ok(box.queryByRole('button', { name: 'Print' }) !== null);
  fireEvent.click(box.getByRole('button', { name: 'Close' }));
  assert.ok(ui.queryByRole('dialog', { name: 'Tue 15 September' }) === null);
});

test('Today and the other periods ask for their own', async () => {
  const { ui, fireEvent } = await openReports('/workshop/reports/takings', { answers: served() });
  await ui.findByRole('table', { name: 'Closed days' });
  fireEvent.click(ui.getByRole('radio', { name: 'Last month' }));
  await ui.findByRole('radio', { name: 'Last month', checked: true });
  assert.equal(calls.filter((c) => c.path === '/api/reports/takings').at(-1).query.get('period'), 'last-month');
});

test('a month of days beyond 62 shows a row per month that opens nothing', async () => {
  const months = () => ({
    ...TAKINGS_WEEK,
    period: { ...TAKINGS_WEEK.period, period: 'dates', unit: 'month', label: '30 June – 17 September', against: 'the same number of days just before' },
    rows: [{ kind: 'month', key: '2026-09', label: 'Sep', closed: true, closedDays: 7, takingsPence: 204900, bankedPence: 50000, differencePence: -500 }],
    bars: [bar2('2026-09', 'Sep', 204900, 0)],
  });
  const { ui, within } = await openReports('/workshop/reports/takings?period=dates&from=2026-06-30&to=2026-09-17', { answers: served({ '/api/reports/takings': () => [200, months()] }) });
  const table = within(await ui.findByRole('table', { name: 'Closed days' }));
  assert.deepEqual(rowsOf(table)[1], ['Sep', '£2,049.00', '£500.00', '−£5.00 short', '7 closed days']);
  assert.equal(table.queryAllByRole('button').length, 0);
});
function bar2(key, label, takings, before) { return { key, label, notReached: false, takingsPence: takings, sales: null, averagePence: null, beforeTakingsPence: before, beforeSales: 0 }; }

test('no closed days: says so', async () => {
  const none = () => ({ ...TAKINGS_WEEK, rows: [], empty: true, bars: [], figures: { ...TAKINGS_WEEK.figures, takings: { pence: 0, beforePence: 0, diffPence: 0 } } });
  const { ui } = await openReports('/workshop/reports/takings', { answers: served({ '/api/reports/takings': () => [200, none()] }) });
  assert.ok(await ui.findByText('No days closed in this period') !== null);
  assert.ok(ui.queryByRole('table') === null);
});

test('a refusal is shown in the server\'s words', async () => {
  const { ui } = await openReports('/workshop/reports/takings', { answers: { '/api/reports/takings': () => [403, { error: "Only the shop's owner can see reports", code: 'owner_only' }] } });
  assert.ok(await ui.findByText("Only the shop's owner can see reports") !== null);
});

test('a day that can\'t be opened says so, rather than showing nothing', async () => {
  const gone = { '/api/reports/days/777': () => [404, { error: 'That day isn’t closed' }] };
  const { ui } = await openReports('/workshop/reports/takings?day=777', { answers: served(gone) });
  assert.ok(await ui.findByText('That day isn’t closed') !== null);
});

test('a past day nobody closed is a "Not closed" row with its takings so far and a link to close it', async () => {
  const withSaturday = () => ({ ...TAKINGS_WEEK, rows: [...TAKINGS_WEEK.rows, { kind: 'day', key: '2026-09-12', label: 'Sat 12 Sep', closed: false, past: true, takingsPence: 2000, closeDay: '2026-09-12' }] });
  const { ui, within } = await openReports('/workshop/reports/takings', { answers: served({ '/api/reports/takings': () => [200, withSaturday()] }) });
  const table = within(await ui.findByRole('table', { name: 'Closed days' }));
  const row = rowsOf(table).find((r) => r[0] === 'Sat 12 Sep');
  assert.deepEqual(row, ['Sat 12 Sep', '£20.00 so far', '—', '—', 'Not closedClose it']);
  // Close it goes to Close the day for that day, as Today's "Close it" does.
  const link = table.getByRole('link', { name: 'Close Saturday 12 September' });
  assert.equal(link.getAttribute('href'), '/workshop/till/close?day=2026-09-12');
  // Today's own row is still "Not closed yet", with no link.
  assert.ok(table.queryAllByRole('link').length === 1);
});
