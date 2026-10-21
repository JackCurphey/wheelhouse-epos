// The job page's "Change details" (Jack, 18 Oct,
// docs/decisions/2026-10-18-old-diary-features.md answer 3, and its tablet and
// phone section): the job's title, customer, bike, date, times and mechanic,
// changed after it is made, in a pop-up filled in from the job. Saving is
// PUT /api/workshop-jobs/:id with the version the pop-up opened with; the
// customer and bike go only when they change (a new customer always sends
// its bike, so it never keeps the old one's).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';
import { fakeJob } from '../helpers/fake-job.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const MECHANICS = [
  { id: 11, name: 'Alex Morgan', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true },
  { id: 12, name: 'Jo Taylor', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true },
];
const CUSTOMERS = [
  { id: 5, name: 'Maya Patel', phone: '[phone]', email: null },
  { id: 9, name: 'Oliver Chen', phone: null, email: null },
];
const BIKES = {
  5: [{ id: 7, make: 'Trek', model: 'Domane', colour: null }],
  9: [{ id: 30, make: 'Brompton', model: 'C Line', colour: null }],
};
let JOB;
function job(over) {
  return fakeJob({
    id: 1, title: 'Brake service', reference: 'WH-1001', customerId: 5, customerName: 'Maya Patel', bikeId: 7, bikeLabel: 'Trek Domane',
    mechanicId: 11, mechanicName: 'Alex Morgan', jobDate: '2026-10-06', startTime: '10:00', endTime: '11:00', status: 'scheduled',
    bookingState: 'scheduled', custodyState: 'expected', workState: 'not_started', version: 3, notes: null, requested: null,
    customerDescription: null, cancelledBy: null, cancelledAt: null, cancellationSeenAt: null, orderId: null, orderStatus: null, orderTotal: null,
    createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z', ...over,
  });
}

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let answer;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

function stubServer() {
  calls = [];
  answer = null;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ url, method, body: init.body ? JSON.parse(init.body) : undefined });
    const reply = (status, body) => ({ status, ok: status < 300, json: async () => body });
    const u = new URL(url, 'http://localhost');
    if (method !== 'GET') return answer ?? reply(200, { ...JOB, version: JOB.version + 1 });
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/employees') return reply(200, MECHANICS);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/workshop-waiting') return reply(200, { count: 0, items: [] });
    if (u.pathname === '/api/workshop-jobs') return reply(200, [JOB]);
    if (u.pathname === '/api/workshop-jobs/1') return reply(200, JOB);
    if (u.pathname === '/api/customers') {
      const q = (u.searchParams.get('search') ?? '').toLowerCase();
      return reply(200, CUSTOMERS.filter((c) => c.name.toLowerCase().includes(q)));
    }
    const one = u.pathname.match(/^\/api\/customers\/(\d+)$/);
    if (one) return reply(200, CUSTOMERS.find((c) => c.id === Number(one[1])));
    const bikes = u.pathname.match(/^\/api\/customers\/(\d+)\/bikes$/);
    if (bikes) return reply(200, BIKES[bikes[1]] ?? []);
    return reply(404, { error: 'Not found' });
  };
}

async function openChange(over = {}) {
  JOB = job(over);
  uninstall = installDom('http://localhost/workshop/diary?date=2026-10-05');
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  stubServer();
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  rtl.fireEvent.click((await ui.findAllByRole('button', { name: /^Trek Domane/ }))[0]);
  const page = rtl.within(await ui.findByRole('dialog', { name: new RegExp(JOB.title) }));
  return { ...rtl, ui, page };
}
const puts = () => calls.filter((c) => c.method === 'PUT').map((c) => c.body);
const has = (q) => Boolean(q);

test('Change details opens filled in; Save changes sends the changes with the version', async () => {
  const { ui, page, fireEvent, waitFor, within } = await openChange();
  fireEvent.click((await page.findAllByRole('button', { name: 'Change details' }))[0]);
  const dlg = within(await ui.findByRole('dialog', { name: 'Change details' }));
  assert.equal(dlg.getByLabelText('Job title').value, 'Brake service');
  assert.equal(dlg.getByLabelText('Date').value, '2026-10-06');
  assert.equal(dlg.getByLabelText('Start time').value, '10:00');
  assert.equal(dlg.getByLabelText('End time').value, '11:00');
  assert.equal(dlg.getByRole('radio', { name: 'Alex Morgan' }).getAttribute('aria-checked'), 'true');
  fireEvent.change(dlg.getByLabelText('Job title'), { target: { value: 'Brake bleed' } });
  fireEvent.change(dlg.getByLabelText('End time'), { target: { value: '12:00' } });
  fireEvent.click(dlg.getByRole('radio', { name: 'Jo Taylor' }));
  fireEvent.click(dlg.getByRole('button', { name: 'Save changes' }));
  // The customer and bike go only when they change (fresh review: a removed
  // bike or customer would otherwise refuse every save).
  await waitFor(() => assert.deepEqual(puts(), [{ title: 'Brake bleed', jobDate: '2026-10-06', startTime: '10:00', endTime: '12:00', mechanicId: 12, version: 3 }]));
  await waitFor(() => assert.equal(has(ui.queryByRole('dialog', { name: 'Change details' })), false));
});

test('Shared queue sends no mechanic', async () => {
  const { ui, page, fireEvent, waitFor, within } = await openChange();
  fireEvent.click((await page.findAllByRole('button', { name: 'Change details' }))[0]);
  const dlg = within(await ui.findByRole('dialog', { name: 'Change details' }));
  fireEvent.click(dlg.getByRole('radio', { name: 'Shared queue' }));
  fireEvent.click(dlg.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => assert.equal(puts()[0]?.mechanicId, null));
});

test('another customer brings their own bike, never the old one', async () => {
  const { ui, page, fireEvent, waitFor, within } = await openChange();
  fireEvent.click((await page.findAllByRole('button', { name: 'Change details' }))[0]);
  const dlg = within(await ui.findByRole('dialog', { name: 'Change details' }));
  fireEvent.click(dlg.getByRole('button', { name: 'Change customer' }));
  fireEvent.change(dlg.getByLabelText('Find customer by name, phone or email'), { target: { value: 'Oli' } });
  fireEvent.click(await dlg.findByRole('button', { name: /Oliver Chen/ }));
  await waitFor(() => assert.equal(dlg.getByLabelText('Bike').value, '30'));
  fireEvent.click(dlg.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => assert.deepEqual([puts()[0]?.customerId, puts()[0]?.bikeId], [9, 30]));
});

test('a refused change says why, and the pop-up stays open', async () => {
  const { ui, page, fireEvent, within } = await openChange();
  answer = { status: 400, ok: false, json: async () => ({ error: 'That mechanic is already booked over part of that window - please choose another time.' }) };
  fireEvent.click((await page.findAllByRole('button', { name: 'Change details' }))[0]);
  const dlg = within(await ui.findByRole('dialog', { name: 'Change details' }));
  fireEvent.click(dlg.getByRole('button', { name: 'Save changes' }));
  assert.ok(has(await dlg.findByText(/already booked over part of that window/)));
  assert.ok(has(ui.queryByRole('dialog', { name: 'Change details' })));
});

test('finished work offers no Change details', async () => {
  const { page } = await openChange({ workState: 'complete' });
  await page.findByText('WH-1001');
  assert.equal(page.queryAllByRole('button', { name: 'Change details' }).length, 0);
});

test('a job over several days changes its date and times in the diary, not here', async () => {
  const { ui, page, fireEvent, within, waitFor } = await openChange({
    parts: [
      { id: 21, position: 1, date: '2026-10-06', startTime: '10:00', endTime: '11:00', mechanicId: 11, mechanicName: 'Alex Morgan' },
      { id: 22, position: 2, date: '2026-10-07', startTime: '10:00', endTime: '11:00', mechanicId: 11, mechanicName: 'Alex Morgan' },
    ],
  });
  fireEvent.click((await page.findAllByRole('button', { name: 'Change details' }))[0]);
  const dlg = within(await ui.findByRole('dialog', { name: 'Change details' }));
  assert.equal(has(dlg.queryByLabelText('Date')), false);
  assert.ok(has(dlg.queryByText('Each day’s date and time, and the mechanic after day 1, are changed in the diary.')));
  assert.ok(has(dlg.queryByText('Mechanic, day 1')));
  fireEvent.click(dlg.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => assert.deepEqual(puts(), [{ title: 'Brake service', mechanicId: 11, version: 3 }]));
});

// Fresh review, 18 Oct.
test('a job with no set time sends empty times, which the server reads as none', async () => {
  const { ui, page, fireEvent, waitFor, within } = await openChange({ startTime: null, endTime: null });
  fireEvent.click((await page.findAllByRole('button', { name: 'Change details' }))[0]);
  const dlg = within(await ui.findByRole('dialog', { name: 'Change details' }));
  fireEvent.click(dlg.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => assert.deepEqual([puts()[0]?.startTime, puts()[0]?.endTime], ['', '']));
});

test('a refusal because someone else changed the job says so and reloads it', async () => {
  const { ui, page, fireEvent, within, waitFor } = await openChange();
  answer = { status: 409, ok: false, json: async () => ({ error: 'This job changed while you were looking at it. Reload and try again.', code: 'stale' }) };
  fireEvent.click((await page.findAllByRole('button', { name: 'Change details' }))[0]);
  const dlg = within(await ui.findByRole('dialog', { name: 'Change details' }));
  const gets = () => calls.filter((c) => c.url === '/api/workshop-jobs/1' && c.method === 'GET').length;
  const before = gets();
  // The page reloads the job at a newer version; the pop-up keeps the one it
  // opened with, so a second save can't overwrite what changed meanwhile.
  JOB = { ...JOB, version: 4 };
  fireEvent.click(dlg.getByRole('button', { name: 'Save changes' }));
  assert.ok(has(await dlg.findByText('This job changed while you were looking at it. Close this and open it again to see the latest.')));
  await waitFor(() => assert.ok(gets() > before));
  fireEvent.click(dlg.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => assert.equal(puts().length, 2));
  assert.deepEqual(puts().map((b) => b.version), [3, 3]);
});

test('Escape in the customer search closes its list, not the pop-up', async () => {
  const { ui, page, fireEvent, within } = await openChange();
  fireEvent.click((await page.findAllByRole('button', { name: 'Change details' }))[0]);
  const dlg = within(await ui.findByRole('dialog', { name: 'Change details' }));
  fireEvent.click(dlg.getByRole('button', { name: 'Change customer' }));
  const box = dlg.getByLabelText('Find customer by name, phone or email');
  assert.ok(box === box.ownerDocument.activeElement, 'the search takes the focus');
  fireEvent.change(box, { target: { value: 'Oli' } });
  await dlg.findByRole('button', { name: /Oliver Chen/ });
  fireEvent.keyDown(box, { key: 'Escape' });
  assert.equal(has(dlg.queryByRole('button', { name: /Oliver Chen/ })), false);
  assert.ok(has(ui.queryByRole('dialog', { name: 'Change details' })));
});

// Jack, 18 Oct: a waiting change request is noted at the top of Change
// details, as an addition; it is still answered from Waiting for you.
test('a waiting change request is noted at the top', async () => {
  const { ui, page, fireEvent, within } = await openChange({
    bookingState: 'reschedule_requested', customerName: 'Oliver Chen',
    requested: { jobDate: '2026-10-07', startTime: '14:00', endTime: '15:00', mechanicId: 11 },
  });
  fireEvent.click((await page.findAllByRole('button', { name: 'Change details' }))[0]);
  const dlg = within(await ui.findByRole('dialog', { name: 'Change details' }));
  const note = dlg.getByRole('note');
  assert.ok(has(within(note).queryByText('Change requested')));
  assert.ok(has(within(note).queryByText('Oliver Chen asked to move this to Wed 7 Oct, 14:00. Setting that time here accepts it; any other change leaves the request waiting in Waiting for you.')));
});

test('a request to another mechanic names them', async () => {
  const { ui, page, fireEvent, within } = await openChange({
    bookingState: 'reschedule_requested', customerName: 'Oliver Chen',
    requested: { jobDate: '2026-10-07', startTime: '14:00', endTime: '15:00', mechanicId: 12 },
  });
  fireEvent.click((await page.findAllByRole('button', { name: 'Change details' }))[0]);
  const dlg = within(await ui.findByRole('dialog', { name: 'Change details' }));
  assert.ok(has(within(dlg.getByRole('note')).queryByText(/to Wed 7 Oct, 14:00 with Jo Taylor\./)));
});

test('no request, no note', async () => {
  const { ui, page, fireEvent, within } = await openChange();
  fireEvent.click((await page.findAllByRole('button', { name: 'Change details' }))[0]);
  const dlg = within(await ui.findByRole('dialog', { name: 'Change details' }));
  assert.equal(has(dlg.queryByRole('note')), false);
});

test('a request for a drop-off day with no time asked for shows no note', async () => {
  const { ui, page, fireEvent, within } = await openChange({
    bookingState: 'reschedule_requested', customerName: 'Oliver Chen',
    requested: { jobDate: '2026-10-07', startTime: '', endTime: '', mechanicId: 11 },
  });
  fireEvent.click((await page.findAllByRole('button', { name: 'Change details' }))[0]);
  const dlg = within(await ui.findByRole('dialog', { name: 'Change details' }));
  await dlg.findByLabelText('Job title');
  assert.equal(has(dlg.queryByRole('note')), false);
});

test('on a job over several days the note says to answer it from Waiting for you', async () => {
  const { ui, page, fireEvent, within } = await openChange({
    bookingState: 'reschedule_requested', customerName: 'Oliver Chen',
    requested: { jobDate: '2026-10-07', startTime: '14:00', endTime: '15:00', mechanicId: 11 },
    parts: [
      { id: 21, position: 1, date: '2026-10-06', startTime: '10:00', endTime: '11:00', mechanicId: 11, mechanicName: 'Alex Morgan' },
      { id: 22, position: 2, date: '2026-10-07', startTime: '10:00', endTime: '11:00', mechanicId: 11, mechanicName: 'Alex Morgan' },
    ],
  });
  fireEvent.click((await page.findAllByRole('button', { name: 'Change details' }))[0]);
  const dlg = within(await ui.findByRole('dialog', { name: 'Change details' }));
  assert.ok(has(within(dlg.getByRole('note')).queryByText('Oliver Chen asked to move this to Wed 7 Oct, 14:00. Answer it from Waiting for you.')));
});
