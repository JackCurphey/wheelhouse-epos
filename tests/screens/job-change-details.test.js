// The job page's "Change details" (Jack, 18 Oct,
// docs/decisions/2026-10-18-old-diary-features.md answer 3, and its tablet and
// phone section): the job's title, customer, bike, date, times and mechanic,
// changed after it is made, in a pop-up filled in from the job. Saving is
// PUT /api/workshop-jobs/:id with every field and the version the page saw
// (the bike always, so a new customer never keeps the old one's bike).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

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
  return {
    id: 1, title: 'Brake service', reference: 'WH-1001', customerId: 5, customerName: 'Maya Patel', bikeId: 7, bikeLabel: 'Trek Domane',
    mechanicId: 11, mechanicName: 'Alex Morgan', jobDate: '2026-10-06', startTime: '10:00', endTime: '11:00', status: 'scheduled',
    bookingState: 'scheduled', custodyState: 'expected', workState: 'not_started', version: 3, notes: null, requested: null,
    customerDescription: null, cancelledBy: null, cancelledAt: null, cancellationSeenAt: null, orderId: null, orderStatus: null, orderTotal: null,
    createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z', ...over,
  };
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

test('Change details opens filled in; Save changes sends every field with the version', async () => {
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
  await waitFor(() => assert.deepEqual(puts(), [{ title: 'Brake bleed', customerId: 5, bikeId: 7, jobDate: '2026-10-06', startTime: '10:00', endTime: '12:00', mechanicId: 12, version: 3 }]));
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
  const { ui, page, fireEvent, within } = await openChange({
    parts: [
      { id: 21, position: 1, date: '2026-10-06', startTime: '10:00', endTime: '11:00', mechanicId: 11, mechanicName: 'Alex Morgan' },
      { id: 22, position: 2, date: '2026-10-07', startTime: '10:00', endTime: '11:00', mechanicId: 11, mechanicName: 'Alex Morgan' },
    ],
  });
  fireEvent.click((await page.findAllByRole('button', { name: 'Change details' }))[0]);
  const dlg = within(await ui.findByRole('dialog', { name: 'Change details' }));
  assert.equal(has(dlg.queryByLabelText('Date')), false);
  assert.ok(has(dlg.queryByText('Each day’s date and time are changed in the diary.')));
});
