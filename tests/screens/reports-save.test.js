// Save as my report, and Your reports on the Reports page (openspec/changes/reports-your-own,
// group 2; drawn as rp-save, rp-save-taken and rp-home in generator/reports.mjs; decisions 7 to 9).
// The answers are the shapes server/lib/saved-reports.js sends; tests/saved-reports.test.js proves
// the server sends them, these prove the screen reads them.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openReports, closeReports, HOME, calls } from '../helpers/reports-screen.js';

afterEach(closeReports);

const TAKEN = 'You already have a report with this name. Choose another name.';
const NO_MANAGERS = 'there are no managers until staff roles are set up';
const PERIOD = { period: 'this-week', from: '2026-09-14', to: '2026-09-20', through: '2026-09-17', soFar: true, unit: 'day', label: 'So far: Mon 14 – Thu 17 September', against: 'the same days last week' };
const CHANGED = {
  base: 'sales', baseLabel: 'Sales', measure: 'items', split: 'product', only: ['Accessories'], supplier: '',
  title: 'Sales: items sold by product', line: 'Changed from Sales · Accessories only · So far: Mon 14 – Thu 17 September, against the same days last week',
  period: PERIOD, columns: ['Product', 'Items sold', 'Takings'],
  rows: [{ key: 'p1', label: 'Water bottle', value: 3, takingsPence: 1767, beforeValue: 1 }],
  total: { label: 'Total, Accessories only', value: 3, takingsPence: 1767 }, figures: { value: 3, beforeValue: 1, diffValue: 2 },
  showBefore: true, empty: false, nothingBefore: false, firstSaleOn: '2026-08-20', shopLine: 'North Street Cycles, Bolton', today: '2026-09-17',
  choices: { measure: [], split: [], only: [], suppliers: [] },
};
const ADDRESS = '/workshop/reports/changed?base=sales&measure=items&split=product&only=Accessories&period=this-week';
const saveCalls = () => calls.filter((c) => c.path === '/api/reports/saved' && c.method === 'POST');
const served = (extra = {}) => ({ '/api/reports/changed': () => [200, CHANGED], '/api/reports/home': () => [200, HOME], '/api/reports/saved': () => [200, { reports: [] }], ...extra });

async function openSave(answers = served()) {
  const opened = await openReports(ADDRESS, { answers });
  const { ui, within, fireEvent } = opened;
  await ui.findByRole('heading', { level: 2, name: 'Sales: items sold by product' });
  fireEvent.click(ui.getByRole('button', { name: 'Save as my report' }));
  const dialog = within(await ui.findByRole('dialog', { name: 'Save as my report' }));
  return { ...opened, dialog };
}

test('the changed report\'s bar has Save as my report beside Back to Sales', async () => {
  const { ui } = await openReports(ADDRESS, { answers: served() });
  await ui.findByRole('heading', { level: 2, name: 'Sales: items sold by product' });
  assert.ok(ui.queryByText('You’ve changed this report. Save it to come back to it.') !== null);
  assert.ok(ui.getByRole('button', { name: 'Save as my report' }) !== null);
  assert.ok(ui.getByRole('link', { name: 'Back to Sales' }) !== null);
});

test('the save popup says what the report is, asks for a name, and has Just me chosen with sharing greyed', async () => {
  const { dialog } = await openSave();
  assert.ok(dialog.queryByText('Sales: items sold by product · Accessories only') !== null);
  assert.ok(dialog.getByLabelText('Name (needed)') !== null);
  assert.equal(dialog.getByRole('radio', { name: 'Just me' }).checked, true);
  const managers = dialog.getByRole('radio', { name: 'Me and the other managers' });
  assert.equal(managers.getAttribute('aria-disabled'), 'true');
  assert.equal(managers.getAttribute('aria-description'), NO_MANAGERS);
  assert.ok(dialog.queryByText(`Me and the other managers: ${NO_MANAGERS}`) !== null);
  assert.ok(dialog.queryByText('It opens on the latest period each time, under “Your reports”.') !== null);
});

test('Save sends the name and the choices, with the kind of period and nobody else to share with', async () => {
  const answers = served({ '/api/reports/saved': (query, method) => (method === 'POST' ? [201, { id: 7, name: 'Bottles' }] : [200, { reports: [] }]) });
  const { ui, dialog, fireEvent } = await openSave(answers);
  fireEvent.change(dialog.getByLabelText('Name (needed)'), { target: { value: '  Bottles  ' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  await ui.findByText('Saved as “Bottles”. It is in Your reports on the Reports page.');
  assert.deepEqual(saveCalls()[0].body, {
    name: 'Bottles', base: 'sales', measure: 'items', split: 'product', only: ['Accessories'], supplier: '', period: 'this-week', shared: false,
  });
  assert.ok(ui.queryByRole('dialog', { name: 'Save as my report' }) === null);
});

test('no name is refused beside the field, and nothing is sent', async () => {
  const { dialog, fireEvent } = await openSave();
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  assert.ok(dialog.queryByText('Type its name') !== null);
  assert.equal(dialog.getByLabelText('Name (needed)').getAttribute('aria-invalid'), 'true');
  assert.equal(saveCalls().length, 0);
});

test('a name already used is refused in the server\'s words, the popup stays and what was typed stays', async () => {
  const answers = served({ '/api/reports/saved': (query, method) => (method === 'POST' ? [400, { error: TAKEN }] : [200, { reports: [] }]) });
  const { ui, dialog, fireEvent } = await openSave(answers);
  fireEvent.change(dialog.getByLabelText('Name (needed)'), { target: { value: 'Bottles' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  assert.ok(await dialog.findByText(TAKEN) !== null);
  assert.equal(dialog.getByLabelText('Name (needed)').value, 'Bottles');
  assert.equal(dialog.getByLabelText('Name (needed)').getAttribute('aria-invalid'), 'true');
  assert.ok(ui.queryByRole('dialog', { name: 'Save as my report' }) !== null);
});

test('Cancel closes the popup and saves nothing', async () => {
  const { ui, dialog, fireEvent } = await openSave();
  fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
  assert.ok(ui.queryByRole('dialog', { name: 'Save as my report' }) === null);
  assert.equal(saveCalls().length, 0);
});

test('Your reports says how to start when there are none', async () => {
  const { ui, within } = await openReports('/workshop/reports', { answers: served() });
  const box = within(await ui.findByRole('region', { name: 'Your reports' }));
  assert.ok(await box.findByText('Start from any report, choose “Change what’s shown”, then “Save as my report”.') !== null);
});

test('Your reports lists each saved report with what it is and who can see it, and opens it on the latest period', async () => {
  const reports = [
    { id: 1, name: 'Bottles', base: 'sales', measure: 'items', split: 'product', only: ['Accessories'], supplier: '', period: 'this-week', opensOn: 'this-week', shared: false, what: 'Sales: items sold by product · Accessories only' },
    { id: 2, name: 'Last month by staff', base: 'takings', measure: 'takings', split: 'staff', only: [], supplier: 'Acme', period: 'last-month', opensOn: 'last-month', shared: false, what: 'Takings and cash-ups: takings by staff member · Acme only' },
    { id: 3, name: 'Picked', base: 'sales', measure: 'takings', split: 'day', only: [], supplier: '', period: 'dates', opensOn: 'this-week', shared: false, what: 'Sales: takings by day' },
  ];
  const { ui, within } = await openReports('/workshop/reports', { answers: served({ '/api/reports/saved': () => [200, { reports }] }) });
  const box = within(await ui.findByRole('region', { name: 'Your reports' }));
  const first = await box.findByRole('link', { name: /Bottles/ });
  assert.equal(first.getAttribute('href'), '/workshop/reports/changed?base=sales&measure=items&split=product&only=Accessories&period=this-week');
  assert.ok(within(first).queryByText('Sales: items sold by product · Accessories only') !== null);
  assert.ok(within(first).queryByText('Just you') !== null);
  assert.equal(box.getByRole('link', { name: /Last month by staff/ }).getAttribute('href'), '/workshop/reports/changed?base=takings&measure=takings&split=staff&supplier=Acme&period=last-month');
  assert.equal(box.getByRole('link', { name: /Picked/ }).getAttribute('href'), '/workshop/reports/changed?base=sales&measure=takings&split=day&period=this-week', 'Pick dates opens on the first period');
  assert.ok(box.queryByText('Start from any report, choose “Change what’s shown”, then “Save as my report”.') === null);
});
