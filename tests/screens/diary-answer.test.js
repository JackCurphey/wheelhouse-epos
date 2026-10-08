// The staff diary, piece 2: answering what's waiting (journey 12 decisions
// 14, 15, 19; the request pop-ups drawn as request-new, request-decline,
// request-change and request-cancel in docs/design/user-journeys/generator/
// diary.mjs). Rendered in jsdom inside the app shell, the server stubbed in
// its real shapes; the answer routes take { version } and return the job.
// Spec: docs/superpowers/specs/2026-10-03-staff-diary-view-design.md (piece 2)
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const MECHANICS = [{ id: 11, name: 'Alex Morgan', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true }];

function job(over) {
  return {
    id: 1, title: 'Brake service', reference: 'WH-1001', customerId: 5, customerName: 'Maya Patel', bikeId: 7, bikeLabel: 'Trek Domane',
    mechanicId: 11, mechanicName: 'Alex Morgan', jobDate: '2026-10-06', startTime: '10:00', endTime: '11:00', status: 'scheduled',
    bookingState: 'scheduled', custodyState: 'expected', workState: 'not_started', version: 3, notes: null, requested: null,
    customerDescription: null, cancelledBy: null, cancelledAt: null, cancellationSeenAt: null, changeDeclinedAt: null,
    orderId: null, orderStatus: null, orderTotal: null, createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z', ...over,
  };
}
const REQUEST = job({ id: 3, reference: 'WH-1003', title: 'Puncture repair', bikeLabel: 'Specialized Sirrus', customerName: 'Sam Reed', mechanicId: null, mechanicName: null, jobDate: '2026-10-09', startTime: '10:00', endTime: '10:45', bookingState: 'pending', version: 4 });
const CHANGE = job({ id: 2, reference: 'WH-1002', title: 'Full service', bikeLabel: 'Brompton C Line', customerName: 'Oliver Chen', jobDate: '2026-10-05', bookingState: 'reschedule_requested', version: 7,
  requested: { jobDate: '2026-10-05', startTime: '14:00', endTime: '15:00', mechanicId: 11 } });
const CANCELLED = job({ id: 4, reference: 'WH-1004', title: 'Safety check', bikeLabel: 'Cannondale Quick', customerName: 'Aisha Khan', jobDate: '2026-10-07', startTime: '13:00', endTime: '14:00',
  bookingState: 'cancelled', cancelledBy: 'customer', cancelledAt: '2026-10-03T07:58:00Z', version: 9 });
const JOBS = [REQUEST, CHANGE, CANCELLED];
const WAITING = {
  count: 3,
  items: [
    { kind: 'new_booking', jobId: 3, reference: 'WH-1003', jobDate: '2026-10-09', startTime: '10:00', endTime: '10:45', mechanicId: null, customerName: 'Sam Reed', serviceNames: ['Puncture repair'], services: [], arrivedAt: '2026-10-03T08:15:00Z' },
    { kind: 'change_request', jobId: 2, reference: 'WH-1002', jobDate: '2026-10-05', startTime: '10:00', endTime: '11:00', mechanicId: 11, customerName: 'Oliver Chen', serviceNames: ['Full service'], services: [], arrivedAt: '2026-10-03T08:20:00Z',
      from: { jobDate: '2026-10-05', startTime: '10:00', endTime: '11:00', mechanicId: 11, mechanicName: 'Sam' }, to: { jobDate: '2026-10-05', startTime: '14:00', endTime: '15:00', mechanicId: 12, mechanicName: 'Alex Morgan' } },
    { kind: 'customer_cancelled', jobId: 4, reference: 'WH-1004', jobDate: '2026-10-07', startTime: '13:00', endTime: '14:00', mechanicId: 11, customerName: 'Aisha Khan', serviceNames: ['Safety check'], services: [], arrivedAt: '2026-10-03T07:58:00Z' },
  ],
};

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let answer; // what the next POST gets back: { status, body }
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
    if (method === 'POST') return answer ? reply(answer.status, answer.body) : reply(200, JOBS.find((j) => u.pathname.includes(`/${j.id}/`)));
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/employees') return reply(200, MECHANICS);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/workshop-waiting') return reply(200, WAITING);
    if (u.pathname === '/api/workshop-jobs') return reply(200, JOBS);
    const one = u.pathname.match(/^\/api\/workshop-jobs\/(\d+)$/);
    if (one) return reply(200, JOBS.find((j) => j.id === Number(one[1])));
    return reply(404, { error: 'Not found' });
  };
}

async function openDiary() {
  uninstall = installDom('http://localhost/workshop/diary?date=2026-10-05');
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };
  stubServer();
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByRole('button', { name: /Sam Reed/ });
  return { ...rtl, ui };
}

// Choose a waiting card, then press its Open button.
async function openCard({ ui, fireEvent, within }, customer) {
  const col = within(ui.getByRole('region', { name: /Waiting for you/ }));
  fireEvent.click(col.getByRole('button', { name: new RegExp(customer) }));
  fireEvent.click(await col.findByRole('button', { name: `Open ${customer}'s request` }));
  return loaded({ ui, within });
}

// The pop-up, once the job's details have arrived.
async function loaded({ ui, within, waitFor }) {
  const dlg = within(await ui.findByRole('dialog'));
  await (waitFor ?? (await import('@testing-library/react')).waitFor)(() => assert.equal(has(dlg.queryByText('Loading…')), false));
  return dlg;
}

const posted = () => calls.filter((c) => c.method === 'POST').map((c) => `${c.url} ${JSON.stringify(c.body)}`);
const has = (q) => Boolean(q);

test('a booking request opens in a pop-up with what the customer asked for', async () => {
  const r = await openDiary();
  const dlg = await openCard(r, 'Sam Reed');
  assert.ok(has(dlg.queryByRole('heading', { name: 'Sam Reed · Specialized Sirrus' })));
  assert.ok(has(dlg.queryByText('Pending')));
  assert.ok(has(dlg.queryByText('No message from the customer.')));
  assert.ok(has(dlg.queryByText('Puncture repair')));
  assert.ok(has(dlg.queryByText('Requested Fri 9 Oct, 10:00–10:45')));
});

test('Accept accepts the booking with the version seen, closes the pop-up and refreshes the diary', async () => {
  const r = await openDiary();
  const dlg = await openCard(r, 'Sam Reed');
  const before = calls.filter((c) => c.url === '/api/workshop-waiting').length;
  r.fireEvent.click(dlg.getByRole('button', { name: 'Accept' }));
  await r.waitFor(() => assert.equal(has(r.ui.queryByRole('dialog')), false));
  assert.deepEqual(posted(), ['/api/workshop-jobs/3/accept {"version":4}']);
  await r.waitFor(() => assert.ok(calls.filter((c) => c.url === '/api/workshop-waiting').length > before));
});

test('Decline asks first; Keep booking changes nothing', async () => {
  const r = await openDiary();
  const dlg = await openCard(r, 'Sam Reed');
  r.fireEvent.click(dlg.getByRole('button', { name: 'Decline' }));
  assert.ok(has(dlg.queryByText("Decline Sam Reed's booking for Fri 9 Oct? This can't be undone.")));
  r.fireEvent.click(dlg.getByRole('button', { name: 'Keep booking' }));
  assert.ok(has(dlg.queryByRole('button', { name: 'Accept' })));
  assert.deepEqual(posted(), []);
});

test('confirming Decline declines the booking', async () => {
  const r = await openDiary();
  const dlg = await openCard(r, 'Sam Reed');
  r.fireEvent.click(dlg.getByRole('button', { name: 'Decline' }));
  r.fireEvent.click(dlg.getByRole('button', { name: 'Decline booking' }));
  await r.waitFor(() => assert.deepEqual(posted(), ['/api/workshop-jobs/3/decline {"version":4}']));
});

test('a change request shows where from and to, and Accept moves it', async () => {
  const r = await openDiary();
  const dlg = await openCard(r, 'Oliver Chen');
  assert.ok(has(dlg.queryByRole('heading', { name: 'Change request' })));
  assert.ok(has(dlg.queryByText('Mon 5 Oct · 10:00 · Sam')));
  assert.ok(has(dlg.queryByText('Mon 5 Oct · 14:00 · Alex Morgan')));
  r.fireEvent.click(dlg.getByRole('button', { name: 'Accept' }));
  await r.waitFor(() => assert.deepEqual(posted(), ['/api/workshop-jobs/2/accept-change {"version":7}']));
});

test('a change request names the mechanic on each side, since accepting moves it to the one asked for', async () => {
  // Jack, 8 Oct: the pop-up said "Accepting keeps the same work and mechanic",
  // but accepting moves the booking to the mechanic the customer asked for.
  const r = await openDiary();
  const dlg = await openCard(r, 'Oliver Chen');
  assert.ok(has(dlg.queryByText('Mon 5 Oct · 10:00 · Sam')));
  assert.ok(has(dlg.queryByText('Mon 5 Oct · 14:00 · Alex Morgan')));
  assert.ok(has(dlg.queryByText('The customer asked to move this booking. Accepting keeps the same work.')));
  assert.ok(dlg.queryByText(/same work and mechanic/) === null);
});

test('declining a change request keeps the booking where it was', async () => {
  const r = await openDiary();
  const dlg = await openCard(r, 'Oliver Chen');
  r.fireEvent.click(dlg.getByRole('button', { name: 'Decline' }));
  await r.waitFor(() => assert.deepEqual(posted(), ['/api/workshop-jobs/2/decline-change {"version":7}']));
});

test("a customer's cancellation has one answer: Seen", async () => {
  const r = await openDiary();
  const dlg = await openCard(r, 'Aisha Khan');
  assert.ok(has(dlg.queryByRole('heading', { name: 'Cancelled booking' })));
  assert.ok(has(dlg.queryByText('Cancelled by the customer on Sat 3 Oct.')));
  r.fireEvent.click(dlg.getByRole('button', { name: 'Seen' }));
  await r.waitFor(() => assert.deepEqual(posted(), ['/api/workshop-jobs/4/cancellation-seen {"version":9}']));
});

test('if someone else changed the job first, the pop-up says so and shows it afresh', async () => {
  const r = await openDiary();
  const dlg = await openCard(r, 'Sam Reed');
  answer = { status: 409, body: { error: 'Job has been changed by someone else', code: 'stale' } };
  const reads = () => calls.filter((c) => c.url === '/api/workshop-jobs/3').length;
  const before = reads();
  r.fireEvent.click(dlg.getByRole('button', { name: 'Accept' }));
  assert.ok(has(await dlg.findByText('This job changed while you were looking at it.')));
  assert.ok(has(r.ui.queryByRole('dialog')));
  await r.waitFor(() => assert.ok(reads() > before));
});

test('a change to a time that has gone says the time is no longer free', async () => {
  const r = await openDiary();
  const dlg = await openCard(r, 'Oliver Chen');
  answer = { status: 409, body: { error: 'The requested time is no longer free', code: 'capacity' } };
  r.fireEvent.click(dlg.getByRole('button', { name: 'Accept' }));
  assert.ok(has(await dlg.findByText('The requested time is no longer free.')));
});

test('double-clicking a card opens it straight away', async () => {
  const r = await openDiary();
  const col = r.within(r.ui.getByRole('region', { name: /Waiting for you/ }));
  r.fireEvent.doubleClick(col.getByRole('button', { name: /Aisha Khan/ }));
  const dlg = await loaded(r);
  assert.ok(has(dlg.queryByRole('heading', { name: 'Cancelled booking' })));
});
