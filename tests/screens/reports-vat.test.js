// VAT, the screen (openspec/changes/reports-ready-made, group 3; drawn as
// rp-vat and rp-vat-first in generator/reports.mjs; decision 3).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openReports, closeReports, calls, HOME } from '../helpers/reports-screen.js';

afterEach(closeReports);

// This VAT quarter on 17 September, as server/lib/report-vat.js gives it.
const rows = [
  { rateBp: 2000, label: 'Standard 20%', salesPence: 10000, vatPence: 2000, beforeVatPence: 1500 },
  { rateBp: 500, label: 'Reduced rate 5%', salesPence: 2000, vatPence: 100, beforeVatPence: 0 },
  { rateBp: 0, label: 'Zero rate 0%', salesPence: 3000, vatPence: 0, beforeVatPence: 0 },
];
const QUARTER = {
  period: { period: 'this-vat-quarter', from: '2026-07-01', to: '2026-09-30', through: '2026-09-17', soFar: true, label: '1 July – 30 September', against: 'the quarter before' },
  before: { from: '2026-04-01', to: '2026-06-30' },
  quarterStartMonth: 1, needsQuarter: false,
  rows,
  total: { label: 'Total', salesPence: 15000, vatPence: 2100, beforeVatPence: 1500 },
  notRecorded: { label: 'VAT not recorded', takingsPence: 0, beforeTakingsPence: 0 },
  shopLine: 'North Street Cycles, Bolton', today: '2026-09-17',
};
const NOT_SAID = { ...QUARTER, quarterStartMonth: null, needsQuarter: true };
const OLD = { ...QUARTER, notRecorded: { label: 'VAT not recorded', takingsPence: 4800, beforeTakingsPence: 1200 } };

const served = (report = QUARTER, extra = {}) => ({
  '/api/reports/vat': () => [200, report],
  '/api/reports/vat.csv': () => [200, 'VAT on sales by rate\r\n', { 'content-disposition': 'attachment; filename="vat-north-street-2026-07-01-to-2026-09-17.csv"' }],
  ...extra,
});
const vatCalls = () => calls.filter((c) => c.path === '/api/reports/vat');

test('the VAT card on Reports opens the report', async () => {
  const { ui, within } = await openReports('/workshop/reports', { answers: { ...served(), '/api/reports/home': () => [200, HOME] } });
  const cards = within(await ui.findByRole('region', { name: 'Ready-made reports' }));
  const card = cards.getByRole('link', { name: /^VAT/ });
  assert.equal(card.getAttribute('href'), '/workshop/reports/vat');
  assert.ok(within(card).queryByText('VAT by rate for your VAT quarter, for your accountant') !== null);
});

test('VAT opens on this VAT quarter with the three periods and no "Change what\'s shown"', async () => {
  const { ui, within } = await openReports('/workshop/reports/vat', { answers: served() });
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'VAT' }) !== null);
  assert.ok(await ui.findByText('North Street Cycles, Bolton · this VAT quarter, 1 July – 30 September, against the quarter before') !== null);
  assert.equal(vatCalls()[0].query.get('period'), 'this-vat-quarter');
  const periods = within(ui.getByRole('group', { name: 'Period' })).getAllByRole('radio');
  assert.deepEqual(periods.map((r) => r.labels[0].textContent), ['This VAT quarter', 'Last VAT quarter', 'Pick dates']);
  assert.deepEqual(periods.map((r) => r.checked), [true, false, false]);
  assert.ok(ui.queryByRole('button', { name: /Change what/ }) === null);
  assert.ok(ui.queryByRole('dialog') === null);
  assert.equal(ui.getByRole('link', { name: 'All reports' }).getAttribute('href'), '/workshop/reports');
});

test('Last VAT quarter asks for it and says so', async () => {
  const LAST = { ...QUARTER, period: { ...QUARTER.period, period: 'last-vat-quarter', from: '2026-04-01', to: '2026-06-30', through: '2026-06-30', soFar: false, label: '1 April – 30 June' } };
  const { ui, fireEvent, waitFor } = await openReports('/workshop/reports/vat', { answers: { '/api/reports/vat': (q) => [200, q.get('period') === 'last-vat-quarter' ? LAST : QUARTER] } });
  await ui.findByRole('table', { name: 'VAT on sales by rate' });
  fireEvent.click(ui.getByLabelText('Last VAT quarter'));
  await waitFor(() => assert.equal(vatCalls().at(-1).query.get('period'), 'last-vat-quarter'));
  assert.ok(await ui.findByText('North Street Cycles, Bolton · last VAT quarter, 1 April – 30 June, against the quarter before') !== null);
});

test('the Sales table by rate with the Total, no Refunds row, the Stock purchases box with no figure, the note and no graph', async () => {
  const { ui, within } = await openReports('/workshop/reports/vat', { answers: served() });
  const table = await ui.findByRole('table', { name: 'VAT on sales by rate' });
  const t = within(table);
  assert.deepEqual(t.getAllByRole('columnheader').map((h) => h.textContent), ['Rate', 'Sales before VAT', 'VAT charged', 'Quarter before']);
  const body = t.getAllByRole('row').slice(1).map((r) => [...r.querySelectorAll('th, td')].map((c) => c.textContent));
  assert.deepEqual(body, [
    ['Standard 20%', '£100.00', '£20.00', '£15.00'],
    ['Reduced rate 5%', '£20.00', '£1.00', '£0.00'],
    ['Zero rate 0%', '£30.00', '£0.00', '£0.00'],
    ['Total', '£150.00', '£21.00', '£15.00'],
  ]);
  assert.ok(t.queryByText('Refunds') === null);
  assert.ok(ui.queryByRole('table', { name: /VAT not recorded/ }) === null);
  const stock = within(ui.getByRole('region', { name: 'Stock purchases' }));
  assert.ok(stock.getByRole('note').textContent === 'Stock purchases only — not your full VAT reclaim. Rent, bills and other costs don’t go through Wheelhouse.');
  assert.ok(stock.queryByText('Supplier invoices are checked in your accounts software — take this figure from there.') !== null);
  assert.ok(stock.queryByText(/£/) === null);
  assert.ok(ui.queryByText('No graph here: these are the exact figures your accountant needs. Wheelhouse doesn’t file your VAT return — file it from your accounts software, or send this to your accountant.') !== null);
  assert.ok(ui.queryByRole('img') === null);
});

test('sales from the old record show as "VAT not recorded" with their takings and the line about them', async () => {
  const { ui, within } = await openReports('/workshop/reports/vat', { answers: served(OLD) });
  const table = await ui.findByRole('table', { name: 'Sales without their VAT' });
  const t = within(table);
  assert.deepEqual(t.getAllByRole('columnheader').map((h) => h.textContent), ['Sales', 'Takings including VAT', 'Quarter before']);
  const row = [...t.getAllByRole('row')[1].querySelectorAll('th, td')].map((c) => c.textContent);
  assert.deepEqual(row, ['VAT not recorded', '£48.00', '£12.00']);
  assert.ok(ui.queryByText('These sales were made before Wheelhouse kept VAT on each sale. Take their VAT from your accounts software or ask your accountant.') !== null);
});

test('first opening asks when the VAT quarter starts; Save keeps it and doesn\'t ask again', async () => {
  let saved = null;
  const answers = served(NOT_SAID, {
    '/api/reports/vat': () => [200, saved ? { ...QUARTER, quarterStartMonth: saved, period: { ...QUARTER.period, from: '2026-09-01', to: '2026-11-30', label: '1 September – 30 November' } } : NOT_SAID],
    '/api/shop-details': (q, method, body) => { if (method === 'PUT') saved = body.vatQuarterStartMonth; return [200, {}]; },
  });
  const { ui, within, fireEvent, waitFor } = await openReports('/workshop/reports/vat', { answers });
  const dialog = within(await ui.findByRole('dialog', { name: 'When does your VAT quarter start?' }));
  assert.ok(dialog.queryByText('Asked once. Change it later in Settings › Shop and sites.') !== null);
  const months = within(dialog.getByRole('radiogroup', { name: 'Months your VAT quarters start' })).getAllByRole('radio');
  assert.deepEqual(months.map((m) => m.textContent), ['January, April, July, October', 'February, May, August, November', 'March, June, September, December']);
  assert.deepEqual(months.map((m) => m.getAttribute('aria-checked')), ['true', 'false', 'false']);
  assert.ok(dialog.queryByText('It’s on your VAT registration, or ask your accountant.') !== null);
  fireEvent.click(months[2]);
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.equal(saved, 3));
  const put = calls.find((c) => c.path === '/api/shop-details' && c.method === 'PUT');
  assert.deepEqual(put.body, { vatQuarterStartMonth: 3 });
  assert.ok(await ui.findByText('North Street Cycles, Bolton · this VAT quarter, 1 September – 30 November, against the quarter before') !== null);
  await waitFor(() => assert.ok(ui.queryByRole('dialog') === null));
});

test('Not now shows calendar quarters with a line saying so, and asks again next time', async () => {
  const first = await openReports('/workshop/reports/vat', { answers: served(NOT_SAID) });
  const dialog = first.within(await first.ui.findByRole('dialog', { name: 'When does your VAT quarter start?' }));
  first.fireEvent.click(dialog.getByRole('button', { name: 'Not now' }));
  await first.waitFor(() => assert.ok(first.ui.queryByRole('dialog') === null));
  assert.ok(first.ui.queryByText(/^Showing calendar quarters/) !== null);
  assert.ok(first.ui.queryByRole('table', { name: 'VAT on sales by rate' }) !== null);
  assert.ok(calls.every((c) => c.method !== 'PUT'));
  await closeReports();
  const again = await openReports('/workshop/reports/vat', { answers: served(NOT_SAID) });
  assert.ok(await again.ui.findByRole('dialog', { name: 'When does your VAT quarter start?' }) !== null);
});

test('"Download as spreadsheet" downloads this period\'s file under the server\'s name', async () => {
  const { ui, fireEvent, waitFor } = await openReports('/workshop/reports/vat', { answers: served() });
  await ui.findByRole('table', { name: 'VAT on sales by rate' });
  const saved = [];
  window.URL.createObjectURL = () => 'blob:test';
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function click() { saved.push(this.download); };
  fireEvent.click(ui.getByRole('button', { name: 'Download as spreadsheet' }));
  await waitFor(() => assert.deepEqual(saved, ['vat-north-street-2026-07-01-to-2026-09-17.csv']));
  assert.equal(calls.filter((c) => c.path === '/api/reports/vat.csv')[0].query.get('period'), 'this-vat-quarter');
});

test('Staff are told the report is the owner\'s, in the server\'s words', async () => {
  const { ui } = await openReports('/workshop/reports/vat', {
    answers: { '/api/reports/vat': () => [403, { error: "Only the shop's owner can see reports" }] },
  });
  assert.ok(await ui.findByText("Only the shop's owner can see reports") !== null);
});
