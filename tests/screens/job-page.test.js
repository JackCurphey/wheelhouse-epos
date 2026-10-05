// The staff job page, piece 1: opening a job from the diary and moving it on
// (journey 12 decisions 16, 30, 32, 35, 51, 58; drawn as job-overview,
// job-book-in, job-mechanic, job-waiting-parts, job-finished, job-collection).
// Spec: docs/superpowers/specs/2026-10-03-staff-job-page-design.md
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

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

const STAGES = [
  ['an expected bike is booked in', {}, 'Book in', 'book-in'],
  ['a bike in the shop has its work started', { custodyState: 'in_shop' }, 'Start work', 'start'],
  ['work in progress is marked ready', { custodyState: 'in_shop', workState: 'in_progress' }, 'Mark ready for collection', 'finish'],
  ['work in progress can wait for parts', { custodyState: 'in_shop', workState: 'in_progress' }, 'Waiting for parts', 'await-parts'],
  ['parts arriving restarts the work', { custodyState: 'in_shop', workState: 'waiting_parts' }, 'Parts arrived', 'parts-arrived'],
  ['paused work is resumed', { custodyState: 'in_shop', workState: 'on_hold' }, 'Resume', 'resume'],
  ['a finished bike is handed over', { custodyState: 'in_shop', workState: 'complete' }, 'Hand over', 'collect'],
];
for (const [name, over, button, action] of STAGES) {
  test(`${name}`, async () => {
    const { dlg, fireEvent, waitFor } = await openJob(over);
    fireEvent.click(dlg.getByRole('button', { name: button }));
    await waitFor(() => assert.deepEqual(posts(), [`/api/workshop-jobs/1/${action} {"version":3}`]));
  });
}

test('the status reads as staff say it at each stage', async () => {
  const cases = [[{}, 'Expected'], [{ custodyState: 'in_shop' }, 'In the workshop'], [{ custodyState: 'in_shop', workState: 'waiting_parts' }, 'Waiting for parts'],
    [{ custodyState: 'in_shop', workState: 'complete' }, 'Finished'], [{ custodyState: 'collected', workState: 'complete' }, 'Collected'],
    // Jack, 4 Oct: waiting for parts wins over a quote out, as in the diary.
    [{ custodyState: 'in_shop', workState: 'waiting_parts', quote: { state: 'sent' } }, 'Waiting for parts']];
  for (const [over, word] of cases) {
    const { dlg, cleanup } = await openJob(over);
    assert.ok(has(dlg.queryAllByText(word).length), word);
    cleanup();
    shell.queryClient.clear();
    uninstall();
  }
  uninstall = null;
});

test('a collected job has no stage button', async () => {
  const { dlg } = await openJob({ custodyState: 'collected', workState: 'complete' });
  for (const b of ['Book in', 'Start work', 'Hand over', 'Mark ready for collection']) assert.equal(has(dlg.queryByRole('button', { name: b })), false, b);
});

test('if someone else changed the job first, it says so', async () => {
  const r = await openJob();
  answer = { status: 409, ok: false, json: async () => ({ error: 'Job has been changed by someone else', code: 'stale' }) };
  r.fireEvent.click(r.dlg.getByRole('button', { name: 'Book in' }));
  assert.ok(has(await r.dlg.findByText('This job changed while you were looking at it.')));
});

test('M picks a job up to move it from the keyboard', async () => {
  JOB = job({});
  uninstall = installDom('http://localhost/workshop/diary?date=2026-10-05');
  stubServer();
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  const block = await ui.findByRole('button', { name: /^Trek Domane AL 3, Standard service/ });
  rtl.fireEvent.keyDown(block, { key: 'm' });
  assert.ok(has(ui.queryByText(/Moving Trek Domane AL 3\. Thu 8 Oct, 10:00–11:30\./)));
});
