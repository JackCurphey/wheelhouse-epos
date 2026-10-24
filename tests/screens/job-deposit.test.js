// The diary job's deposit (approved drawings bk-staff-deposit…, bk-staff-no-show…;
// Jack, 24 Oct answers 2, 3, 5 and 9; openspec/changes/deposit-diary-screen).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';
import { fakeJob } from '../helpers/fake-job.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const MECHANICS = [{ id: 11, name: 'Alex Morgan', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true }];
const CUSTOMER = { id: 5, name: 'Maya Patel', email: 'maya@example.test', phone: '07700 900142', active: true };
const ORDER = { id: 80, status: 'draft', total: 111, items: [
  { id: 1, name: 'Standard service', lineType: 'service', qty: 1, unitPrice: 75, lineTotal: 75 },
  { id: 2, name: 'Brake pads (pair)', lineType: 'product', qty: 2, unitPrice: 18, lineTotal: 36 },
] };

let JOB;
function job(over) {
  return fakeJob({
    id: 1, title: 'Standard service', reference: 'WH-1042', customerId: 5, customerName: 'Maya Patel', bikeId: 7, bikeLabel: 'Trek Domane AL 3',
    mechanicId: 11, mechanicName: 'Alex Morgan', jobDate: '2026-10-08', startTime: '10:00', endTime: '11:30', status: 'scheduled',
    bookingState: 'scheduled', custodyState: 'expected', workState: 'not_started', version: 3, notes: 'Check the rear hub too.', requested: null,
    customerDescription: 'Rear brake squeals and feels weak.', cancelledBy: null, cancelledAt: null, cancellationSeenAt: null,
    orderId: 80, orderStatus: 'draft', orderTotal: 111, createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z', ...over,
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

async function openJob(over = {}) {
  JOB = job(over);
  // Opened from its address, so a job on any day opens (the diary's ?job=).
  uninstall = installDom('http://localhost/workshop/diary?date=2026-10-05&job=1');
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  stubServer();
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  const dlg = rtl.within(await ui.findByRole('dialog', { name: /Standard service/ }));
  await rtl.waitFor(() => assert.equal(Boolean(dlg.queryByText('Loading…')), false));
  return { ...rtl, ui, dlg };
}

const posts = () => calls.filter((c) => c.method === 'POST').map((c) => `${c.url} ${JSON.stringify(c.body)}`);
const PAID = { pence: 1300, paidAt: '2026-09-20T10:00:00Z', state: 'paid', refundedAt: null, refundReason: null, refundedBy: null, noShowAt: null, noShowBy: null };
// A day long gone, whatever today is: the bike never came in.
const GONE = { jobDate: '2025-09-17', startTime: '11:30', endTime: '13:00' };

test('a deposit paid: the strip under the customer, with Refund the deposit', async () => {
  const { dlg } = await openJob({ deposit: PAID });
  const strip = dlg.getByRole('group', { name: 'Deposit' });
  assert.ok(strip.textContent.includes('Deposit paid'), strip.textContent);
  assert.ok(strip.textContent.includes('£13.00'));
  assert.ok(strip.textContent.includes('· Sun 20 Sep'));
  assert.ok(dlg.getByRole('button', { name: 'Refund the deposit' }));
});

test('refunded: the date and the reason, and no button', async () => {
  const { dlg } = await openJob({ deposit: { ...PAID, state: 'refunded', refundedAt: '2026-09-22T09:00:00Z', refundReason: 'Bike wasn’t ready in time', refundedBy: 'Jo Taylor' } });
  const strip = dlg.getByRole('group', { name: 'Deposit' });
  assert.ok(strip.textContent.includes('Deposit refunded'));
  assert.ok(strip.textContent.includes('· Tue 22 Sep · Bike wasn’t ready in time'), strip.textContent);
  assert.ok(dlg.queryByRole('button', { name: 'Refund the deposit' }) === null);
});

test('the refund pop-up as drawn: the whole deposit, a reason needed, where it goes; it sends the reason', async () => {
  const r = await openJob({ deposit: PAID });
  r.fireEvent.click(r.dlg.getByRole('button', { name: 'Refund the deposit' }));
  const pop = r.within(await r.ui.findByRole('dialog', { name: 'Refund the deposit' }));
  assert.ok(pop.getByText('Maya Patel · Standard service · WH-1042'));
  assert.ok(pop.getByText('The whole deposit, paid Sun 20 Sep').closest('div').textContent.includes('£13.00'));
  assert.ok(pop.getByText('It goes back to the card they paid with, within 5 to 10 working days.'));
  r.fireEvent.click(pop.getByRole('button', { name: 'Refund £13.00' }));
  assert.ok(await pop.findByText('Say why the deposit is being refunded'));
  assert.deepEqual(posts(), []);
  r.fireEvent.change(pop.getByLabelText('Reason (needed)'), { target: { value: 'Bike wasn’t ready in time' } });
  r.fireEvent.click(pop.getByRole('button', { name: 'Refund £13.00' }));
  await r.waitFor(() => assert.deepEqual(posts(), ['/api/workshop-jobs/1/deposit-refund {"reason":"Bike wasn’t ready in time"}']));
  await r.waitFor(() => assert.ok(r.ui.queryByRole('dialog', { name: 'Refund the deposit' }) === null));
});

test('the day gone with the bike not in: Not come in, and Didn’t come beside Book in', async () => {
  const { dlg } = await openJob({ ...GONE, deposit: PAID });
  const strip = dlg.getByRole('group', { name: 'Deposit' });
  assert.ok(strip.textContent.includes('Not come in'));
  assert.ok(strip.textContent.includes('Booked for Wed 17 Sep · 11:30 · the bike hasn’t come in'), strip.textContent);
  const buttons = [...dlg.getByRole('contentinfo').querySelectorAll('button')].map((b) => b.textContent);
  assert.ok(buttons.indexOf('Didn’t come') >= 0 && buttons.indexOf('Didn’t come') < buttons.indexOf('Book in'), buttons.join(' / '));
});

test('not before the day has gone', async () => {
  const { dlg } = await openJob({ jobDate: '2099-01-05', deposit: PAID });
  assert.ok(dlg.queryByRole('button', { name: 'Didn’t come' }) === null);
  assert.ok(!dlg.getByRole('group', { name: 'Deposit' }).textContent.includes('Not come in'));
});

test('Didn’t come marks it: the badge, the bar with Undo, which stays; Undo takes it off', async () => {
  const r = await openJob({ ...GONE, deposit: PAID });
  const marked = { ...JOB, version: JOB.version + 1, noShowAt: '2026-09-18T09:00:00Z', deposit: { ...PAID, state: 'kept', noShowAt: '2026-09-18T09:00:00Z', noShowBy: 'Jo Taylor' } };
  answer = { status: 200, ok: true, json: async () => marked };
  r.fireEvent.click(r.dlg.getByRole('button', { name: 'Didn’t come' }));
  JOB = marked;
  const bar = await r.dlg.findByText('Marked Didn’t come · the deposit is kept');
  assert.ok(bar.closest('[role="status"]'));
  await new Promise((done) => setTimeout(done, 50));
  assert.ok(r.dlg.queryByText('Marked Didn’t come · the deposit is kept') !== null, 'nothing closes by itself');
  await r.waitFor(() => assert.ok(r.dlg.getByRole('group', { name: 'Deposit' }).textContent.includes('Didn’t come · marked by Jo Taylor · Fri 18 Sep')));
  assert.ok(r.dlg.queryAllByText('Didn’t come').length >= 1, 'the badge');
  const unmarked = { ...marked, version: marked.version + 1, noShowAt: null, deposit: PAID };
  answer = { status: 200, ok: true, json: async () => unmarked };
  r.fireEvent.click(r.dlg.getByRole('button', { name: 'Undo' }));
  JOB = unmarked;
  await r.waitFor(() => assert.ok(r.dlg.queryByText('Marked Didn’t come · the deposit is kept') === null));
  assert.ok(posts().includes('/api/workshop-jobs/1/didnt-come {"version":3}'), posts().join('\n'));
  assert.ok(posts().some((p) => p.startsWith('/api/workshop-jobs/1/didnt-come/undo')), posts().join('\n'));
});

test('marked earlier and opened again: Didn’t come, and Book in if the bike turns up', async () => {
  const { dlg } = await openJob({ ...GONE, noShowAt: '2026-09-18T09:00:00Z', deposit: { ...PAID, state: 'kept', noShowAt: '2026-09-18T09:00:00Z', noShowBy: 'Jo Taylor' } });
  assert.ok(dlg.getByRole('button', { name: 'Book in' }));
  assert.ok(dlg.queryByRole('button', { name: 'Didn’t come' }) === null);
  assert.ok(dlg.queryByRole('button', { name: 'Put on hold' }) === null, 'a bike that didn’t come isn’t held');
  assert.ok(dlg.getByRole('button', { name: 'Refund the deposit' }), 'still refundable');
});

test('no deposit, and a day still to come: no strip', async () => {
  const { dlg } = await openJob({ jobDate: '2099-01-05' });
  assert.ok(dlg.queryByRole('group', { name: 'Deposit' }) === null);
});
