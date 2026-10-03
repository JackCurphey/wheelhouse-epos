// Jobs over several days in the staff app (Workshop day decision 52; Jack,
// 3 Oct: "Add another day" on the job page). The diary draws a block for
// each day ("Day 1 of 2"); moving a later day moves just that day; the job
// page lists the days and adds another.
// Spec: docs/superpowers/specs/2026-10-03-multi-day-jobs-design.md
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const MECHANICS = [{ id: 11, name: 'Alex Morgan', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true }];
const JOB = {
  id: 1, title: 'Frame rebuild', reference: 'WH-1050', customerId: null, customerName: 'Maya Patel', bikeId: null, bikeLabel: 'Trek Domane AL 3',
  mechanicId: 11, mechanicName: 'Alex Morgan', jobDate: '2026-10-05', startTime: '10:00', endTime: '12:00', status: 'scheduled',
  bookingState: 'scheduled', custodyState: 'in_shop', workState: 'in_progress', version: 6, notes: null, requested: null,
  cancelledBy: null, cancelledAt: null, cancellationSeenAt: null, orderId: null, orderStatus: null, orderTotal: null,
  createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z',
  parts: [
    { id: 21, position: 1, date: '2026-10-05', startTime: '10:00', endTime: '12:00', mechanicId: 11, mechanicName: 'Alex Morgan' },
    { id: 22, position: 2, date: '2026-10-06', startTime: '10:00', endTime: '12:00', mechanicId: 11, mechanicName: 'Alex Morgan' },
  ],
};

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

function stubServer() {
  calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ url, method, body: init.body ? JSON.parse(init.body) : undefined });
    const reply = (status, body) => ({ status, ok: status < 300, json: async () => body });
    const u = new URL(url, 'http://localhost');
    if (method !== 'GET') return reply(200, { ...JOB, version: 7 });
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/employees') return reply(200, MECHANICS);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/workshop-waiting') return reply(200, { count: 0, items: [] });
    if (u.pathname === '/api/workshop-jobs') return reply(200, [JOB]);
    if (u.pathname === '/api/workshop-jobs/1') return reply(200, JOB);
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
  await ui.findAllByText('Trek Domane AL 3');
  return { ...rtl, ui };
}

const has = (q) => Boolean(q);
const changes = () => calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.url} ${JSON.stringify(c.body)}`);

test('a job over two days has a block on each day, each saying which day it is', async () => {
  const { ui, within } = await openDiary();
  assert.ok(has(within(ui.getByRole('group', { name: 'Monday 5 October' })).queryByText(/Trek Domane AL 3, Frame rebuild, Maya Patel, WH-1050, Scheduled, 10:00–12:00, day 1 of 2/)));
  assert.ok(has(within(ui.getByRole('group', { name: 'Tuesday 6 October' })).queryByText(/day 2 of 2/)));
  assert.ok(has(within(ui.getByRole('group', { name: 'Tuesday 6 October' })).queryByText('Day 2 of 2 · Frame rebuild')));
});

test('moving the second day moves just that day', async () => {
  const { ui, fireEvent, waitFor, within } = await openDiary();
  const day2 = within(ui.getByRole('group', { name: 'Tuesday 6 October' })).getByRole('button', { name: /day 2 of 2/ });
  fireEvent.keyDown(day2, { key: 'm' });
  fireEvent.keyDown(day2, { key: 'ArrowRight' });
  fireEvent.keyDown(day2, { key: 'Enter' });
  await waitFor(() => assert.deepEqual(changes(), ['PUT /api/workshop-jobs/1/parts/22 {"jobDate":"2026-10-07","startTime":"10:00","endTime":"12:00","version":6}']));
});

test('the job page lists the days, is ready by the last one, and adds another day', async () => {
  const { ui, fireEvent, waitFor, within } = await openDiary();
  fireEvent.click(within(ui.getByRole('group', { name: 'Monday 5 October' })).getByRole('button', { name: /day 1 of 2/ }));
  const job = within(await ui.findByRole('dialog', { name: /Frame rebuild/ }));
  await waitFor(() => assert.equal(has(job.queryByText('Loading…')), false));
  const daysList = within(job.getByRole('list', { name: 'Days' }));
  assert.ok(has(daysList.queryByText('Day 1: Mon 5 Oct, 10:00–12:00, Alex Morgan')));
  assert.ok(has(daysList.queryByText('Day 2: Tue 6 Oct, 10:00–12:00, Alex Morgan')));
  assert.ok(has(job.queryByText('Ready by Tue 6 Oct')));
  const reads = () => calls.filter((c) => c.url === '/api/workshop-jobs/1').length;
  const before = reads();
  fireEvent.click(job.getByRole('button', { name: 'Add another day' }));
  await waitFor(() => assert.deepEqual(changes(), ['POST /api/workshop-jobs/1/parts {"version":6}']));
  // The page reloads the job afterwards; let it finish before the test ends.
  await waitFor(() => assert.ok(reads() > before));
  await waitFor(() => assert.equal(job.getByRole('button', { name: 'Add another day' }).disabled, false));
});
