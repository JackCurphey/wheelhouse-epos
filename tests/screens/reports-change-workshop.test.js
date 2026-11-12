// Change what's shown on Workshop (openspec/changes/reports-your-own, group 4; decision 2).
// The answers are the shapes server/lib/report-changed.js sends for the workshop;
// tests/report-changed-workshop.test.js proves the server sends them.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openReports, closeReports, calls } from '../helpers/reports-screen.js';

afterEach(closeReports);

const SALES_ONLY = 'sales only — choose it from the Sales report';
const NOT_BY_PRODUCT = 'jobs aren’t split by product';
const PERIOD = { period: 'this-week', from: '2026-09-14', to: '2026-09-20', through: '2026-09-17', soFar: true, unit: 'day', label: 'So far: Mon 14 – Thu 17 September', against: 'the same days last week' };

function choices(query) {
  const measure = query.get('measure') || 'jobs';
  const split = query.get('split') || 'day';
  const grey = (value, label, why) => ({ value, label, why });
  return {
    base: 'workshop',
    selection: { measure, split, only: query.getAll('only'), supplier: '' },
    choices: {
      measure: [grey('takings', 'Takings', SALES_ONLY), grey('items', 'Items sold', SALES_ONLY), grey('margin', 'Margin', SALES_ONLY), { value: 'jobs', label: 'Jobs' }, { value: 'hours', label: 'Hours' }],
      split: [
        { value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, grey('category', 'Category', NOT_BY_PRODUCT), grey('product', 'Product', NOT_BY_PRODUCT),
        { value: 'staff', label: 'Staff member' }, { value: 'service', label: 'Service' }, grey('shop', 'Shop', 'one shop until a second one is added'), grey('payment', 'Payment type', SALES_ONLY),
      ],
      only: [{ value: 'Repairs', label: 'Repairs' }, { value: 'Servicing', label: 'Servicing' }],
      suppliers: [],
    },
  };
}
const HOURS = {
  base: 'workshop', baseLabel: 'Workshop', measure: 'hours', split: 'staff', only: ['Repairs'], supplier: '',
  title: 'Workshop: hours by staff member', what: 'Workshop: hours by staff member · Repairs only',
  line: 'Changed from Workshop · Repairs only · So far: Mon 14 – Thu 17 September, against the same days last week',
  period: PERIOD, columns: ['Staff member', 'Hours'],
  rows: [{ key: '1', label: 'Mia', value: 3, takingsPence: 0, beforeValue: 1 }, { key: '2', label: 'Noah', value: 1.5, takingsPence: 0, beforeValue: 0 }],
  total: { label: 'Total, Repairs only', value: 4.5, takingsPence: 0 }, figures: { value: 4.5, beforeValue: 1, diffValue: 3.5 },
  showBefore: true, empty: false, nothingBefore: false, firstSaleOn: '2026-08-20', shopLine: 'North Street Cycles, Bolton', today: '2026-09-17',
  choices: choices(new URLSearchParams('measure=hours&split=staff&only=Repairs')).choices,
};
const WORKSHOP = { period: PERIOD, before: { from: '2026-09-07', to: '2026-09-10' }, figures: { bookedIn: { count: 0, beforeCount: 0, diff: 0 }, finished: { count: 0, beforeCount: 0, diff: 0 }, collected: { count: 0, beforeCount: 0, diff: 0 }, bookedInToReady: { days: null, beforeDays: null, diff: null } }, columns: { now: 'This week so far', before: 'Same days last week' }, rows: [], takings: { labour: { pence: 0, beforePence: 0 }, parts: { pence: 0, beforePence: 0 }, total: { pence: 0, beforePence: 0 } }, quotes: { approved: { count: 0, beforeCount: 0 }, declined: { count: 0, beforeCount: 0 }, noAnswer: { count: 0, beforeCount: 0 } }, mechanics: [], sharedQueue: { bookedHours: 0 }, shopLine: 'North Street Cycles, Bolton', today: '2026-09-17' };
const served = (extra = {}) => ({
  '/api/reports/workshop': () => [200, WORKSHOP],
  '/api/reports/changed/choices': (query) => [200, choices(query)],
  '/api/reports/changed': () => [200, HOURS],
  '/api/reports/saved': (query, method) => (method === 'POST' ? [201, { id: 1, name: 'Hours' }] : [200, { reports: [] }]),
  ...extra,
});

async function openPanel() {
  const opened = await openReports('/workshop/reports/workshop', { answers: served() });
  const { ui, within, fireEvent } = opened;
  await ui.findByRole('heading', { level: 2, name: 'Workshop' });
  fireEvent.click(ui.getByRole('button', { name: 'Change what’s shown' }));
  const panel = within(await ui.findByRole('dialog', { name: 'Change what’s shown' }));
  await panel.findByRole('radio', { name: 'Jobs', checked: true });
  return { ...opened, panel };
}

test('Workshop has Change what\'s shown, which opens on Jobs by Day with the period under its title', async () => {
  const { panel } = await openPanel();
  assert.ok(panel.queryByText('Workshop · this week so far') !== null);
  assert.ok(panel.getByRole('radio', { name: 'Day' }).checked);
  const first = calls.find((c) => c.path === '/api/reports/changed/choices');
  assert.equal(first.query.get('base'), 'workshop');
});

test('the sales measures are greyed with their reason, and Service is a split', async () => {
  const { panel } = await openPanel();
  for (const name of ['Takings', 'Items sold', 'Margin']) {
    const chip = panel.getByRole('radio', { name });
    assert.equal(chip.getAttribute('aria-disabled'), 'true', name);
    assert.equal(chip.getAttribute('aria-description'), SALES_ONLY, name);
  }
  assert.ok(panel.getByRole('radio', { name: 'Hours' }).getAttribute('aria-disabled') === null);
  assert.ok(panel.getByRole('radio', { name: 'Service' }) !== null);
  assert.equal(panel.getByRole('radio', { name: 'Product' }).getAttribute('aria-description'), NOT_BY_PRODUCT);
});

test('Only lists the service categories and there is no Supplier', async () => {
  const { panel } = await openPanel();
  assert.deepEqual(panel.getAllByRole('checkbox').map((c) => c.labels[0].textContent), ['Repairs', 'Servicing']);
  assert.ok(panel.queryByText('Supplier') === null);
  assert.ok(panel.queryByRole('radio', { name: 'Any supplier' }) === null);
});

test('Show report opens the changed Workshop report with hours as plain numbers, and goes back to Workshop', async () => {
  const { ui, within, panel, fireEvent } = await openPanel();
  fireEvent.click(panel.getByRole('radio', { name: 'Hours' }));
  await panel.findByRole('radio', { name: 'Hours', checked: true });
  fireEvent.click(panel.getByRole('radio', { name: 'Staff member' }));
  await panel.findByRole('radio', { name: 'Staff member', checked: true });
  fireEvent.click(panel.getByRole('checkbox', { name: 'Repairs' }));
  await panel.findByRole('checkbox', { name: 'Repairs', checked: true });
  fireEvent.click(panel.getByRole('button', { name: 'Show report' }));
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'Workshop: hours by staff member' }) !== null);
  const search = new URLSearchParams(window.location.search);
  assert.deepEqual([search.get('base'), search.get('measure'), search.get('split')], ['workshop', 'hours', 'staff']);
  const table = within(ui.getByRole('table', { name: 'Hours by staff member' }));
  assert.deepEqual(table.getAllByRole('columnheader').map((h) => h.textContent), ['Staff member', 'Hours']);
  const rows = table.getAllByRole('row').map((r) => [...r.querySelectorAll('th,td')].map((c) => c.textContent));
  assert.deepEqual(rows[1], ['Mia', '3']);
  assert.deepEqual(rows[2], ['Noah', '1.5']);
  assert.deepEqual(rows.at(-1), ['Total, Repairs only', '4.5']);
  assert.ok(ui.getByRole('img', { name: /^Hours by staff member: most hours Mia; up 3\.5 on the same days last week\. The figures are in the table below\.$/ }) !== null);
  assert.equal(ui.getByRole('link', { name: 'Back to Workshop' }).getAttribute('href'), '/workshop/reports/workshop?period=this-week');
});

test('a changed Workshop report can be saved as a Workshop report, and opens from Your reports', async () => {
  const { ui, within, fireEvent } = await openReports('/workshop/reports/changed?base=workshop&measure=hours&split=staff&only=Repairs&period=this-week', { answers: served() });
  await ui.findByRole('heading', { level: 2, name: 'Workshop: hours by staff member' });
  fireEvent.click(ui.getByRole('button', { name: 'Save as my report' }));
  const dialog = within(await ui.findByRole('dialog', { name: 'Save as my report' }));
  assert.ok(dialog.queryByText('Workshop: hours by staff member · Repairs only') !== null);
  fireEvent.change(dialog.getByLabelText('Name (needed)'), { target: { value: 'Hours' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  await ui.findByText('Saved as “Hours”. It is in Your reports on the Reports page.');
  const sent = calls.find((c) => c.method === 'POST').body;
  assert.deepEqual([sent.base, sent.measure, sent.split, sent.only], ['workshop', 'hours', 'staff', ['Repairs']]);
});

test('Your reports opens a saved Workshop report on the Workshop report\'s changed address', async () => {
  const saved = { id: 5, name: 'Jobs by service', base: 'workshop', measure: 'jobs', split: 'service', only: ['Repairs'], supplier: '', period: 'last-month', opensOn: 'last-month', shared: false, what: 'Workshop: jobs by service · Repairs only' };
  const answers = served({ '/api/reports/home': () => [200, { today: '2026-09-17', dateLine: 'Thursday 17 September', shopLine: 'North Street Cycles, Bolton', strip: { heading: 'So far', takingsPence: 0 } }], '/api/reports/saved': () => [200, { reports: [saved] }] });
  const { ui, within } = await openReports('/workshop/reports', { answers });
  const box = within(await ui.findByRole('region', { name: 'Your reports' }));
  const link = await box.findByRole('link', { name: /Jobs by service/ });
  assert.equal(link.getAttribute('href'), '/workshop/reports/changed?base=workshop&measure=jobs&split=service&only=Repairs&period=last-month');
});
