// Change what's shown on Cycle to Work (openspec/changes/cycle-to-work, task 10.4's follow-up;
// rp-c2w's "Change what's shown"). The answers are the shapes server/lib/report-changed.js sends
// for the Cycle to Work base; tests/report-changed-c2w.test.js proves the server sends them.
// Provider names stay bracketed.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openReports, closeReports, calls } from '../helpers/reports-screen.js';

afterEach(closeReports);

const PERIOD = { period: 'this-month', from: '2026-10-01', to: '2026-10-31', through: '2026-10-17', soFar: true, unit: 'day', label: 'So far: 1 – 17 October', against: 'the same days last month' };

function choices(query) {
  const measure = query.get('measure') || 'paid';
  const split = query.get('split') || 'provider';
  return {
    base: 'c2w',
    selection: { measure, split, only: query.getAll('only'), supplier: '' },
    choices: {
      measure: [{ value: 'bikes', label: 'Bikes collected' }, { value: 'paid', label: 'Paid' }, { value: 'commission', label: 'Commission' }],
      split: [{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'provider', label: 'Provider' }, { value: 'shop', label: 'Shop', why: 'one shop until a second one is added' }],
      only: [{ value: '[Provider A]', label: '[Provider A]' }, { value: '[Provider B]', label: '[Provider B]' }],
      suppliers: [],
    },
  };
}
const PAID = {
  base: 'c2w', baseLabel: 'Cycle to Work', measure: 'paid', split: 'provider', only: [], supplier: '',
  title: 'Cycle to Work: paid by provider', what: 'Cycle to Work: paid by provider',
  line: 'Changed from Cycle to Work · So far: 1 – 17 October, against the same days last month',
  period: PERIOD, columns: ['Provider', 'Paid'],
  rows: [{ key: '1', label: '[Provider A]', value: 95000, takingsPence: 95000, beforeValue: 47500 }, { key: '2', label: '[Provider B]', value: 30000, takingsPence: 30000, beforeValue: 0 }],
  total: { label: 'Total', value: 125000, takingsPence: 125000 }, figures: { value: 125000, beforeValue: 47500, diffValue: 77500 },
  showBefore: true, empty: false, nothingBefore: false, firstSaleOn: '2026-09-05', shopLine: 'North Street Cycles, Bolton', today: '2026-10-17',
  choices: choices(new URLSearchParams()).choices,
};
const MONTH = {
  period: PERIOD, before: { from: '2026-09-01', to: '2026-09-17' },
  columns: { now: 'This month so far', before: 'Same days last month' },
  figures: { owedNow: { pence: 0, bikes: 0, late: 0 }, paid: { pence: 125000, beforePence: 47500, diffPence: 77500 }, commission: { pence: 5000, beforePence: 2500, diffPence: 2500 }, shortfalls: { pence: 0, orders: 0 } },
  providers: [
    { id: 1, name: '[Provider A]', bikesCollected: 1, owedPence: 0, paidPence: 95000, beforePaidPence: 47500, commissionPence: 5000, late: 0 },
    { id: 2, name: '[Provider B]', bikesCollected: 2, owedPence: 0, paidPence: 30000, beforePaidPence: 0, commissionPence: 0, late: 0 },
  ],
  total: { label: 'All providers', bikesCollected: 3, owedPence: 0, paidPence: 125000, beforePaidPence: 47500, commissionPence: 5000, late: 0 },
  shopLine: 'North Street Cycles, Bolton', today: '2026-10-17',
};
const served = () => ({
  '/api/reports/c2w': () => [200, MONTH],
  '/api/reports/changed/choices': (query) => [200, choices(query)],
  '/api/reports/changed': () => [200, PAID],
  '/api/reports/saved': (query, method) => (method === 'POST' ? [201, { id: 1, name: 'Paid' }] : [200, { reports: [] }]),
});

async function openPanel() {
  const opened = await openReports('/workshop/reports/c2w', { answers: served() });
  const { ui, within, fireEvent } = opened;
  await ui.findByRole('heading', { level: 2, name: 'Cycle to Work: owed and paid' });
  fireEvent.click(ui.getByRole('button', { name: 'Change what’s shown' }));
  const panel = within(await ui.findByRole('dialog', { name: 'Change what’s shown' }));
  await panel.findByRole('radio', { name: 'Paid', checked: true });
  return { ...opened, panel };
}

test('Cycle to Work has Change what\'s shown, which opens on Paid by Provider with the period under its title', async () => {
  const { panel } = await openPanel();
  assert.ok(panel.queryByText('Cycle to Work · this month so far') !== null);
  assert.ok(panel.getByRole('radio', { name: 'Provider' }).checked);
  const first = calls.find((c) => c.path === '/api/reports/changed/choices');
  assert.equal(first.query.get('base'), 'c2w');
  assert.equal(first.query.get('period'), 'this-month');
});

test('Only lists the providers and there is no Supplier', async () => {
  const { panel } = await openPanel();
  assert.deepEqual(panel.getAllByRole('checkbox').map((c) => c.labels[0].textContent), ['[Provider A]', '[Provider B]']);
  assert.ok(panel.queryByText('Supplier') === null);
  assert.ok(panel.queryByRole('radio', { name: 'Any supplier' }) === null);
});

test('Show report opens the changed Cycle to Work report in pounds, and goes back to Cycle to Work', async () => {
  const { ui, within, panel, fireEvent } = await openPanel();
  fireEvent.click(panel.getByRole('button', { name: 'Show report' }));
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'Cycle to Work: paid by provider' }) !== null);
  const search = new URLSearchParams(window.location.search);
  assert.deepEqual([search.get('base'), search.get('measure'), search.get('split')], ['c2w', 'paid', 'provider']);
  const table = within(ui.getByRole('table', { name: 'Paid by provider' }));
  const rows = table.getAllByRole('row').map((r) => [...r.querySelectorAll('th,td')].map((c) => c.textContent));
  assert.deepEqual(rows[0], ['Provider', 'Paid']);
  assert.deepEqual(rows[1], ['[Provider A]', '£950.00']);
  assert.deepEqual(rows[2], ['[Provider B]', '£300.00']);
  assert.deepEqual(rows.at(-1), ['Total', '£1,250.00']);
  assert.ok(ui.getByRole('img', { name: /^Paid by provider: most paid by \[Provider A\]; up £775\.00 on the same days last month\. The figures are in the table below\.$/ }) !== null);
  assert.equal(ui.getByRole('link', { name: 'Back to Cycle to Work' }).getAttribute('href'), '/workshop/reports/c2w?period=this-month');
});

test('a changed Cycle to Work report can be saved as a Cycle to Work report', async () => {
  const { ui, within, fireEvent } = await openReports('/workshop/reports/changed?base=c2w&measure=paid&split=provider&period=this-month', { answers: served() });
  await ui.findByRole('heading', { level: 2, name: 'Cycle to Work: paid by provider' });
  fireEvent.click(ui.getByRole('button', { name: 'Save as my report' }));
  const dialog = within(await ui.findByRole('dialog', { name: 'Save as my report' }));
  fireEvent.change(dialog.getByLabelText('Name (needed)'), { target: { value: 'Paid' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  await ui.findByText('Saved as “Paid”. It is in Your reports on the Reports page.');
  const sent = calls.find((c) => c.method === 'POST').body;
  assert.deepEqual([sent.base, sent.measure, sent.split], ['c2w', 'paid', 'provider']);
});
