// The mechanic sign-off, piece 1 (Jack, 16 and 18 Oct,
// docs/decisions/2026-10-16-mechanic-sign-off.md; drawn in diary.mjs
// signOffDrawings()): "Mark ready for collection" asks "Who’s signing this
// off?" with the mechanics as pills, the job's own picked; the finished page
// shows "Signed off by [name] · [day], [time]".
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';
const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const MECHANICS = [
  { id: 11, name: 'Alex Morgan', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true },
  { id: 12, name: 'Jo Taylor', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true },
];
const CUSTOMER = { id: 5, name: 'Maya Patel', email: 'maya@example.test', phone: '07700 900142', active: true };
const ORDER = { id: 80, status: 'draft', total: 111, items: [
  { id: 1, name: 'Standard service', lineType: 'service', qty: 1, unitPrice: 75, lineTotal: 75 },
  { id: 2, name: 'Brake pads (pair)', lineType: 'product', qty: 2, unitPrice: 18, lineTotal: 36 },
] };

let JOB;
function job(over) {
  return {
    id: 1, title: 'Standard service', reference: 'WH-1042', customerId: 5, customerName: 'Maya Patel', bikeId: 7, bikeLabel: 'Trek Domane AL 3',
    mechanicId: 11, mechanicName: 'Alex Morgan', jobDate: '2026-10-08', startTime: '10:00', endTime: '11:30', status: 'scheduled',
    bookingState: 'scheduled', custodyState: 'expected', workState: 'not_started', version: 3, notes: 'Check the rear hub too.', requested: null,
    customerDescription: 'Rear brake squeals and feels weak.', cancelledBy: null, cancelledAt: null, cancellationSeenAt: null,
    orderId: 80, orderStatus: 'draft', orderTotal: 111, createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z', ...over,
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
    if (method === 'POST') return answer ?? reply(200, { ...JOB, version: JOB.version + 1 });
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/employees') return reply(200, MECHANICS);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/workshop-waiting') return reply(200, { count: 0, items: [] });
    if (u.pathname === '/api/workshop-jobs') return reply(200, [JOB]);
    if (u.pathname === '/api/workshop-jobs/1') return reply(200, JOB);
    if (u.pathname === '/api/customers/5') return reply(200, CUSTOMER);
    if (u.pathname === '/api/sale-documents/80') return reply(200, ORDER);
    return reply(404, { error: 'Not found' });
  };
}

async function openJob(over = {}, how = 'click') {
  JOB = job(over);
  uninstall = installDom('http://localhost/workshop/diary?date=2026-10-05');
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  stubServer();
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  const block = await ui.findByRole('button', { name: /^Trek Domane AL 3, Standard service/ });
  if (how === 'click') rtl.fireEvent.click(block);
  else rtl.fireEvent.keyDown(block, { key: 'Enter' });
  const dlg = rtl.within(await ui.findByRole('dialog', { name: /Standard service/ }));
  await rtl.waitFor(() => assert.equal(Boolean(dlg.queryByText('Loading…')), false));
  return { ...rtl, ui, dlg };
}

const posts = () => calls.filter((c) => c.method === 'POST').map((c) => `${c.url} ${JSON.stringify(c.body)}`);
const has = (q) => Boolean(q);

test('a click on a diary block opens the job: title, status, customer, bike, mechanic and ready-by', async () => {
  const { dlg } = await openJob();
  assert.ok(has(dlg.queryByRole('heading', { name: 'Standard service' })));
  assert.ok(has(dlg.queryByText('Expected')));
  assert.ok(has(await dlg.findByText('07700 900142')));
  assert.ok(has(dlg.queryByText('maya@example.test')));
  assert.ok(has(dlg.queryByText('Trek Domane AL 3')));
  assert.ok(has(dlg.queryByText('Mechanic: Alex Morgan')));
  assert.ok(has(dlg.queryByText('Ready by Thu 8 Oct')));
});

test('Enter on a block opens the job too', async () => {
  const { dlg } = await openJob({}, 'enter');
  assert.ok(has(dlg.queryByRole('heading', { name: 'Standard service' })));
});

test('the job shows its number, the customer\'s words, its notes, and its work and parts', async () => {
  const { dlg } = await openJob();
  assert.ok(has(dlg.queryByText('WH-1042')));
  assert.ok(has(dlg.queryByText('Rear brake squeals and feels weak.')));
  assert.ok(has(dlg.queryByText('Check the rear hub too.')));
  assert.ok(has(await dlg.findByText('Brake pads (pair)')));
  assert.ok(has(dlg.queryByText('£111.00')));
});

const IN_PROGRESS = { custodyState: 'in_shop', workState: 'in_progress' };

async function askSignOff(over = {}) {
  const t = await openJob({ ...IN_PROGRESS, ...over });
  t.fireEvent.click(t.dlg.getByRole('button', { name: 'Mark ready for collection' }));
  const pop = t.within(await t.ui.findByRole('dialog', { name: 'Who’s signing this off?' }));
  return { ...t, pop };
}

test('Mark ready asks who is signing it off, with the job’s mechanic picked, and finishes nothing yet', async () => {
  const { pop } = await askSignOff();
  assert.ok(has(pop.queryByText('Standard service · WH-1042')));
  assert.ok(has(pop.queryByText('Signing off says the work is done and the bike is fine to go out. If it comes back, the job shows who passed it.')));
  const group = pop.getByRole('radiogroup', { name: 'Signed off by' });
  assert.ok(group !== null);
  assert.equal(pop.getByRole('radio', { name: 'Alex Morgan' }).getAttribute('aria-checked'), 'true');
  assert.equal(pop.getByRole('radio', { name: 'Jo Taylor' }).getAttribute('aria-checked'), 'false');
  assert.deepEqual(posts(), []);
});

test('Sign off and mark ready finishes the work with who signed it off', async () => {
  const { pop, fireEvent, waitFor, ui } = await askSignOff();
  fireEvent.click(pop.getByRole('radio', { name: 'Jo Taylor' }));
  fireEvent.click(pop.getByRole('button', { name: 'Sign off and mark ready' }));
  await waitFor(() => assert.deepEqual(posts(), ['/api/workshop-jobs/1/finish {"signedOffBy":12,"version":3}']));
  await waitFor(() => assert.equal(has(ui.queryByRole('dialog', { name: 'Who’s signing this off?' })), false));
});

test('a shared-queue job has nobody picked, and Sign off waits until someone is', async () => {
  const { pop, fireEvent, waitFor } = await askSignOff({ mechanicId: null, mechanicName: null });
  for (const name of ['Alex Morgan', 'Jo Taylor']) assert.equal(pop.getByRole('radio', { name }).getAttribute('aria-checked'), 'false');
  const go = pop.getByRole('button', { name: 'Sign off and mark ready' });
  assert.equal(go.disabled, true);
  fireEvent.click(pop.getByRole('radio', { name: 'Alex Morgan' }));
  assert.equal(go.disabled, false);
  fireEvent.click(go);
  await waitFor(() => assert.deepEqual(posts(), ['/api/workshop-jobs/1/finish {"signedOffBy":11,"version":3}']));
});

test('Cancel finishes nothing', async () => {
  const { pop, fireEvent, ui } = await askSignOff();
  fireEvent.click(pop.getByRole('button', { name: 'Cancel' }));
  assert.equal(has(ui.queryByRole('dialog', { name: 'Who’s signing this off?' })), false);
  assert.deepEqual(posts(), []);
});

test('the finished page shows who signed it off, and when', async () => {
  const { dlg } = await openJob({ custodyState: 'in_shop', workState: 'complete', signedOffBy: 11, signedOffByName: 'Alex Morgan', signedOffAt: '2026-09-17T14:30:00.000Z' });
  const line = dlg.getByText((_, el) => el?.getAttribute('data-sign-off') === 'true');
  assert.equal(line.textContent, 'Signed off by Alex Morgan · Thu 17 Sep, 15:30');
});

test('work not signed off (finished before the sign-off, or paid at the till) shows no line', async () => {
  const { dlg } = await openJob({ custodyState: 'in_shop', workState: 'complete', signedOffBy: null, signedOffByName: null, signedOffAt: null });
  assert.equal(has(dlg.queryByText(/Signed off by/)), false);
});
