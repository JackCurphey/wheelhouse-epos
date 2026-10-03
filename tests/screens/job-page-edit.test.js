// The staff job page, piece 2: editing (decisions 38, 50; Jack, 3 Oct: a job's
// later days). The notes are one plain box, saved with Save notes (never by
// themselves); "Bike is here" is a toggle pill that books the bike in; a later
// day can be removed. Each change sends the version the page saw.
// Spec: docs/superpowers/specs/2026-10-03-staff-job-page-design.md (piece 2)
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const MECHANICS = [{ id: 11, name: 'Alex Morgan', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true }];
let JOB;
function job(over) {
  return {
    id: 1, title: 'Frame rebuild', reference: 'WH-1050', customerId: null, customerName: null, bikeId: null, bikeLabel: 'Trek Domane AL 3',
    mechanicId: 11, mechanicName: 'Alex Morgan', jobDate: '2026-10-05', startTime: '10:00', endTime: '12:00', status: 'scheduled',
    bookingState: 'scheduled', custodyState: 'expected', workState: 'not_started', version: 6, notes: 'Check the hub.', requested: null,
    customerDescription: null, cancelledBy: null, cancelledAt: null, cancellationSeenAt: null, orderId: null, orderStatus: null, orderTotal: null,
    createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z',
    parts: [
      { id: 21, position: 1, date: '2026-10-05', startTime: '10:00', endTime: '12:00', mechanicId: 11, mechanicName: 'Alex Morgan' },
      { id: 22, position: 2, date: '2026-10-06', startTime: '10:00', endTime: '12:00', mechanicId: 11, mechanicName: 'Alex Morgan' },
    ],
    ...over,
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
    return reply(404, { error: 'Not found' });
  };
}

async function openJob(over = {}) {
  JOB = job(over);
  uninstall = installDom('http://localhost/workshop/diary?date=2026-10-05');
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  stubServer();
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  rtl.fireEvent.click((await ui.findAllByRole('button', { name: /day 1 of 2/ }))[0]);
  const dlg = rtl.within(await ui.findByRole('dialog', { name: /Frame rebuild/ }));
  await rtl.waitFor(() => assert.equal(Boolean(dlg.queryByText('Loading…')), false));
  return { ...rtl, ui, dlg };
}

// After a change the page reloads the job; wait for that before a test ends.
const reads = () => calls.filter((c) => c.url === '/api/workshop-jobs/1').length;
async function settled(waitFor, before) {
  await waitFor(() => assert.ok(reads() > before));
  await new Promise((r) => setTimeout(r, 20));
}

const changes = () => calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.url} ${JSON.stringify(c.body)}`);
const has = (q) => Boolean(q);

test('the notes are one box, saved with Save notes once changed', async () => {
  const { dlg, fireEvent, waitFor } = await openJob();
  const box = dlg.getByRole('textbox', { name: 'Notes' });
  assert.equal(box.value, 'Check the hub.');
  assert.equal(dlg.getByRole('button', { name: 'Save notes' }).disabled, true);
  fireEvent.change(box, { target: { value: 'Check the hub. Bearings gritty.' } });
  const before = reads();
  fireEvent.click(dlg.getByRole('button', { name: 'Save notes' }));
  await waitFor(() => assert.deepEqual(changes(), ['PUT /api/workshop-jobs/1 {"notes":"Check the hub. Bearings gritty.","version":6}']));
  assert.ok(has(await dlg.findByText('Notes saved.')));
  await settled(waitFor, before);
});

test('if someone else changed the job first, the notes are not saved and it says so', async () => {
  const { dlg, fireEvent } = await openJob();
  answer = { status: 409, ok: false, json: async () => ({ error: 'This job changed while you were looking at it. Reload and try again.', code: 'stale' }) };
  fireEvent.change(dlg.getByRole('textbox', { name: 'Notes' }), { target: { value: 'New words' } });
  fireEvent.click(dlg.getByRole('button', { name: 'Save notes' }));
  assert.ok(has(await dlg.findByText('This job changed while you were looking at it. Your words are still in the box.')));
  assert.equal(dlg.getByRole('textbox', { name: 'Notes' }).value, 'New words');
});

test('"Bike is here" is off until the bike is booked in, and turning it on books it in', async () => {
  const { dlg, fireEvent, waitFor } = await openJob();
  const pill = dlg.getByRole('switch', { name: 'Bike is here' });
  assert.equal(pill.getAttribute('aria-checked'), 'false');
  const before = reads();
  fireEvent.click(pill);
  await waitFor(() => assert.deepEqual(changes(), ['POST /api/workshop-jobs/1/book-in {"version":6}']));
  await settled(waitFor, before);
});

test('"Bike is here" is on, and fixed, once the bike is in', async () => {
  const { dlg } = await openJob({ custodyState: 'in_shop' });
  const pill = dlg.getByRole('switch', { name: 'Bike is here' });
  assert.equal(pill.getAttribute('aria-checked'), 'true');
  assert.equal(pill.disabled, true);
});

test('a later day can be removed; the first day cannot', async () => {
  const { dlg, fireEvent, waitFor } = await openJob();
  assert.equal(has(dlg.queryByRole('button', { name: 'Remove day 1' })), false);
  const before = reads();
  fireEvent.click(dlg.getByRole('button', { name: 'Remove day 2' }));
  await waitFor(() => assert.deepEqual(changes(), ['DELETE /api/workshop-jobs/1/parts/22 {"version":6}']));
  await settled(waitFor, before);
});
