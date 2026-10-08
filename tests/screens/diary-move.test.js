// The staff diary, piece 3: moving a job (journey 12; decision 32 moves a
// job to another mechanic in the Day view). Dragging is checked in a real
// browser (tests/browser/diary-move.spec.ts); here, the keyboard way to move
// a job, which jsdom can do without layout: M picks the job up (Enter opens
// it, as a button does), arrows move it, Enter saves, Escape puts it back. Saving is the existing
// PUT /api/workshop-jobs/:id with the version the diary saw.
// Spec: docs/superpowers/specs/2026-10-03-staff-diary-view-design.md (piece 3)
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const MECHANICS = [
  { id: 11, name: 'Alex Morgan', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true },
  { id: 12, name: 'Jo Taylor', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true },
];
function job(over) {
  return {
    id: 1, title: 'Brake service', reference: 'WH-1001', customerId: 5, customerName: 'Maya Patel', bikeId: 7, bikeLabel: 'Trek Domane',
    mechanicId: 11, mechanicName: 'Alex Morgan', jobDate: '2026-10-06', startTime: '10:00', endTime: '11:00', status: 'scheduled',
    bookingState: 'scheduled', custodyState: 'expected', workState: 'not_started', version: 3, notes: null, requested: null,
    cancelledBy: null, cancelledAt: null, cancellationSeenAt: null, orderId: null, orderStatus: null, orderTotal: null,
    createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z', ...over,
  };
}
const JOBS = [
  job({}),
  job({ id: 3, reference: 'WH-1003', bikeLabel: 'Specialized Sirrus', customerName: 'Sam Reed', mechanicId: null, jobDate: '2026-10-08', bookingState: 'pending' }),
  job({ id: 4, reference: 'WH-1004', bikeLabel: 'Cannondale Quick', customerName: 'Aisha Khan', jobDate: '2026-10-07', bookingState: 'cancelled', cancelledBy: 'customer' }),
  // A change request to another day, time and mechanic (Alex → Jo).
  job({ id: 5, reference: 'WH-1005', bikeLabel: 'Brompton C Line', customerName: 'Oliver Chen', jobDate: '2026-10-09', startTime: '14:00', endTime: '15:00',
    bookingState: 'reschedule_requested', requested: { jobDate: '2026-10-08', startTime: '15:00', endTime: '16:00', mechanicId: 12 } }),
  // A two-day job whose customer asked to move it; the request is day 1's.
  job({ id: 6, reference: 'WH-1006', bikeLabel: 'Cube Attain', customerName: 'Oliver Chen', title: 'Frame rebuild', jobDate: '2026-10-05', startTime: '09:00', endTime: '10:00',
    bookingState: 'reschedule_requested', requested: { jobDate: '2026-10-09', startTime: '09:15', endTime: '10:15', mechanicId: 12 },
    parts: [
      { id: 61, position: 1, date: '2026-10-05', startTime: '09:00', endTime: '10:00', mechanicId: 11, mechanicName: 'Alex Morgan' },
      { id: 62, position: 2, date: '2026-10-09', startTime: '09:00', endTime: '10:00', mechanicId: 11, mechanicName: 'Alex Morgan' },
    ] }),
];

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
    if (method === 'PUT') return answer ? reply(answer.status, answer.body) : reply(200, { ...JOBS[0], version: 4 });
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/employees') return reply(200, MECHANICS);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/workshop-waiting') return reply(200, { count: 0, items: [] });
    if (u.pathname === '/api/workshop-jobs') return reply(200, JOBS);
    return reply(404, { error: 'Not found' });
  };
}

async function openDiary(query = '?date=2026-10-05') {
  uninstall = installDom(`http://localhost/workshop/diary${query}`);
  stubServer();
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByText('Trek Domane');
  return { ...rtl, ui };
}

const puts = () => calls.filter((c) => c.method === 'PUT').map((c) => `${c.url} ${JSON.stringify(c.body)}`);
const has = (q) => Boolean(q);
const block = (ui, name) => ui.getByRole('button', { name: new RegExp(`^${name}`) });

test('a job can be picked up with M, moved with the arrows, and saved with Enter', async () => {
  const { ui, fireEvent, waitFor } = await openDiary();
  const b = block(ui, 'Trek Domane');
  fireEvent.keyDown(b, { key: 'm' });
  assert.ok(has(ui.queryByText(/Moving Trek Domane\. Tue 6 Oct, 10:00–11:00\./)));
  fireEvent.keyDown(b, { key: 'ArrowDown' });
  fireEvent.keyDown(b, { key: 'ArrowDown' });
  fireEvent.keyDown(b, { key: 'ArrowRight' });
  assert.ok(has(ui.queryByText(/Moving Trek Domane\. Wed 7 Oct, 10:30–11:30\./)));
  fireEvent.keyDown(b, { key: 'Enter' });
  await waitFor(() => assert.deepEqual(puts(), ['/api/workshop-jobs/1 {"jobDate":"2026-10-07","startTime":"10:30","endTime":"11:30","version":3}']));
});

test('in the Week view, dropping a change request on the time asked for sends the mechanic asked for too', async () => {
  // Jack, 8 Oct: the Week view sent no mechanic, so a drop on the dashed
  // outline moved the job but did not accept a request for another mechanic.
  const { ui, fireEvent, waitFor } = await openDiary();
  const b = block(ui, 'Brompton C Line');
  fireEvent.keyDown(b, { key: 'm' });
  fireEvent.keyDown(b, { key: 'ArrowLeft' });
  for (let i = 0; i < 4; i += 1) fireEvent.keyDown(b, { key: 'ArrowDown' }); // 15 minutes a press
  fireEvent.keyDown(b, { key: 'Enter' });
  await waitFor(() => assert.deepEqual(puts(), ['/api/workshop-jobs/5 {"jobDate":"2026-10-08","startTime":"15:00","endTime":"16:00","version":3,"mechanicId":12}']));
});

test("a later day dropped on the requested time sends no mechanic: the request is the job's first day's", async () => {
  const { ui, fireEvent, waitFor, within } = await openDiary();
  const day2 = within(ui.getByRole('group', { name: 'Friday 9 October' })).getByRole('button', { name: /day 2 of 2/ });
  fireEvent.keyDown(day2, { key: 'm' });
  fireEvent.keyDown(day2, { key: 'ArrowDown' });
  fireEvent.keyDown(day2, { key: 'Enter' });
  await waitFor(() => assert.deepEqual(puts(), ['/api/workshop-jobs/6/parts/62 {"jobDate":"2026-10-09","startTime":"09:15","endTime":"10:15","version":3}']));
});

test('in the Week view, a drop anywhere else still sends no mechanic', async () => {
  const { ui, fireEvent, waitFor } = await openDiary();
  const b = block(ui, 'Brompton C Line');
  fireEvent.keyDown(b, { key: 'm' });
  fireEvent.keyDown(b, { key: 'ArrowLeft' });
  fireEvent.keyDown(b, { key: 'Enter' });
  await waitFor(() => assert.deepEqual(puts(), ['/api/workshop-jobs/5 {"jobDate":"2026-10-08","startTime":"14:00","endTime":"15:00","version":3}']));
});

test('Escape puts the job back without saving', async () => {
  const { ui, fireEvent } = await openDiary();
  const b = block(ui, 'Trek Domane');
  fireEvent.keyDown(b, { key: 'm' });
  fireEvent.keyDown(b, { key: 'ArrowDown' });
  fireEvent.keyDown(b, { key: 'Escape' });
  assert.ok(has(ui.queryByText('Move cancelled. Trek Domane stays at Tue 6 Oct, 10:00–11:00.')));
  assert.deepEqual(puts(), []);
});

test('in the Day view, left and right move the job to another mechanic', async () => {
  const { ui, fireEvent, waitFor } = await openDiary('?date=2026-10-06&view=day');
  const b = block(ui, 'Trek Domane');
  fireEvent.keyDown(b, { key: 'm' });
  fireEvent.keyDown(b, { key: 'ArrowRight' });
  assert.ok(has(ui.queryByText(/Moving Trek Domane\. Tue 6 Oct, 10:00–11:00, Jo Taylor\./)));
  fireEvent.keyDown(b, { key: 'Enter' });
  await waitFor(() => assert.deepEqual(puts(), ['/api/workshop-jobs/1 {"jobDate":"2026-10-06","startTime":"10:00","endTime":"11:00","version":3,"mechanicId":12}']));
});

test('if the server refuses the time, it says why and the job stays put', async () => {
  const { ui, fireEvent } = await openDiary();
  answer = { status: 400, body: { error: 'Alex Morgan already has a job at that time' } };
  const b = block(ui, 'Trek Domane');
  fireEvent.keyDown(b, { key: 'm' });
  fireEvent.keyDown(b, { key: 'ArrowDown' });
  fireEvent.keyDown(b, { key: 'Enter' });
  assert.ok(has(await ui.findByText("Couldn't move Trek Domane: Alex Morgan already has a job at that time")));
});

test('if someone else changed the job first, it says so', async () => {
  const { ui, fireEvent } = await openDiary();
  answer = { status: 409, body: { error: 'Job has been changed by someone else', code: 'stale' } };
  const b = block(ui, 'Trek Domane');
  fireEvent.keyDown(b, { key: 'm' });
  fireEvent.keyDown(b, { key: 'ArrowUp' });
  fireEvent.keyDown(b, { key: 'Enter' });
  assert.ok(has(await ui.findByText("Couldn't move Trek Domane: This job changed while you were looking at it.")));
});

test('a booking request and a cancelled booking cannot be moved', async () => {
  const { ui } = await openDiary();
  assert.equal(has(ui.queryByRole('button', { name: /^Specialized Sirrus/ })), false);
  assert.equal(has(ui.queryByRole('button', { name: /^Cannondale Quick/ })), false);
});
