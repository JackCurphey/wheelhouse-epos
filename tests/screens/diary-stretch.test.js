// The staff diary: changing a job's length (Jack, 18 Oct,
// docs/decisions/2026-10-18-old-diary-features.md answer 2 and its tablet and
// phone section). Dragging the bottom edge is checked in a real browser
// (tests/browser/diary-stretch.spec.ts); here, the way without dragging:
// "Change length" in the job's menu, then up and down in 15-minute steps,
// Enter to save, Escape to leave it. Saving is the move's own PUT.
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
let hours = [];
let waitingItems = [];
let saleFails = false;
const PAID_SALE = { id: 601, createdAt: '2026-10-06T10:45:00.000Z', subtotal: 65, discount: 0, groupDiscountAmount: 0, groupDiscountName: '', total: 65, paymentMethod: 'Card', cashAmount: 0, cardAmount: 65, cashTendered: null, extraPayments: [],
  items: [{ id: 1, name: 'Brake service', qty: 1, unitPrice: 65, lineTotal: 65 }] };
afterEach(async () => {
  hours = [];
  waitingItems = [];
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
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: hours });
    if (u.pathname === '/api/workshop-waiting') return reply(200, { count: waitingItems.length, items: waitingItems });
    if (u.pathname === '/api/workshop-jobs') return reply(200, JOBS);
    if (u.pathname === '/api/sale-documents/40') return reply(200, { id: 40, kind: 'order', status: 'converted', convertedSaleId: 601, items: [] });
    if (u.pathname === '/api/sales/601') return saleFails ? reply(500, { error: 'Internal error' }) : reply(200, PAID_SALE);
    return reply(404, { error: 'Not found' });
  };
}

async function openDiary(query = '?date=2026-10-05', matchMedia = null) {
  uninstall = installDom(`http://localhost/workshop/diary${query}`);
  if (matchMedia) window.matchMedia = matchMedia;
  // jsdom has no <dialog> methods; the request pop-up opens in one.
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  stubServer();
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  // A phone shows one day; the tests that use it open on the request's.
  if (!matchMedia) await ui.findByText('Trek Domane');
  return { ...rtl, ui };
}

const puts = () => calls.filter((c) => c.method === 'PUT').map((c) => `${c.url} ${JSON.stringify(c.body)}`);
const has = (q) => Boolean(q);
const block = (ui, name) => ui.getByRole('button', { name: new RegExp(`^${name}`) });

const openLength = async (ui, fireEvent, name) => {
  fireEvent.keyDown(block(ui, name), { key: 'ContextMenu' });
  const menu = await ui.findByRole('menu', { name: 'Job actions' });
  fireEvent.click((await import('@testing-library/react')).within(menu).getByRole('menuitem', { name: 'Change length' }));
};

test('Change length in the menu, then the arrows and Enter, saves the new end time', async () => {
  const { ui, fireEvent, waitFor } = await openDiary();
  await openLength(ui, fireEvent, 'Trek Domane');
  assert.ok(has(ui.queryByText(/Changing Trek Domane’s length\. 10:00–11:00 · 1 hour\./)));
  const b = block(ui, 'Trek Domane');
  fireEvent.keyDown(b, { key: 'ArrowDown' });
  fireEvent.keyDown(b, { key: 'ArrowDown' });
  assert.ok(has(ui.queryByText(/Changing Trek Domane’s length\. 10:00–11:30 · 1 hour 30 minutes\./)));
  fireEvent.keyDown(b, { key: 'Enter' });
  await waitFor(() => assert.deepEqual(puts(), ['/api/workshop-jobs/1 {"jobDate":"2026-10-06","startTime":"10:00","endTime":"11:30","version":3}']));
  assert.ok(has(await ui.findByText('Trek Domane now 10:00–11:30.')));
});

test('a job can\'t be made shorter than 15 minutes, or run past closing time', async () => {
  const { ui, fireEvent } = await openDiary();
  await openLength(ui, fireEvent, 'Trek Domane');
  const b = block(ui, 'Trek Domane');
  for (let i = 0; i < 6; i += 1) fireEvent.keyDown(b, { key: 'ArrowUp' });
  assert.ok(has(ui.queryByText(/10:00–10:15 · 15 minutes\./)));
  for (let i = 0; i < 40; i += 1) fireEvent.keyDown(b, { key: 'ArrowDown' });
  assert.ok(has(ui.queryByText(/10:00–18:00 · 8 hours\./)));
});

test('Escape leaves the length as it was', async () => {
  const { ui, fireEvent } = await openDiary();
  await openLength(ui, fireEvent, 'Trek Domane');
  const b = block(ui, 'Trek Domane');
  fireEvent.keyDown(b, { key: 'ArrowDown' });
  fireEvent.keyDown(b, { key: 'Escape' });
  assert.ok(has(ui.queryByText('Length unchanged. Trek Domane stays 10:00–11:00.')));
  assert.deepEqual(puts(), []);
});

test('a refused change says why', async () => {
  const { ui, fireEvent } = await openDiary();
  answer = { status: 400, body: { error: 'Alex Morgan already has a job at that time' } };
  await openLength(ui, fireEvent, 'Trek Domane');
  const b = block(ui, 'Trek Domane');
  fireEvent.keyDown(b, { key: 'ArrowDown' });
  fireEvent.keyDown(b, { key: 'Enter' });
  assert.ok(has(await ui.findByText("Couldn't change Trek Domane’s length: Alex Morgan already has a job at that time")));
});

test('a booking request\'s menu has no Change length', async () => {
  const { ui, fireEvent, within } = await openDiary();
  fireEvent.contextMenu(ui.getByTitle(/^Specialized Sirrus/));
  const menu = within(await ui.findByRole('menu', { name: 'Job actions' }));
  assert.ok(has(menu.queryByRole('menuitem', { name: 'Accept or decline' })));
  assert.equal(has(menu.queryByRole('menuitem', { name: 'Change length' })), false);
});

// Fresh review: the grid runs to the latest closing of the week, but a job
// stops at its own day's closing time.
test('a job stops at its own day\'s closing time, not the latest in the week', async () => {
  hours = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, open: '09:00', close: weekday === 2 ? '16:00' : '18:00' }));
  const { ui, fireEvent } = await openDiary();
  await openLength(ui, fireEvent, 'Trek Domane');
  const b = block(ui, 'Trek Domane');
  for (let i = 0; i < 40; i += 1) fireEvent.keyDown(b, { key: 'ArrowDown' });
  assert.ok(has(ui.queryByText(/10:00–16:00 · 6 hours\./)));
});

// Jack, 18 Oct (docs/decisions/2026-10-18-old-diary-features.md answer 4 and
// its touch section): a booking request's menu offers "Accept or decline",
// which opens the request pop-up, as from Waiting for you.
test('a booking request\'s menu offers Accept or decline, which opens its pop-up', async () => {
  const { ui, fireEvent, within } = await openDiary();
  fireEvent.contextMenu(ui.getByTitle(/^Specialized Sirrus/));
  const menu = within(await ui.findByRole('menu', { name: 'Job actions' }));
  // "Open in the till" is greyed on a request (Jack, 18 Oct), its reason underneath.
  assert.deepEqual(menu.getAllByRole('menuitem').map((m) => m.textContent), ['Accept or decline', 'View overview', 'Open in the tillNot booked yet', 'Print receiptNot paid yet']);
  fireEvent.click(menu.getByRole('menuitem', { name: 'Accept or decline' }));
  const dlg = within(await ui.findByRole('dialog', { name: /Sam Reed/ }));
  assert.ok(has(dlg.queryByRole('button', { name: 'Accept' })));
  assert.equal(has(ui.queryByRole('menu', { name: 'Job actions' })), false);
});

test('a booked job\'s menu still starts with Open job', async () => {
  const { ui, fireEvent, within } = await openDiary();
  fireEvent.keyDown(block(ui, 'Trek Domane'), { key: 'ContextMenu' });
  const menu = within(await ui.findByRole('menu', { name: 'Job actions' }));
  assert.equal(menu.getAllByRole('menuitem')[0].textContent, 'Open job');
  assert.equal(has(menu.queryByRole('menuitem', { name: 'Accept or decline' })), false);
});

// Fresh review: a real customer request comes from Waiting for you, with its services.
test('Accept or decline opens the request\'s own Waiting card, with its services', async () => {
  waitingItems = [{ kind: 'new_booking', jobId: 3, reference: 'WH-1003', jobDate: '2026-10-08', startTime: '10:00', endTime: '11:00', mechanicId: null, customerName: 'Sam Reed', serviceNames: ['Brake service', 'Gear tune'], services: [], arrivedAt: '2026-10-03T08:00:00Z' }];
  const { ui, fireEvent, within, waitFor } = await openDiary();
  // The Waiting list has loaded once its card shows.
  await ui.findByRole('button', { name: /New booking request/ });
  fireEvent.contextMenu(ui.getByTitle(/^Specialized Sirrus/));
  const menu = within(await ui.findByRole('menu', { name: 'Job actions' }));
  fireEvent.click(menu.getByRole('menuitem', { name: 'Accept or decline' }));
  const dlg = await ui.findByRole('dialog', { name: /Sam Reed/ });
  await waitFor(() => assert.ok(dlg.textContent.includes('Brake service, Gear tune')));
});

test('on a phone, a booking request\'s menu is headed "[job] · booking request", as drawn', async () => {
  const phone = (q) => ({ matches: q.includes('max-width'), media: q, addEventListener() {}, removeEventListener() {} });
  const { ui, fireEvent, within } = await openDiary('?date=2026-10-08', phone);
  fireEvent.contextMenu(await ui.findByTitle(/^Specialized Sirrus/));
  const menu = await ui.findByRole('menu', { name: 'Job actions' });
  assert.ok(has(within(menu).queryByText('Brake service · booking request')));
});

// Jack, 18 Oct (docs/decisions/2026-10-18-till-job-payment.md): "Open in the
// till" opens the till with the job's order; a booking request's is greyed,
// "Not booked yet", as drawn (diary-menu-job, diary-menu-pending).
test('Open in the till opens the till with the job', async () => {
  const keep = JOBS[0];
  JOBS[0] = { ...keep, orderId: 40, orderStatus: 'open' };
  try {
    const { ui, fireEvent, within, waitFor } = await openDiary();
    fireEvent.keyDown(block(ui, 'Trek Domane'), { key: 'ContextMenu' });
    const menu = within(await ui.findByRole('menu', { name: 'Job actions' }));
    fireEvent.click(menu.getByRole('menuitem', { name: 'Open in the till' }));
    await waitFor(() => assert.equal(`${window.location.pathname}${window.location.search}`, '/workshop/till?job=1'));
  } finally {
    JOBS[0] = keep;
  }
});

test('a booking request\'s Open in the till is greyed: Not booked yet', async () => {
  const { ui, fireEvent, within } = await openDiary();
  fireEvent.contextMenu(ui.getByTitle(/^Specialized Sirrus/));
  const menu = within(await ui.findByRole('menu', { name: 'Job actions' }));
  const till = menu.getByRole('menuitem', { name: /^Open in the till/ });
  assert.equal(till.getAttribute('aria-disabled'), 'true');
  assert.ok(has(within(till).queryByText('Not booked yet')));
});

test('a paid job\'s Open in the till is greyed: Already paid', async () => {
  const keep = JOBS[0];
  JOBS[0] = { ...keep, orderId: 40, orderStatus: 'converted' };
  try {
    const { ui, fireEvent, within } = await openDiary();
    fireEvent.keyDown(block(ui, 'Trek Domane'), { key: 'ContextMenu' });
    const menu = within(await ui.findByRole('menu', { name: 'Job actions' }));
    const till = menu.getByRole('menuitem', { name: /^Open in the till/ });
    assert.equal(till.getAttribute('aria-disabled'), 'true');
    assert.ok(has(within(till).queryByText('Already paid')));
  } finally {
    JOBS[0] = keep;
  }
});

test('a cancelled order\'s Open in the till is greyed: Order cancelled', async () => {
  const keep = JOBS[0];
  JOBS[0] = { ...keep, orderId: 40, orderStatus: 'cancelled' };
  try {
    const { ui, fireEvent, within } = await openDiary();
    fireEvent.keyDown(block(ui, 'Trek Domane'), { key: 'ContextMenu' });
    const menu = within(await ui.findByRole('menu', { name: 'Job actions' }));
    assert.ok(has(within(menu.getByRole('menuitem', { name: /^Open in the till/ })).queryByText('Order cancelled')));
  } finally {
    JOBS[0] = keep;
  }
});

// Printing a receipt (Jack, 18 Oct, docs/decisions/2026-10-18-print-receipt.md):
// "Print receipt" prints the receipt of the sale that paid the job's order;
// greyed "Not paid yet" until then, as drawn (diary-menu-job).
test('a paid job\'s Print receipt prints its sale\'s receipt, with the job and bike', async () => {
  const keep = JOBS[0];
  JOBS[0] = { ...keep, orderId: 40, orderStatus: 'converted' };
  let printed = null;
  try {
    const { ui, fireEvent, within, waitFor } = await openDiary();
    window.print = () => { printed = document.getElementById('wh-print')?.textContent ?? null; };
    fireEvent.keyDown(block(ui, 'Trek Domane'), { key: 'ContextMenu' });
    const menu = within(await ui.findByRole('menu', { name: 'Job actions' }));
    fireEvent.click(menu.getByRole('menuitem', { name: 'Print receipt' }));
    await waitFor(() => assert.ok(printed !== null, 'nothing was printed'));
    for (const want of ['North Street Cycles', 'Sale 601', 'WH-1001 · Trek Domane', 'Brake service£65.00', 'Total£65.00', 'Paid by card£65.00']) assert.ok(printed.includes(want), `missing "${want}" in: ${printed}`);
    assert.equal(has(ui.queryByRole('menu', { name: 'Job actions' })), false);
  } finally {
    JOBS[0] = keep;
  }
});

test('an open order\'s Print receipt is greyed: Not paid yet', async () => {
  const keep = JOBS[0];
  JOBS[0] = { ...keep, orderId: 40, orderStatus: 'open' };
  try {
    const { ui, fireEvent, within } = await openDiary();
    fireEvent.keyDown(block(ui, 'Trek Domane'), { key: 'ContextMenu' });
    const menu = within(await ui.findByRole('menu', { name: 'Job actions' }));
    const print = menu.getByRole('menuitem', { name: /^Print receipt/ });
    assert.equal(print.getAttribute('aria-disabled'), 'true');
    assert.ok(has(within(print).queryByText('Not paid yet')));
  } finally {
    JOBS[0] = keep;
  }
});

test('a cancelled order\'s Print receipt is greyed: Order cancelled', async () => {
  const keep = JOBS[0];
  JOBS[0] = { ...keep, orderId: 40, orderStatus: 'cancelled' };
  try {
    const { ui, fireEvent, within } = await openDiary();
    fireEvent.keyDown(block(ui, 'Trek Domane'), { key: 'ContextMenu' });
    const menu = within(await ui.findByRole('menu', { name: 'Job actions' }));
    const print = menu.getByRole('menuitem', { name: /^Print receipt/ });
    assert.equal(print.getAttribute('aria-disabled'), 'true');
    assert.ok(has(within(print).queryByText('Order cancelled')));
  } finally {
    JOBS[0] = keep;
  }
});

test('if the receipt can\'t be fetched, the diary says so and nothing prints', async () => {
  const keep = JOBS[0];
  JOBS[0] = { ...keep, orderId: 40, orderStatus: 'converted' };
  saleFails = true;
  let printed = false;
  try {
    const { ui, fireEvent, within } = await openDiary();
    window.print = () => { printed = true; };
    fireEvent.keyDown(block(ui, 'Trek Domane'), { key: 'ContextMenu' });
    const menu = within(await ui.findByRole('menu', { name: 'Job actions' }));
    fireEvent.click(menu.getByRole('menuitem', { name: 'Print receipt' }));
    assert.ok(has(await ui.findByText('Wheelhouse couldn’t get this job’s receipt to print. Try again in a moment.', {}, { timeout: 15000 })));
    assert.equal(printed, false);
  } finally {
    JOBS[0] = keep;
    saleFails = false;
  }
});
