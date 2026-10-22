// The staff job page, piece 1: opening a job from the diary and moving it on
// (journey 12 decisions 16, 30, 32, 35, 51, 58; drawn as job-overview,
// job-book-in, job-mechanic, job-waiting-parts, job-finished, job-collection).
// Spec: docs/superpowers/specs/2026-10-03-staff-job-page-design.md
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
  // Mark ready for collection asks who is signing it off first: tests/screens/job-sign-off.test.js.
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

// Jack, 15 Oct (issue #190): Put on hold, beside the main button, while the
// bike is expected or the work is not started, in progress or waiting for parts.
const HOLDS = [
  ['an expected bike', {}],
  ['a bike booked in', { custodyState: 'in_shop' }],
  ['work in progress', { custodyState: 'in_shop', workState: 'in_progress' }],
  ['work waiting for parts', { custodyState: 'in_shop', workState: 'waiting_parts' }],
];
for (const [name, over] of HOLDS) {
  test(`${name} can be put on hold`, async () => {
    const { dlg, fireEvent, waitFor } = await openJob(over);
    fireEvent.click(dlg.getByRole('button', { name: 'Put on hold' }));
    await waitFor(() => assert.deepEqual(posts(), ['/api/workshop-jobs/1/hold {"version":3}']));
  });
}

test('finished work and work on hold have no Put on hold', async () => {
  for (const over of [{ custodyState: 'in_shop', workState: 'complete' }, { custodyState: 'in_shop', workState: 'on_hold' }]) {
    const { dlg, cleanup } = await openJob(over);
    assert.ok(dlg.queryByRole('button', { name: 'Put on hold' }) === null, JSON.stringify(over));
    cleanup();
    shell.queryClient.clear();
    uninstall();
  }
  uninstall = null;
});

// Jack, 15 Oct: a refused move says why in plain words, from where the job is.
test('a move the job can no longer make says why in plain words', async () => {
  const r = await openJob();
  answer = { status: 409, ok: false, json: async () => ({ error: 'cannot book_in a job that is in_shop; from here you can collect', code: 'illegal' }) };
  r.fireEvent.click(r.dlg.getByRole('button', { name: 'Book in' }));
  assert.ok(has(await r.dlg.findByText('The bike is already here.')));
  assert.ok(r.dlg.queryByText(/book_in|in_shop/) === null);
  assert.ok(r.dlg.queryByText('This job changed while you were looking at it.') === null);
});

test('the status reads Change requested, Cancelled, Declined or Expired for those bookings', async () => {
  const { jobStage } = await import(new URL('../../.test-build/screens/diary/job-dialog.js', import.meta.url).href);
  const at = (bookingState, over = {}) => jobStage({ bookingState, custodyState: 'expected', workState: 'not_started', quote: null, ...over });
  // As the diary: only with the time the customer asked for.
  assert.equal(at('reschedule_requested', { requested: { jobDate: '2026-10-08', startTime: '14:00' } }), 'Change requested');
  assert.equal(at('reschedule_requested'), 'Expected');
  assert.equal(at('cancelled'), 'Cancelled');
  assert.equal(at('declined'), 'Declined');
  assert.equal(at('expired'), 'Expired');
  assert.equal(at('cancelled', { custodyState: 'in_shop' }), 'Cancelled');
  assert.equal(at('scheduled'), 'Expected');
});

// The diary marks a change request's block "Change requested" in amber; its
// job page says the same (Jack, 15 Oct, decision 4).
test('a change request\'s page reads Change requested, in the diary\'s amber', async () => {
  const { dlg } = await openJob({ bookingState: 'reschedule_requested', requested: { jobDate: '2026-10-08', startTime: '14:00', endTime: '15:30', mechanicId: 11 } });
  const badge = dlg.getAllByText('Change requested').find((el) => /wh-state-hold/.test(el.className));
  assert.ok(badge, 'a Change requested badge in the hold colours');
});

// A cancelled job can still be opened, from its block's menu: it can't be
// booked in from there (fresh review, 15 Oct).
test('a cancelled job opened from its menu reads Cancelled and can\'t be booked in', async () => {
  JOB = job({ bookingState: 'cancelled', cancelledBy: 'customer' });
  uninstall = installDom('http://localhost/workshop/diary?date=2026-10-05');
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  stubServer();
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  const label = await ui.findByText(/^Trek Domane AL 3, Standard service.*Cancelled/);
  rtl.fireEvent.contextMenu(label.parentElement, { clientX: 200, clientY: 200 });
  rtl.fireEvent.click(rtl.within(ui.getByRole('menu')).getByRole('menuitem', { name: 'Open job' }));
  const dlg = rtl.within(await ui.findByRole('dialog', { name: /Standard service/ }));
  await rtl.waitFor(() => assert.equal(Boolean(dlg.queryByText('Loading…')), false));
  assert.ok(has(dlg.getAllByText('Cancelled').length));
  assert.equal(dlg.getByRole('switch', { name: 'Bike is here' }).disabled, true);
});

// Notes typed but not saved don't stay in a box that has become read-only.
test('notes not saved before the work is finished are not shown as if saved', async () => {
  const { dlg, ui, within, fireEvent, waitFor } = await openJob({ custodyState: 'in_shop', workState: 'in_progress' });
  fireEvent.change(dlg.getByRole('textbox', { name: 'Notes' }), { target: { value: 'Typed, never saved' } });
  JOB = { ...JOB, workState: 'complete', version: 4 };
  fireEvent.click(dlg.getByRole('button', { name: 'Mark ready for collection' }));
  // It asks who is signing it off first (Jack, 16 Oct): Alex Morgan, the job's mechanic, is picked.
  const pop = within(await ui.findByRole('dialog', { name: 'Who’s signing this off?' }));
  await waitFor(() => assert.equal(pop.getByRole('button', { name: 'Sign off and mark ready' }).disabled, false));
  fireEvent.click(pop.getByRole('button', { name: 'Sign off and mark ready' }));
  await waitFor(() => assert.ok(has(dlg.queryByText('Reopen the job to change its notes.'))));
  assert.equal(dlg.getByRole('textbox', { name: 'Notes' }).value, 'Check the rear hub too.');
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

// As drawn (job-page.mjs jobPopupContent; Jack, 22 Oct, "so that the notes have
// more space on the page"): the job's details beside Notes in the wider
// column, then Work and parts across the full width below them.
test('the job’s details sit beside Notes, with Work and parts across the page below', async () => {
  const { dlg } = await openJob();
  const section = (name) => dlg.getByRole('heading', { name }).closest('section');
  const details = section('Job details');
  const notes = section('Notes');
  const work = section('Work and parts');
  const grid = details.parentElement.parentElement;
  assert.ok(grid.contains(notes), 'Notes is in the two columns with the details');
  assert.ok(details.parentElement !== notes.parentElement, 'in the other column');
  assert.ok(details.parentElement.compareDocumentPosition(notes.parentElement) & 4, 'Notes is the second column');
  assert.ok(!grid.contains(work), 'Work and parts is below both columns');
  assert.ok(grid.compareDocumentPosition(work) & 4, 'and after them');
});
