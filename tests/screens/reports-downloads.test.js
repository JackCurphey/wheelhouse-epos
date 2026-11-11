// Download as spreadsheet and Show graphs in reports, the screens
// (openspec/changes/reports-sales-and-takings, group 4; Jack's answers 10 and 11
// of 10 Nov; reports.mjs `DL` and `settingsGraphs`).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openReports, closeReports, salesFor, TAKINGS_WEEK, TUESDAY_CLOSE, STAFF, calls } from '../helpers/reports-screen.js';

afterEach(closeReports);
const csv = (name) => [200, 'Day,Takings\r\n', { 'content-disposition': `attachment; filename="${name}"` }];
const served = (extra = {}) => ({
  '/api/reports/sales': (query) => [200, salesFor(query)],
  '/api/reports/sales.csv': () => csv('sales-north-street-cycles-2026-09-14-to-2026-09-17.csv'),
  '/api/reports/takings': () => [200, TAKINGS_WEEK],
  '/api/reports/takings.csv': () => csv('takings-north-street-cycles-2026-09-14-to-2026-09-17.csv'),
  '/api/reports/days/30': () => [200, TUESDAY_CLOSE],
  '/api/reports/days/30/csv': () => csv('day-north-street-cycles-2026-09-15.csv'),
  ...extra,
});

// What a click on a download link does: the file name it was given, and the address fetched.
function watchDownloads() {
  const saved = [];
  window.URL.createObjectURL = () => 'blob:test';
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function click() { saved.push(this.download); };
  return saved;
}

test('Sales: "Download as spreadsheet" beside the title downloads this period\'s file under the server\'s name', async () => {
  const { ui, fireEvent, waitFor } = await openReports('/workshop/reports/sales?period=last-month', { answers: served() });
  await ui.findByRole('table', { name: 'Sales by day' });
  const saved = watchDownloads();
  fireEvent.click(ui.getByRole('button', { name: 'Download as spreadsheet' }));
  await waitFor(() => assert.deepEqual(saved, ['sales-north-street-cycles-2026-09-14-to-2026-09-17.csv']));
  const asked = calls.filter((c) => c.path === '/api/reports/sales.csv');
  assert.equal(asked.length, 1);
  assert.equal(asked[0].query.get('period'), 'last-month');
});

test('on a phone the button says just "Download"', async () => {
  const { ui } = await openReports('/workshop/reports/sales', { answers: served(), phone: true });
  await ui.findByRole('table', { name: 'Sales by day' });
  assert.ok(ui.queryByRole('button', { name: 'Download' }) !== null);
  assert.ok(ui.queryByRole('button', { name: 'Download as spreadsheet' }) === null);
});

test('a refused download says why and keeps the report', async () => {
  const { ui, fireEvent } = await openReports('/workshop/reports/sales', { answers: served({ '/api/reports/sales.csv': () => [403, { error: "Only the shop's owner can see reports" }] }) });
  await ui.findByRole('table', { name: 'Sales by day' });
  watchDownloads();
  fireEvent.click(ui.getByRole('button', { name: 'Download as spreadsheet' }));
  assert.ok(await ui.findByText("Only the shop's owner can see reports") !== null);
  assert.ok(ui.queryByRole('table', { name: 'Sales by day' }) !== null);
});

test('Takings and cash-ups downloads its table, and a closed day\'s report has its own download', async () => {
  const { ui, within, fireEvent, waitFor } = await openReports('/workshop/reports/takings', { answers: served() });
  const table = within(await ui.findByRole('table', { name: 'Closed days' }));
  const saved = watchDownloads();
  fireEvent.click(ui.getByRole('button', { name: 'Download as spreadsheet' }));
  await waitFor(() => assert.deepEqual(saved, ['takings-north-street-cycles-2026-09-14-to-2026-09-17.csv']));
  fireEvent.click(table.getByRole('button', { name: /^Tue 15 Sep/ }));
  const box = within(await ui.findByRole('dialog', { name: 'Tue 15 September' }));
  fireEvent.click(await box.findByRole('button', { name: 'Download as spreadsheet' }));
  await waitFor(() => assert.equal(saved.at(-1), 'day-north-street-cycles-2026-09-15.csv'));
});

test('with "Show graphs in reports" off, every report shows its table and no graph', async () => {
  const sales = await openReports('/workshop/reports/sales', { answers: served(), accessibility: { showGraphs: false } });
  await sales.ui.findByRole('table', { name: 'Sales by day' });
  assert.ok(sales.ui.queryByRole('img') === null);
  assert.ok(sales.ui.queryByText('Not yet') === null);
  await closeReports();
  const takings = await openReports('/workshop/reports/takings', { answers: served(), accessibility: { showGraphs: false } });
  await takings.ui.findByRole('table', { name: 'Closed days' });
  assert.ok(takings.ui.queryByRole('img') === null);
});

test('with it on (to start) the graph shows', async () => {
  const { ui } = await openReports('/workshop/reports/sales', { answers: served() });
  assert.ok(await ui.findByRole('img', { name: /^Takings by day:/ }) !== null);
});

test('Your settings › Accessibility shows "Show graphs in reports" to the Owner, saved for them', async () => {
  const puts = [];
  let showGraphs = true;
  const answers = {
    '/api/your-settings': (q, method, body) => {
      if (method === 'PUT') { puts.push(body); showGraphs = body.accessibility.showGraphs; }
      return [200, { accessibility: { showLegend: true, statusSymbols: false, reduceMotion: false, noAutoClose: false, largerText: false, foldedSidebar: false, showGraphs } }];
    },
  };
  const { ui, within, fireEvent, waitFor } = await openReports('/workshop/your-settings', { answers });
  const dialog = within(await ui.findByRole('dialog', { name: 'Your settings' }));
  const toggle = await dialog.findByRole('switch', { name: 'Show graphs in reports' });
  assert.equal(toggle.getAttribute('aria-checked'), 'true', 'on to start');
  // Last in the Accessibility list, after Folded sidebar, as drawn (app-map.mjs ys-graphs).
  const names = dialog.getAllByRole('switch').map((el) => el.getAttribute('aria-label'));
  assert.equal(names.at(-1), 'Show graphs in reports');
  assert.equal(names.at(-2), 'Folded sidebar');
  assert.ok(dialog.queryByText('A graph above each report. The figures are always in the table below it, for screen readers too.') !== null);
  fireEvent.click(toggle);
  await waitFor(() => assert.deepEqual(puts, [{ accessibility: { showGraphs: false } }]));
});

test('Staff do not see it', async () => {
  const { ui, within } = await openReports('/workshop/your-settings', { who: STAFF });
  const dialog = within(await ui.findByRole('dialog', { name: 'Your settings' }));
  await dialog.findByRole('switch', { name: 'Reduce motion' });
  assert.ok(dialog.queryByRole('switch', { name: 'Show graphs in reports' }) === null);
});

test('a download that fails to reach the server says so, and the report stays', async () => {
  const { ui, fireEvent } = await openReports('/workshop/reports/takings', { answers: served({ '/api/reports/takings.csv': () => { throw new Error('offline'); } }) });
  await ui.findByRole('table', { name: 'Closed days' });
  watchDownloads();
  fireEvent.click(ui.getByRole('button', { name: 'Download as spreadsheet' }));
  assert.ok(await ui.findByText('Wheelhouse couldn’t make the file. Try again in a moment.') !== null);
  assert.ok(ui.queryByRole('table', { name: 'Closed days' }) !== null);
});

test('on a phone Takings and cash-ups and a closed day also say just "Download"', async () => {
  const { ui, within, fireEvent } = await openReports('/workshop/reports/takings', { answers: served(), phone: true });
  const table = within(await ui.findByRole('table', { name: 'Closed days' }));
  assert.ok(ui.queryByRole('button', { name: 'Download' }) !== null);
  fireEvent.click(table.getByRole('button', { name: /^Tue 15 Sep/ }));
  const box = within(await ui.findByRole('dialog', { name: 'Tue 15 September' }));
  assert.ok(await box.findByRole('button', { name: 'Download' }) !== null);
});

test('a month of bars names every few, so the labels never run together', async () => {
  const days = Array.from({ length: 31 }, (_, i) => ({ key: `2026-08-${String(i + 1).padStart(2, '0')}`, label: `Day ${i + 1} Aug`, notReached: false, takingsPence: 1000 * (i + 1), sales: 1, averagePence: 1000, beforeTakingsPence: 500, beforeSales: 1 }));
  const month = () => ({ ...salesFor(new URLSearchParams('period=last-month')), period: { period: 'last-month', from: '2026-08-01', to: '2026-08-31', through: '2026-08-31', soFar: false, unit: 'day', label: 'August 2026', against: 'the month before' }, rows: days });
  const { ui, within } = await openReports('/workshop/reports/sales?period=last-month', { answers: { '/api/reports/sales': () => [200, month()] }, phone: true });
  const graph = within(await ui.findByRole('img', { name: /^Takings by day:/ }));
  const named = [...document.querySelectorAll('figure svg text')].filter((t) => /^Day$/.test(t.textContent));
  assert.ok(named.length > 0 && named.length < 31, `named ${named.length} of 31`);
  assert.ok(graph);
});
