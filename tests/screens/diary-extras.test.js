// The staff diary, piece 5b: the hover summary, stacks of jobs that start at
// the same time, and the right-click menu with View overview (journey 12;
// diary-hover-summary, diary-stack-hover, diary-stack-open and
// diary-context-menu in docs/design/user-journeys/generator/diary.mjs).
// The fan itself is CSS hover, checked in a real browser
// (tests/browser/diary-extras.spec.ts).
// Spec: docs/superpowers/specs/2026-10-03-staff-diary-view-design.md (piece 5b)
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const MECHANICS = [{ id: 11, name: 'Alex Morgan', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true }];
function job(over) {
  return {
    id: 1, title: 'Standard service', reference: 'WH-1042', customerId: 5, customerName: 'Maya Patel', bikeId: 7, bikeLabel: 'Trek Domane',
    mechanicId: 11, mechanicName: 'Alex Morgan', jobDate: '2026-10-06', startTime: '10:00', endTime: '11:00', status: 'scheduled',
    bookingState: 'scheduled', custodyState: 'in_shop', workState: 'not_started', version: 3, notes: null, requested: null,
    customerDescription: null, cancelledBy: null, cancelledAt: null, cancellationSeenAt: null, orderId: null, orderStatus: null, orderTotal: null,
    createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z', quote: null, ...over,
  };
}
const ORDER = { id: 80, kind: 'order', status: 'open', subtotal: 93, discount: 0, total: 93, items: [
  { id: 1, productId: null, name: 'Standard service', sku: null, unitPrice: 75, qty: 1, lineTotal: 75, lineType: 'labour', serviceId: 1, minutes: 60 },
  { id: 2, productId: 40, name: 'Brake pads (pair)', sku: 'BP-01', unitPrice: 18, qty: 1, lineTotal: 18, lineType: 'product', serviceId: null, minutes: null },
] };
const QUOTE = { id: 9, workshopJobId: 1, revision: 1, state: 'partly_approved', lines: [
  { id: 1, kind: 'part', description: 'Brake pads (pair)', productId: 40, quantity: 1, unitAmount: 18, decision: 'approved', lineTotal: 18 },
  { id: 2, kind: 'labour', description: 'Replace gear cable', productId: null, quantity: 1, unitAmount: 12, decision: 'declined', lineTotal: 12 },
] };
let JOBS;

const realFetch = globalThis.fetch;
let uninstall;
let shell;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

let puts = [];
function stubServer() {
  puts = [];
  globalThis.fetch = async (url, init = {}) => {
    const reply = (status, body) => ({ status, ok: status < 300, json: async () => body });
    const u = new URL(url, 'http://localhost');
    if (init.method === 'PUT') {
      puts.push(`${u.pathname} ${init.body}`);
      return reply(200, { ...JOBS.find((j) => u.pathname.endsWith(`/${j.id}`)), version: 4 });
    }
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/employees') return reply(200, MECHANICS);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/workshop-waiting') return reply(200, { count: 0, items: [] });
    if (u.pathname === '/api/workshop-jobs') return reply(200, JOBS);
    const one = u.pathname.match(/^\/api\/workshop-jobs\/(\d+)$/);
    if (one) return reply(200, JOBS.find((j) => j.id === Number(one[1])));
    if (u.pathname === '/api/sale-documents/80') return reply(200, ORDER);
    if (u.pathname === '/api/quotes/9') return reply(200, QUOTE);
    if (u.pathname === '/api/workshop-services') return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
}

async function openDiary(jobs, { phone = false } = {}) {
  JOBS = jobs;
  // A phone shows one day, so it opens on the jobs' day.
  uninstall = installDom(`http://localhost/workshop/diary?date=${phone ? '2026-10-06' : '2026-10-05'}`);
  // jsdom has no screen size; a phone is stubbed as in diary-phone.test.js.
  if (phone) window.matchMedia = (q) => ({ matches: q.includes('max-width'), media: q, addEventListener() {}, removeEventListener() {} });
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  stubServer();
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  if (phone) await ui.findByText('Trek Domane');
  else await ui.findByRole('group', { name: 'Tuesday 6 October' });
  return { ...rtl, ui };
}

const has = (q) => Boolean(q);
const FULL = job({ orderId: 80, orderStatus: 'open', orderTotal: 93, notes: 'Front brake rubs at speed', customerDescription: 'Squeaky brakes', quote: { id: 9, state: 'partly_approved', revision: 1 } });
const block = (ui) => ui.findByRole('button', { name: /^Trek Domane, Standard service/ });

test('two jobs at the same time are one stack that opens a chooser; a tile opens that job', async () => {
  const { ui, fireEvent, within } = await openDiary([
    job({}),
    job({ id: 2, reference: 'WH-1043', bikeLabel: 'Specialized Sirrus', customerName: 'Sam Reed', title: 'Puncture repair', endTime: '11:30' }),
  ]);
  const stack = await ui.findByRole('button', { name: '2 jobs booked 10:00 to 11:30, click to choose which one to open: Trek Domane · Standard service (WH-1042), Specialized Sirrus · Puncture repair (WH-1043)' });
  assert.equal(has(ui.queryByRole('button', { name: /^Trek Domane, Standard service/ })), false);
  fireEvent.click(stack);
  const chooser = within(await ui.findByRole('dialog', { name: '2 jobs at 10:00' }));
  assert.ok(has(chooser.queryByText('Tuesday 6 October · choose one to open')));
  fireEvent.click(chooser.getByRole('button', { name: 'Specialized Sirrus, Puncture repair, WH-1043, Expected' }));
  assert.ok(has(await ui.findByRole('dialog', { name: /Puncture repair/ })));
});

test('jobs that only partly overlap stay side by side, not stacked', async () => {
  const { ui } = await openDiary([
    job({}),
    job({ id: 2, reference: 'WH-1043', bikeLabel: 'Specialized Sirrus', title: 'Puncture repair', startTime: '10:30', endTime: '11:30' }),
  ]);
  assert.ok(has(await block(ui)));
  assert.ok(has(ui.queryByRole('button', { name: /^Specialized Sirrus, Puncture repair/ })));
  assert.equal(has(ui.queryByRole('button', { name: /jobs booked/ })), false);
});

test('right-click shows Job actions; View overview shows notes, line items and the cost', async () => {
  const { ui, fireEvent, within } = await openDiary([FULL]);
  fireEvent.contextMenu(await block(ui), { clientX: 200, clientY: 200 });
  const menu = within(ui.getByRole('menu', { name: 'Job actions' }));
  assert.deepEqual(menu.getAllByRole('menuitem').map((m) => m.textContent), ['Open job', 'View overview']);
  assert.ok(has(menu.queryByText('Tip: hold the right mouse button to open the overview straight away.')));
  fireEvent.click(menu.getByRole('menuitem', { name: 'View overview' }));
  const box = within(await ui.findByRole('dialog', { name: 'Standard service · WH-1042' }));
  assert.ok(has(box.queryByText('Maya Patel · Trek Domane')));
  assert.ok(has(box.queryByText('Squeaky brakes')));
  assert.ok(has(box.queryByText('Front brake rubs at speed')));
  assert.ok(has(await box.findByText('Brake pads (pair)')));
  assert.ok(has(box.queryByText('£93.00')));
  const declined = await box.findByText('Replace gear cable');
  assert.ok(declined.closest('.line-through'));
  assert.equal(has(ui.queryByRole('menu')), false);
  fireEvent.click(box.getByRole('button', { name: 'Open job' }));
  assert.ok(has(await ui.findByRole('dialog', { name: /Standard service/ })));
});

test('Open job in the menu opens the job page', async () => {
  const { ui, fireEvent, within } = await openDiary([FULL]);
  fireEvent.contextMenu(await block(ui), { clientX: 200, clientY: 200 });
  fireEvent.click(within(ui.getByRole('menu')).getByRole('menuitem', { name: 'Open job' }));
  const page = await ui.findByRole('dialog', { name: /Standard service/ });
  assert.equal(page.getAttribute('aria-labelledby') === null, false);
});

test('Shift+F10 opens the menu from the keyboard; arrows move through it; Escape closes it and returns to the job', async () => {
  const { ui, fireEvent, within, waitFor } = await openDiary([FULL]);
  const b = await block(ui);
  b.focus();
  fireEvent.keyDown(b, { key: 'F10', shiftKey: true });
  const menu = within(ui.getByRole('menu', { name: 'Job actions' }));
  await waitFor(() => assert.equal(document.activeElement === menu.getByRole('menuitem', { name: 'Open job' }), true));
  fireEvent.keyDown(document.activeElement, { key: 'ArrowDown' });
  assert.equal(document.activeElement === menu.getByRole('menuitem', { name: 'View overview' }), true);
  fireEvent.keyDown(document.activeElement, { key: 'Escape' });
  assert.equal(has(ui.queryByRole('menu')), false);
  assert.equal(document.activeElement === b, true);
});

test('holding the right mouse button opens the overview straight away', async () => {
  const { ui, fireEvent, within } = await openDiary([FULL]);
  const b = await block(ui);
  fireEvent.pointerDown(b, { button: 2, pointerType: 'mouse', clientX: 200, clientY: 200 });
  const box = await ui.findByRole('dialog', { name: 'Standard service · WH-1042' }, { timeout: 2000 });
  assert.equal(has(ui.queryByRole('menu')), false);
  fireEvent.pointerUp(window, { pointerType: 'mouse' });
  await within(box).findByText('Replace gear cable');
});

test('resting the mouse on a job shows its summary; moving off hides it', async () => {
  const { ui, fireEvent, waitFor } = await openDiary([FULL]);
  const b = await block(ui);
  fireEvent.pointerEnter(b, { pointerType: 'mouse' });
  await waitFor(() => assert.ok(has(document.querySelector('[data-hover-summary]'))), { timeout: 2000 });
  const card = document.querySelector('[data-hover-summary]');
  assert.equal(card.getAttribute('aria-hidden'), 'true');
  assert.match(card.textContent, /Standard service · WH-1042/);
  await waitFor(() => assert.match(document.querySelector('[data-hover-summary]').textContent, /Cost£93\.00/));
  fireEvent.pointerLeave(b, { pointerType: 'mouse' });
  assert.equal(has(document.querySelector('[data-hover-summary]')), false);
});

test('press and hold on a touch screen shows the menu with the touch tip, and holding on opens the overview', async () => {
  const { ui, fireEvent, within } = await openDiary([FULL]);
  const b = await block(ui);
  fireEvent.pointerDown(b, { button: 0, pointerType: 'touch', clientX: 200, clientY: 200 });
  const menu = await ui.findByRole('menu', { name: 'Job actions' }, { timeout: 2000 });
  assert.ok(has(menu.textContent.includes('Tip: keep holding to see the job’s summary straight away.')));
  const box = await ui.findByRole('dialog', { name: 'Standard service · WH-1042' }, { timeout: 2000 });
  fireEvent.pointerUp(window, { pointerType: 'touch' });
  // Let its line items arrive before the test ends.
  await within(box).findByText('Replace gear cable');
  await new Promise((r) => setTimeout(r, 20));
});

test('the overview of a job with nothing on its order yet says so', async () => {
  const { ui, fireEvent, within } = await openDiary([job({ orderId: 81, orderStatus: 'open', orderTotal: 0 })]);
  const realStub = globalThis.fetch;
  globalThis.fetch = async (url, init) => (new URL(url, 'http://localhost').pathname === '/api/sale-documents/81'
    ? { status: 200, ok: true, json: async () => ({ id: 81, total: 0, items: [] }) }
    : realStub(url, init));
  fireEvent.contextMenu(await block(ui), { clientX: 200, clientY: 200 });
  fireEvent.click(within(ui.getByRole('menu')).getByRole('menuitem', { name: 'View overview' }));
  const box = within(await ui.findByRole('dialog', { name: 'Standard service · WH-1042' }));
  assert.ok(has(await box.findByText('£0.00')));
  assert.ok(has(box.queryByText('No work or parts yet.')));
});

// Fresh review of pull request 112, 4 Oct: stacking jobs must not take away
// what keyboard, screen-reader and touch users could do with each job before
// (spec: dragging is never the only way; Jack's accessibility-first rule).
const PAIR = () => [
  job({}),
  job({ id: 2, reference: 'WH-1043', bikeLabel: 'Specialized Sirrus', customerName: 'Sam Reed', title: 'Puncture repair', endTime: '11:30' }),
];
async function openChooser(t) {
  t.fireEvent.click(await t.ui.findByRole('button', { name: /^2 jobs booked 10:00 to 11:30/ }));
  return t.within(await t.ui.findByRole('dialog', { name: '2 jobs at 10:00' }));
}

test('a stacked job can be moved from the keyboard: M on its tile, the arrows, Enter', async () => {
  const t = await openDiary(PAIR());
  const chooser = await openChooser(t);
  t.fireEvent.keyDown(chooser.getByRole('button', { name: /^Specialized Sirrus, Puncture repair, WH-1043/ }), { key: 'm' });
  assert.equal(has(t.ui.queryByRole('dialog', { name: '2 jobs at 10:00' })), false);
  assert.ok(has(t.ui.queryByText(/Moving Specialized Sirrus\. Tue 6 Oct, 10:00–11:30\./)));
  await t.waitFor(() => assert.ok(document.activeElement?.getAttribute('title')?.startsWith('Specialized Sirrus, Puncture repair')));
  t.fireEvent.keyDown(document.activeElement, { key: 'ArrowDown' });
  t.fireEvent.keyDown(document.activeElement, { key: 'Enter' });
  await t.waitFor(() => assert.deepEqual(puts, ['/api/workshop-jobs/2 {"jobDate":"2026-10-06","startTime":"10:15","endTime":"11:45","version":3}']));
});

test('cancelling a stacked job’s move puts focus back on its stack', async () => {
  const t = await openDiary(PAIR());
  const chooser = await openChooser(t);
  t.fireEvent.keyDown(chooser.getByRole('button', { name: /^Specialized Sirrus/ }), { key: 'm' });
  await t.waitFor(() => assert.ok(document.activeElement?.getAttribute('title')?.startsWith('Specialized Sirrus')));
  t.fireEvent.keyDown(document.activeElement, { key: 'Escape' });
  await t.waitFor(() => assert.ok(document.activeElement?.getAttribute('aria-label')?.startsWith('2 jobs booked 10:00 to 11:30')));
  assert.deepEqual(puts, []);
});

test('the Menu key on a chooser tile opens that job’s menu', async () => {
  const t = await openDiary(PAIR());
  const chooser = await openChooser(t);
  t.fireEvent.keyDown(chooser.getByRole('button', { name: /^Specialized Sirrus/ }), { key: 'ContextMenu' });
  const menu = t.within(await t.ui.findByRole('menu', { name: 'Job actions' }));
  t.fireEvent.click(menu.getByRole('menuitem', { name: 'Open job' }));
  assert.ok(has(await t.ui.findByRole('dialog', { name: /Puncture repair/ })));
});

test('each chooser tile says the job’s state and how to move it', async () => {
  const t = await openDiary(PAIR());
  const chooser = await openChooser(t);
  const tile = chooser.getByRole('button', { name: 'Specialized Sirrus, Puncture repair, WH-1043, Expected' });
  assert.ok(has(tile.getAttribute('aria-describedby')));
});

test('press and hold on a stack on a touch screen fans it out', async () => {
  const t = await openDiary(PAIR());
  const stack = await t.ui.findByRole('button', { name: /^2 jobs booked 10:00 to 11:30/ });
  const fan = stack.parentElement.querySelector('[data-fan]');
  assert.equal(fan.dataset.open, undefined);
  t.fireEvent.pointerDown(stack, { button: 0, pointerType: 'touch', clientX: 200, clientY: 200 });
  await t.waitFor(() => assert.equal(fan.dataset.open, 'true'), { timeout: 2000 });
  t.fireEvent.pointerUp(window, { pointerType: 'touch' });
  t.fireEvent.click(stack);
  assert.equal(has(t.ui.queryByRole('dialog', { name: '2 jobs at 10:00' })), false);
});

test('the menu keeps its focus when the diary redraws', async () => {
  const t = await openDiary([FULL, job({ id: 3, reference: 'WH-1050', bikeLabel: 'Cube Attain', startTime: '14:00', endTime: '15:00' })]);
  const b = await block(t.ui);
  b.focus();
  t.fireEvent.keyDown(b, { key: 'F10', shiftKey: true });
  const menu = t.within(t.ui.getByRole('menu', { name: 'Job actions' }));
  await t.waitFor(() => assert.equal(document.activeElement === menu.getByRole('menuitem', { name: 'Open job' }), true));
  t.fireEvent.keyDown(document.activeElement, { key: 'ArrowDown' });
  // Someone else changes a job, and the fresh list redraws the diary while the menu is open.
  JOBS = JOBS.map((j) => (j.id === 3 ? { ...j, version: 9, updatedAt: '2026-10-05T09:00:00Z' } : j));
  await t.act(async () => { await shell.queryClient.invalidateQueries(); });
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(document.activeElement === menu.getByRole('menuitem', { name: 'View overview' }), true);
});

test('lifting a finger after a long press doesn’t open the job', async () => {
  const t = await openDiary([FULL]);
  const b = await block(t.ui);
  t.fireEvent.pointerDown(b, { button: 0, pointerType: 'touch', clientX: 200, clientY: 200 });
  await t.ui.findByRole('menu', { name: 'Job actions' }, { timeout: 2000 });
  t.fireEvent.pointerUp(window, { pointerType: 'touch' });
  t.fireEvent.click(b);
  // The job window opens at once (titled "Job" until it loads), so any dialog means it opened.
  assert.equal(has(t.ui.queryByRole('dialog')), false);
});

test('after a press and hold with no tap at the end, the next tap on the stack still opens the chooser', async () => {
  const t = await openDiary(PAIR());
  const stack = await t.ui.findByRole('button', { name: /^2 jobs booked 10:00 to 11:30/ });
  const fan = stack.parentElement.querySelector('[data-fan]');
  t.fireEvent.pointerDown(stack, { button: 0, pointerType: 'touch', clientX: 200, clientY: 200 });
  await t.waitFor(() => assert.equal(fan.dataset.open, 'true'), { timeout: 2000 });
  t.fireEvent.pointerUp(window, { pointerType: 'touch' });
  await new Promise((r) => setTimeout(r, 20));
  t.fireEvent.click(stack);
  assert.ok(has(await t.ui.findByRole('dialog', { name: '2 jobs at 10:00' })));
});

test('a booking request in a stack isn’t offered M, and M leaves the chooser open', async () => {
  const t = await openDiary([PAIR()[0], { ...PAIR()[1], bookingState: 'pending' }]);
  const chooser = await openChooser(t);
  const tile = chooser.getByRole('button', { name: /^Specialized Sirrus, Puncture repair, WH-1043, Pending/ });
  const hint = document.getElementById(tile.getAttribute('aria-describedby'));
  assert.equal(hint.textContent.includes('M to move'), false);
  t.fireEvent.keyDown(tile, { key: 'm' });
  assert.ok(has(t.ui.queryByRole('dialog', { name: '2 jobs at 10:00' })));
});

// Follow-up to #112: the chooser and the phone menu as drawn
// (diary-stack-open, diary-context-menu phone).
test('on a computer the chooser is a small box under the stack: focus on the first job, Escape back to the stack', async () => {
  const t = await openDiary(PAIR());
  const stack = await t.ui.findByRole('button', { name: /^2 jobs booked 10:00 to 11:30/ });
  t.fireEvent.click(stack);
  const box = await t.ui.findByRole('dialog', { name: '2 jobs at 10:00' });
  assert.equal(box.tagName, 'DIV'); // a box beside the stack, not a window over the diary
  const chooser = t.within(box);
  assert.ok(has(chooser.queryByText('Standard service · 10:00')));
  await t.waitFor(() => assert.equal(document.activeElement === chooser.getAllByRole('button')[0], true));
  t.fireEvent.keyDown(document.activeElement, { key: 'Escape' });
  assert.equal(has(t.ui.queryByRole('dialog', { name: '2 jobs at 10:00' })), false);
  assert.equal(document.activeElement === stack, true);
});

test('a tap on a stack shows each job’s number and times, as on the tablet', async () => {
  const t = await openDiary(PAIR());
  const stack = await t.ui.findByRole('button', { name: /^2 jobs booked 10:00 to 11:30/ });
  t.fireEvent.pointerDown(stack, { button: 0, pointerType: 'touch', clientX: 200, clientY: 200 });
  t.fireEvent.pointerUp(window, { pointerType: 'touch' });
  t.fireEvent.click(stack, { detail: 1 });
  const chooser = t.within(await t.ui.findByRole('dialog', { name: '2 jobs at 10:00' }));
  assert.ok(has(chooser.queryByText('WH-1043 · 10:00–11:30')));
  assert.ok(has(chooser.queryByText('Puncture repair')));
});

test('on a phone the job menu sheet says whose job it is', async () => {
  const t = await openDiary([FULL], { phone: true });
  const b = await block(t.ui);
  b.focus();
  t.fireEvent.keyDown(b, { key: 'F10', shiftKey: true });
  const menu = t.within(await t.ui.findByRole('menu', { name: 'Job actions' }));
  assert.ok(has(menu.queryByText('Standard service · WH-1042')));
  assert.ok(has(menu.queryByText('Maya Patel · Trek Domane')));
});
