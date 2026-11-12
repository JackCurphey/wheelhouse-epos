// "Change what's shown" and the changed report (openspec/changes/reports-your-own,
// group 1; drawn as rp-change and rp-changed in generator/reports.mjs; decisions
// 1, 2 and 6). The answers are the shapes server/lib/report-changed.js sends;
// tests/report-changed.test.js proves the server sends them, these prove the
// screen reads them.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openReports, closeReports, salesFor, TAKINGS_WEEK, calls } from '../helpers/reports-screen.js';

afterEach(closeReports);

const WHY_JOBS = 'workshop only — choose it from the Workshop report';
const NOT_BY_ITEM = 'payments aren’t split by item';

// The panel's choices for a selection, as the server gives them.
function choices(query) {
  const base = query.get('base') || 'sales';
  const only = query.getAll('only');
  let measure = query.get('measure') || 'takings';
  let split = query.get('split') || (base === 'takings' ? 'payment' : 'day');
  const byItem = measure === 'items';
  const limited = only.length > 0 || Boolean(query.get('supplier'));
  if (split === 'payment' && (byItem || limited)) split = byItem ? 'product' : 'day';
  const grey = (value, why) => ({ value, label: why.label, why: why.text });
  return {
    base,
    selection: { measure, split, only, supplier: query.get('supplier') || '' },
    choices: {
      measure: [
        { value: 'takings', label: 'Takings' }, { value: 'items', label: 'Items sold' },
        grey('margin', { label: 'Margin', text: 'costs aren’t kept on sales yet' }),
        grey('jobs', { label: 'Jobs', text: WHY_JOBS }), grey('hours', { label: 'Hours', text: 'workshop only' }),
      ],
      split: [
        { value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'category', label: 'Category' }, { value: 'product', label: 'Product' },
        { value: 'staff', label: 'Staff member' }, grey('shop', { label: 'Shop', text: 'one shop until a second one is added' }),
        byItem || limited ? grey('payment', { label: 'Payment type', text: NOT_BY_ITEM }) : { value: 'payment', label: 'Payment type' },
      ],
      only: [{ value: 'Accessories', label: 'Accessories' }, { value: 'Drivetrain', label: 'Drivetrain' }, { value: 'Labour', label: 'Labour' }],
      suppliers: [{ value: '', label: 'Any supplier' }, { value: 'Acme', label: 'Acme' }],
    },
  };
}

// Items sold by product, Accessories only: the report of rp-changed.
const ITEMS = {
  base: 'sales', baseLabel: 'Sales', measure: 'items', split: 'product', only: ['Accessories'], supplier: '',
  title: 'Sales: items sold by product',
  line: 'Changed from Sales · Accessories only · So far: Mon 14 – Thu 17 September, against the same days last week',
  period: { period: 'this-week', from: '2026-09-14', to: '2026-09-20', through: '2026-09-17', soFar: true, unit: 'day', label: 'So far: Mon 14 – Thu 17 September', against: 'the same days last week' },
  columns: ['Product', 'Items sold', 'Takings'],
  rows: [
    { key: 'p1', label: 'Water bottle', value: 3, takingsPence: 1767, beforeValue: 1 },
    { key: 'p2', label: 'Track pump', value: 2, takingsPence: 1200, beforeValue: 0 },
  ],
  total: { label: 'Total, Accessories only', value: 5, takingsPence: 2967 },
  figures: { value: 5, beforeValue: 1, diffValue: 4 },
  showBefore: true, empty: false, nothingBefore: false, firstSaleOn: '2026-08-20', shopLine: 'North Street Cycles, Bolton', today: '2026-09-17',
  fileName: 'sales-changed', choices: choices(new URLSearchParams('base=sales&measure=items&split=product&only=Accessories')).choices,
};

const served = (extra = {}) => ({
  '/api/reports/sales': (query) => [200, salesFor(query)],
  '/api/reports/takings': () => [200, TAKINGS_WEEK],
  '/api/reports/changed/choices': (query) => [200, choices(query)],
  '/api/reports/changed': (query) => [200, { ...ITEMS, base: query.get('base') || 'sales' }],
  ...extra,
});
const choiceCalls = () => calls.filter((c) => c.path === '/api/reports/changed/choices');
const reportCalls = () => calls.filter((c) => c.path === '/api/reports/changed');

async function openPanel(path = '/workshop/reports/sales') {
  const opened = await openReports(path, { answers: served() });
  const { ui, within, fireEvent } = opened;
  await ui.findByRole(path.includes('takings') ? 'heading' : 'table', path.includes('takings') ? { level: 2, name: 'Takings and cash-ups' } : { name: 'Sales by day' });
  fireEvent.click(ui.getByRole('button', { name: 'Change what’s shown' }));
  const panel = within(await ui.findByRole('dialog', { name: 'Change what’s shown' }));
  return { ...opened, panel };
}
const chosen = (panel, group) => panel.getAllByRole(group === 'Only' ? 'checkbox' : 'radio').filter((r) => r.checked).map((r) => r.labels[0].textContent);

test('the panel opens from Sales on Takings by Day, with the report and period under its title', async () => {
  const { ui, panel } = await openPanel();
  assert.ok(panel.queryByText('Sales · this week so far') !== null);
  await panel.findByRole('radio', { name: 'Takings', checked: true });
  assert.ok(panel.getByRole('radio', { name: 'Day' }).checked);
  assert.equal(choiceCalls()[0].query.get('base'), 'sales');
  assert.equal(choiceCalls()[0].query.get('period'), 'this-week');
  assert.ok(ui.getByRole('dialog', { name: 'Change what’s shown' }) !== null);
});

test('opened from Takings and cash-ups it opens on Takings by Payment type', async () => {
  const { panel } = await openPanel('/workshop/reports/takings');
  await panel.findByRole('radio', { name: 'Payment type', checked: true });
  assert.equal(choiceCalls()[0].query.get('base'), 'takings');
  assert.ok(panel.queryByText('Takings and cash-ups · this week so far') !== null);
});

test('a choice that does not fit is greyed, says why to a screen reader, and says it under its group', async () => {
  const { panel, fireEvent } = await openPanel();
  const jobs = await panel.findByRole('radio', { name: 'Jobs' });
  assert.equal(jobs.getAttribute('aria-disabled'), 'true');
  assert.equal(jobs.getAttribute('aria-description'), WHY_JOBS);
  assert.equal(panel.getByRole('radio', { name: 'Hours' }).getAttribute('aria-description'), 'workshop only');
  assert.ok(panel.queryByText(`Margin: costs aren’t kept on sales yet · Jobs: ${WHY_JOBS} · Hours: workshop only`) !== null);
  assert.equal(panel.getByRole('radio', { name: 'Shop' }).getAttribute('aria-disabled'), 'true');
  // A greyed choice can't be chosen, and asks nothing.
  const asked = choiceCalls().length;
  fireEvent.click(jobs);
  assert.equal(jobs.checked, false);
  assert.equal(choiceCalls().length, asked);
  assert.equal(panel.getByRole('radio', { name: 'Day' }).getAttribute('aria-disabled'), null);
});

test('choosing Items sold greys Payment type, and the split moves to one that fits', async () => {
  const { panel, fireEvent } = await openPanel();
  await panel.findByRole('radio', { name: 'Takings', checked: true });
  fireEvent.click(panel.getByRole('radio', { name: 'Payment type' }));
  await panel.findByRole('radio', { name: 'Payment type', checked: true });
  fireEvent.click(panel.getByRole('radio', { name: 'Items sold' }));
  await panel.findByRole('radio', { name: 'Items sold', checked: true });
  const payment = await panel.findByRole('radio', { name: 'Payment type' });
  assert.equal(payment.getAttribute('aria-disabled'), 'true');
  assert.equal(payment.getAttribute('aria-description'), NOT_BY_ITEM);
  assert.equal(payment.checked, false);
  assert.ok(panel.getByRole('radio', { name: 'Product' }).checked);
  assert.equal(choiceCalls().at(-1).query.get('measure'), 'items');
  assert.ok(panel.queryByText(new RegExp(`Payment type: ${NOT_BY_ITEM}`)) !== null);
});

test('Only lists the categories and Labour as checkboxes, and Supplier as Any supplier and each one that sold', async () => {
  const { panel, fireEvent } = await openPanel();
  await panel.findByRole('checkbox', { name: 'Accessories' });
  assert.deepEqual(panel.getAllByRole('checkbox').map((c) => c.labels[0].textContent), ['Accessories', 'Drivetrain', 'Labour']);
  assert.ok(panel.getByRole('radio', { name: 'Any supplier' }).checked);
  assert.ok(panel.getByRole('radio', { name: 'Acme' }) !== null);
  fireEvent.click(panel.getByRole('checkbox', { name: 'Accessories' }));
  await panel.findByRole('checkbox', { name: 'Accessories', checked: true });
  assert.deepEqual(choiceCalls().at(-1).query.getAll('only'), ['Accessories']);
  fireEvent.click(panel.getByRole('checkbox', { name: 'Labour' }));
  await panel.findByRole('checkbox', { name: 'Labour', checked: true });
  assert.deepEqual(choiceCalls().at(-1).query.getAll('only'), ['Accessories', 'Labour']);
  fireEvent.click(panel.getByRole('radio', { name: 'Acme' }));
  await panel.findByRole('radio', { name: 'Acme', checked: true });
  assert.equal(choiceCalls().at(-1).query.get('supplier'), 'Acme');
});

test('Show report opens the changed report with its title, the line under it, graph, table and total row', async () => {
  const { ui, within, panel, fireEvent } = await openPanel();
  await panel.findByRole('radio', { name: 'Takings', checked: true });
  fireEvent.click(panel.getByRole('radio', { name: 'Items sold' }));
  await panel.findByRole('radio', { name: 'Items sold', checked: true });
  fireEvent.click(panel.getByRole('radio', { name: 'Product' }));
  await panel.findByRole('radio', { name: 'Product', checked: true });
  fireEvent.click(panel.getByRole('checkbox', { name: 'Accessories' }));
  await panel.findByRole('checkbox', { name: 'Accessories', checked: true });
  fireEvent.click(panel.getByRole('button', { name: 'Show report' }));
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'Sales: items sold by product' }) !== null);
  assert.equal(window.location.pathname, '/workshop/reports/changed');
  const search = new URLSearchParams(window.location.search);
  assert.deepEqual([search.get('base'), search.get('measure'), search.get('split'), search.get('period')], ['sales', 'items', 'product', 'this-week']);
  assert.deepEqual(search.getAll('only'), ['Accessories']);
  assert.ok(ui.queryByText('Changed from Sales · Accessories only · So far: Mon 14 – Thu 17 September, against the same days last week') !== null);
  const table = within(ui.getByRole('table', { name: 'Sales: items sold by product' }));
  assert.deepEqual(table.getAllByRole('columnheader').map((h) => h.textContent), ['Product', 'Items sold', 'Takings']);
  const rows = table.getAllByRole('row').map((r) => [...r.querySelectorAll('th,td')].map((c) => c.textContent));
  assert.deepEqual(rows[1], ['Water bottle', '3', '£17.67']);
  assert.deepEqual(rows.at(-1), ['Total, Accessories only', '5', '£29.67']);
  assert.ok(ui.getByRole('img', { name: /^Sales: items sold by product: most sold Water bottle; up 4 on the same days last week\. The figures are in the table below\.$/ }) !== null);
  assert.ok(ui.queryByRole('dialog', { name: 'Change what’s shown' }) === null, 'the panel closed');
});

test('the changed report says it has been changed, and goes back to Sales for the same period', async () => {
  const { ui } = await openReports('/workshop/reports/changed?base=sales&measure=items&split=product&only=Accessories&period=last-month', { answers: served() });
  await ui.findByRole('heading', { level: 2, name: 'Sales: items sold by product' });
  assert.ok(ui.queryByText('You’ve changed this report. Save it to come back to it.') !== null);
  assert.equal(ui.getByRole('link', { name: 'Back to Sales' }).getAttribute('href'), '/workshop/reports/sales?period=last-month');
  assert.equal(ui.getByRole('link', { name: 'All reports' }).getAttribute('href'), '/workshop/reports');
  assert.equal(reportCalls()[0].query.get('period'), 'last-month');
  assert.ok(ui.queryByRole('button', { name: 'Save as my report' }) === null, 'saving comes in the next pull request');
});

test('a changed Takings and cash-ups report goes back to Takings and cash-ups', async () => {
  const { ui } = await openReports('/workshop/reports/changed?base=takings&measure=takings&split=payment&period=this-week', { answers: served() });
  await ui.findByRole('heading', { level: 2 });
  assert.equal(ui.getByRole('link', { name: 'Back to Takings and cash-ups' }).getAttribute('href'), '/workshop/reports/takings?period=this-week');
});

test('a period chip asks for the same report on that period, and Change what\'s shown opens the panel on what is shown', async () => {
  const { ui, within, fireEvent } = await openReports('/workshop/reports/changed?base=sales&measure=items&split=product&only=Accessories&period=this-week', { answers: served() });
  await ui.findByRole('heading', { level: 2, name: 'Sales: items sold by product' });
  fireEvent.click(ui.getByRole('radio', { name: 'This month' }));
  await ui.findByRole('radio', { name: 'This month', checked: true });
  const last = reportCalls().at(-1).query;
  assert.deepEqual([last.get('period'), last.get('measure'), last.get('split'), last.getAll('only')[0]], ['this-month', 'items', 'product', 'Accessories']);
  fireEvent.click(ui.getByRole('button', { name: 'Change what’s shown' }));
  const panel = within(await ui.findByRole('dialog', { name: 'Change what’s shown' }));
  await panel.findByRole('radio', { name: 'Items sold', checked: true });
  assert.equal(choiceCalls().at(-1).query.get('measure'), 'items');
  assert.deepEqual(choiceCalls().at(-1).query.getAll('only'), ['Accessories']);
});

test('Cancel leaves the report as it was', async () => {
  const { ui, panel, fireEvent } = await openPanel();
  await panel.findByRole('radio', { name: 'Takings', checked: true });
  fireEvent.click(panel.getByRole('radio', { name: 'Items sold' }));
  fireEvent.click(panel.getByRole('button', { name: 'Cancel' }));
  assert.ok(ui.queryByRole('dialog', { name: 'Change what’s shown' }) === null);
  assert.equal(window.location.pathname, '/workshop/reports/sales');
  assert.equal(reportCalls().length, 0);
});

test('Download as spreadsheet asks for the same report as a file', async () => {
  const sent = [];
  const answers = served({ '/api/reports/changed.csv': (query) => { sent.push(query.toString()); return [200, 'a,b', { 'content-disposition': 'attachment; filename="sales-changed-x-2026-09-14-to-2026-09-17.csv"' }]; } });
  window.URL.createObjectURL = () => 'blob:x';
  window.URL.revokeObjectURL = () => {};
  const { ui, fireEvent } = await openReports('/workshop/reports/changed?base=sales&measure=items&split=product&only=Accessories&period=this-week', { answers });
  await ui.findByRole('heading', { level: 2, name: 'Sales: items sold by product' });
  fireEvent.click(ui.getByRole('button', { name: 'Download as spreadsheet' }));
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(sent.length, 1);
  assert.match(sent[0], /base=sales/);
  assert.match(sent[0], /measure=items/);
  assert.match(sent[0], /only=Accessories/);
});

test('a refusal from the server is shown in its own words', async () => {
  const answers = served({ '/api/reports/changed': () => [400, { error: NOT_BY_ITEM }] });
  const { ui } = await openReports('/workshop/reports/changed?base=sales&measure=items&split=payment&period=this-week', { answers });
  assert.ok(await ui.findByText(NOT_BY_ITEM) !== null);
  assert.ok(ui.queryByRole('table') === null);
});

test('with Show graphs off the changed report is the table alone', async () => {
  const { ui } = await openReports('/workshop/reports/changed?base=sales&measure=items&split=product&only=Accessories&period=this-week', { answers: served(), accessibility: { showGraphs: false } });
  await ui.findByRole('table', { name: 'Sales: items sold by product' });
  assert.ok(ui.queryByRole('img') === null);
});

test('Takings and cash-ups carries the button as Sales does', async () => {
  const { ui } = await openReports('/workshop/reports/takings', { answers: served() });
  await ui.findByRole('heading', { level: 2, name: 'Takings and cash-ups' });
  assert.ok(ui.getByRole('button', { name: 'Change what’s shown' }) !== null);
});
