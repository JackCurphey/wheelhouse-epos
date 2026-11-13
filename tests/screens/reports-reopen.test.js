// Reopen this day, and a reopened day left out and said so (openspec/changes/reports-accounts-and-reopen,
// reports spec; drawn as rp-reopen and rp-takings-reopened in generator/reports.mjs; Jack's answers of 12 Nov).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openReports, closeReports, TAKINGS_WEEK, TUESDAY_CLOSE, calls } from '../helpers/reports-screen.js';

afterEach(closeReports);

const REOPENED = { day: '2026-09-16', label: 'Wed 16 Sep', reason: 'a card payment was counted as cash', reopenedByName: 'Jack Lewis' };
const served = ({ canReopen = true, takings = TAKINGS_WEEK, extra = {} } = {}) => ({
  '/api/reports/takings': () => [200, takings],
  '/api/reports/days/30': () => [200, { ...TUESDAY_CLOSE, canReopen }],
  ...extra,
});
const reopenPosts = () => calls.filter((c) => c.path === '/api/reports/days/30/reopen');

async function openDay(options) {
  const opened = await openReports('/workshop/reports/takings?day=30', { answers: served(options) });
  const box = opened.within(await opened.ui.findByRole('dialog', { name: 'Tue 15 September' }));
  return { ...opened, box };
}

test('the latest closed day\'s report has Reopen this day, and an earlier day\'s has none', async () => {
  const yes = await openDay();
  assert.ok(yes.box.queryByRole('button', { name: 'Reopen this day' }) !== null);
  await closeReports();
  const no = await openDay({ canReopen: false });
  assert.ok(no.box.queryByRole('button', { name: 'Reopen this day' }) === null);
  assert.ok(no.box.queryByRole('button', { name: 'Print' }) !== null);
});

test('Reopen this day asks why, stays off until a reason is typed, and Keep it closed leaves it', async () => {
  const { ui, within, box, fireEvent } = await openDay();
  fireEvent.click(box.getByRole('button', { name: 'Reopen this day' }));
  const dialog = within(await ui.findByRole('dialog', { name: 'Reopen Tue 15 September?' }));
  assert.ok(dialog.queryByText('Its figures come out of the reports until it’s closed again') !== null);
  assert.ok(dialog.getByLabelText('Why are you reopening it? (needed)') !== null);
  assert.ok(dialog.queryByText('Saved with your name and the time. The day goes back to Needs attention, and what was sent to Xero is corrected when it’s closed again.') !== null);
  const go = dialog.getByRole('button', { name: 'Reopen the day' });
  assert.equal(go.getAttribute('aria-disabled'), 'true');
  fireEvent.click(go);
  assert.equal(reopenPosts().length, 0, 'off with no reason');
  fireEvent.change(dialog.getByLabelText('Why are you reopening it? (needed)'), { target: { value: '   ' } });
  assert.equal(dialog.getByRole('button', { name: 'Reopen the day' }).getAttribute('aria-disabled'), 'true', 'spaces are not a reason');
  fireEvent.click(dialog.getByRole('button', { name: 'Keep it closed' }));
  assert.ok(ui.queryByRole('dialog', { name: 'Reopen Tue 15 September?' }) === null);
  assert.equal(reopenPosts().length, 0);
});

test('Reopen the day sends the reason, closes the report, and Takings shows the day left out with Close the day', async () => {
  let reopened = false;
  const answers = served({ extra: {
    '/api/reports/days/30/reopen': () => { reopened = true; return [200, { reopened: { id: 30, day: '2026-09-15', reason: 'x', reopenedByName: 'Jack Lewis', reopenedAt: '2026-09-17T10:00:00Z' } }]; },
  } });
  answers['/api/reports/takings'] = () => [200, reopened ? { ...TAKINGS_WEEK, reopened: { ...REOPENED, day: '2026-09-15', label: 'Tue 15 Sep' } } : TAKINGS_WEEK];
  const opened = await openReports('/workshop/reports/takings?day=30', { answers });
  const { ui, within, fireEvent } = opened;
  const box = within(await ui.findByRole('dialog', { name: 'Tue 15 September' }));
  fireEvent.click(box.getByRole('button', { name: 'Reopen this day' }));
  const dialog = within(await ui.findByRole('dialog', { name: 'Reopen Tue 15 September?' }));
  fireEvent.change(dialog.getByLabelText('Why are you reopening it? (needed)'), { target: { value: '  a card payment was counted as cash ' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Reopen the day' }));
  await ui.findByText('Tue 15 Sep is reopened — its figures are left out until it’s closed again');
  assert.deepEqual(reopenPosts()[0].body, { reason: 'a card payment was counted as cash' });
  await opened.waitFor(() => assert.ok(ui.queryByRole('dialog', { name: 'Tue 15 September' }) === null, 'the report is closed'));
  const bar = ui.getByText('Tue 15 Sep is reopened — its figures are left out until it’s closed again').closest('[role="status"]');
  assert.equal(within(bar).getByRole('link', { name: 'Close the day' }).getAttribute('href'), '/workshop/till/close?day=2026-09-15');
});

test('the server\'s refusal is shown in the reopen box, which stays open', async () => {
  const answers = served({ extra: { '/api/reports/days/30/reopen': () => [409, { error: 'Only the latest closed day can be reopened', code: 'not_latest' }] } });
  const { ui, within, fireEvent } = await openReports('/workshop/reports/takings?day=30', { answers });
  const box = within(await ui.findByRole('dialog', { name: 'Tue 15 September' }));
  fireEvent.click(box.getByRole('button', { name: 'Reopen this day' }));
  const dialog = within(await ui.findByRole('dialog', { name: 'Reopen Tue 15 September?' }));
  fireEvent.change(dialog.getByLabelText('Why are you reopening it? (needed)'), { target: { value: 'why not' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Reopen the day' }));
  assert.ok(await dialog.findByText('Only the latest closed day can be reopened') !== null);
  assert.ok(ui.queryByRole('dialog', { name: 'Reopen Tue 15 September?' }) !== null);
});

test('a reopened day keeps its row with the figures it was closed with, marked Reopened, and its report opens', async () => {
  const takings = { ...TAKINGS_WEEK, reopened: REOPENED, rows: [
    ...TAKINGS_WEEK.rows.filter((r) => !r.key.startsWith('2026-09-15')),
    { kind: 'day', key: '2026-09-15', label: 'Tue 15 Sep', closed: true, reopened: true, closeId: 30, takingsPence: 30000, bankedPence: 11500, differencePence: -500, closedByName: 'Jack Lewis', closedAt: '2026-09-15T16:30:00Z' },
    { kind: 'online', key: '2026-09-15', label: 'Tue 15 Sep · Online', onlinePence: 2500 },
  ] };
  const { ui, within, fireEvent } = await openReports('/workshop/reports/takings', { answers: served({ takings, canReopen: false }) });
  await ui.findByText('Wed 16 Sep is reopened — its figures are left out until it’s closed again');
  const table = within(ui.getByRole('table'));
  const row = table.getByRole('button', { name: /^Tue 15 Sep/ }).closest('tr');
  assert.deepEqual([...row.querySelectorAll('th,td')].map((c) => c.textContent), ['Tue 15 Sep›', '£300.00', '£115.00', '−£5.00 short', 'Jack Lewis · Reopened']);
  assert.ok(table.queryByText('Tue 15 Sep · Online') !== null, 'its Online row stays');
  fireEvent.click(table.getByRole('button', { name: /^Tue 15 Sep/ }));
  const box = within(await ui.findByRole('dialog', { name: 'Tue 15 September' }));
  assert.ok(box.queryByRole('button', { name: 'Reopen this day' }) === null, 'it is already reopened');
});

test('without a reopened day there is no bar', async () => {
  const { ui } = await openReports('/workshop/reports/takings', { answers: served() });
  await ui.findByRole('heading', { level: 2, name: 'Takings and cash-ups' });
  assert.ok(ui.queryByText(/is reopened/) === null);
});
