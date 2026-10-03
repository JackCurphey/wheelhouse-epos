// The staff diary, piece 5: New job (journey 12 decisions 16, 18, 22, 50, 66;
// drawn as new-job-pick, new-job and new-job-day in
// docs/design/user-journeys/generator/diary.mjs). New job puts the diary in
// "choose a time"; a click on the grid opens the form at that time, with the
// mechanic chosen for you. Only what the server saves is on the form.
// Spec: docs/superpowers/specs/2026-10-03-staff-diary-view-design.md (piece 5)
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const MECHANICS = [
  { id: 11, name: 'Alex Morgan', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true },
  { id: 12, name: 'Jo Taylor', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true },
];
const SERVICES = [
  { id: 1, name: 'Standard service', price: 60, minutes: 90, active: true, kind: 'full', categoryId: null, position: 1 },
  { id: 2, name: 'Brake adjust', price: 15, minutes: 30, active: true, kind: 'individual', categoryId: null, position: 2 },
  { id: 3, name: 'Old thing', price: 5, minutes: 15, active: false, kind: 'individual', categoryId: null, position: 3 },
];
const CUSTOMERS = [{ id: 5, name: 'Maya Patel', email: 'maya@example.test', phone: '07700 900142', active: true }];
const BIKES = [{ id: 7, customerId: 5, make: 'Trek', model: 'Domane AL 3', colour: 'green', active: true }];
// Alex already has two hours on Tuesday; Jo has none, so Jo is chosen.
const JOBS = [{
  id: 1, title: 'Full service', reference: 'WH-1001', customerId: 5, customerName: 'Maya Patel', bikeId: 7, bikeLabel: 'Trek Domane AL 3',
  mechanicId: 11, mechanicName: 'Alex Morgan', jobDate: '2026-10-06', startTime: '13:00', endTime: '15:00', status: 'scheduled',
  bookingState: 'scheduled', custodyState: 'expected', workState: 'not_started', version: 1, notes: null, requested: null,
  cancelledBy: null, cancelledAt: null, cancellationSeenAt: null, orderId: null, orderStatus: null, orderTotal: null,
  createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z',
}];

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
    if (method === 'POST' && u.pathname === '/api/workshop-jobs') return answer ?? reply(201, { ...JOBS[0], id: 50, version: 1 });
    if (method === 'POST') return reply(200, { ...JOBS[0], id: 50, version: 2 });
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/employees') return reply(200, MECHANICS);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/workshop-waiting') return reply(200, { count: 0, items: [] });
    if (u.pathname === '/api/workshop-jobs') return reply(200, JOBS);
    if (u.pathname === '/api/workshop-services') return reply(200, SERVICES);
    if (u.pathname === '/api/customers') return reply(200, CUSTOMERS.filter((c) => c.name.toLowerCase().includes((u.searchParams.get('search') || '').toLowerCase())));
    if (u.pathname === '/api/customers/5/bikes') return reply(200, BIKES);
    return reply(404, { error: 'Not found' });
  };
}

async function openDiary() {
  uninstall = installDom('http://localhost/workshop/diary?date=2026-10-05');
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  stubServer();
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByText('Trek Domane AL 3');
  return { ...rtl, ui };
}

// New job, then click Tuesday at 10:00 (the grid starts at 09:00; 29px a half hour).
async function pickTuesdayTen(r) {
  r.fireEvent.click(r.ui.getByRole('button', { name: 'New job' }));
  assert.ok(Boolean(r.ui.queryByText('Choose a time for the new job.')));
  r.fireEvent.click(r.ui.getByRole('group', { name: 'Tuesday 6 October' }), { clientY: 58 });
  return r.within(await r.ui.findByRole('dialog', { name: 'New job' }));
}

const posts = () => calls.filter((c) => c.method === 'POST').map((c) => `${c.url} ${JSON.stringify(c.body)}`);
const has = (q) => Boolean(q);

test('New job asks for a time; Cancel leaves the diary as it was', async () => {
  const r = await openDiary();
  r.fireEvent.click(r.ui.getByRole('button', { name: 'New job' }));
  assert.equal(r.ui.getByRole('button', { name: 'Choose a time' }).getAttribute('aria-pressed'), 'true');
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Cancel' }));
  assert.ok(has(r.ui.queryByRole('button', { name: 'New job' })));
  assert.equal(has(r.ui.queryByRole('dialog')), false);
});

test('a click on the grid opens the form at that time, with the mechanic with most free time chosen', async () => {
  const r = await openDiary();
  const form = await pickTuesdayTen(r);
  assert.ok(has(form.queryByText('Tue 6 Oct · 10:00 · Jo Taylor')));
  assert.equal(form.getByRole('radio', { name: 'Jo Taylor' }).getAttribute('aria-checked'), 'true');
});

test('choosing work fills the job title and its length; only active services are offered', async () => {
  const r = await openDiary();
  const form = await pickTuesdayTen(r);
  r.fireEvent.click(await form.findByRole('radio', { name: 'Full service' }));
  r.fireEvent.click(form.getByRole('radio', { name: 'Standard service · 90 min' }));
  assert.equal(form.getByLabelText('Job title').value, 'Standard service');
  assert.ok(has(form.queryByText('Tue 6 Oct · 10:00–11:30 · Jo Taylor')));
  r.fireEvent.click(form.getByRole('radio', { name: 'Individual service' }));
  assert.equal(has(form.queryByRole('radio', { name: /Old thing/ })), false);
});

test('a customer is found by name and their bike chosen; saving creates the job', async () => {
  const r = await openDiary();
  const form = await pickTuesdayTen(r);
  r.fireEvent.change(form.getByLabelText('Find customer by name, phone or email'), { target: { value: 'Maya' } });
  r.fireEvent.click(await form.findByRole('button', { name: /Maya Patel/ }));
  await r.waitFor(() => assert.ok(has(form.queryByRole('option', { name: 'Trek Domane AL 3 · green' }))));
  r.fireEvent.click(await form.findByRole('radio', { name: 'Full service' }));
  r.fireEvent.click(form.getByRole('radio', { name: 'Standard service · 90 min' }));
  r.fireEvent.click(form.getByRole('button', { name: 'Save job' }));
  await r.waitFor(() => assert.equal(has(r.ui.queryByRole('dialog')), false));
  assert.deepEqual(posts(), ['/api/workshop-jobs {"title":"Standard service","jobDate":"2026-10-06","startTime":"10:00","endTime":"11:30","customerId":5,"bikeId":7,"mechanicId":12,"status":"scheduled","notes":"","plannedMinutes":90}']);
});

test('"The bike is here now" books it in straight after saving', async () => {
  const r = await openDiary();
  const form = await pickTuesdayTen(r);
  r.fireEvent.change(form.getByLabelText('Find customer by name, phone or email'), { target: { value: 'Maya' } });
  r.fireEvent.click(await form.findByRole('button', { name: /Maya Patel/ }));
  r.fireEvent.change(form.getByLabelText('Job title'), { target: { value: 'Wobbly wheel' } });
  r.fireEvent.click(form.getByRole('switch', { name: 'The bike is here now' }));
  r.fireEvent.click(form.getByRole('button', { name: 'Save job' }));
  await r.waitFor(() => assert.equal(posts().length, 2));
  assert.equal(posts()[1], '/api/workshop-jobs/50/book-in {"version":1}');
});

test('a job needs a title, and a customer unless it is a new bike build', async () => {
  const r = await openDiary();
  const form = await pickTuesdayTen(r);
  r.fireEvent.click(form.getByRole('button', { name: 'Save job' }));
  assert.ok(has(await form.findByText('Give the job a title, and choose a customer or turn on New bike build.')));
  r.fireEvent.change(form.getByLabelText('Job title'), { target: { value: 'PDI' } });
  r.fireEvent.click(form.getByRole('switch', { name: 'New bike build or pre-delivery check' }));
  r.fireEvent.click(form.getByRole('button', { name: 'Save job' }));
  await r.waitFor(() => assert.equal(posts().length, 1));
  assert.equal(JSON.parse(posts()[0].split(' ').slice(1).join(' ')).customerId, null);
});

test('if the server refuses, the form says why and stays open', async () => {
  const r = await openDiary();
  const form = await pickTuesdayTen(r);
  r.fireEvent.change(form.getByLabelText('Job title'), { target: { value: 'PDI' } });
  r.fireEvent.click(form.getByRole('switch', { name: 'New bike build or pre-delivery check' }));
  answer = { status: 400, ok: false, json: async () => ({ error: 'Jo Taylor is off on that day' }) };
  r.fireEvent.click(form.getByRole('button', { name: 'Save job' }));
  assert.ok(has(await form.findByText('Jo Taylor is off on that day')));
  assert.ok(has(r.ui.queryByRole('dialog', { name: 'New job' })));
});
