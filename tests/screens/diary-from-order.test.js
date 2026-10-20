// An order's workshop job, from the old app's order screen (Jack, 20 Oct,
// docs/decisions/2026-10-18-retire-old-diary.md, changed 20 Oct): "View / edit
// workshop job" opens the diary at the job with its page open
// (?date=…&job=…); ticking "Show in workshop diary" opens the diary with New
// job filled in from the order (?order=…), and the saved job is linked to it.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const MECHANICS = [
  { id: 11, name: 'Alex Morgan', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true },
  { id: 12, name: 'Jo Taylor', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true },
];
const SERVICES = [
  { id: 1, name: 'Standard service', price: 60, minutes: 90, active: true, kind: 'full', categoryId: null, position: 1 },
  { id: 2, name: 'Brake adjust', price: 15, minutes: 30, active: true, kind: 'individual', categoryId: null, position: 2 },
  { id: 3, name: 'Old thing', price: 5, minutes: 15, active: false, kind: 'individual', categoryId: null, position: 3 },
];
const CUSTOMERS = [{ id: 5, name: 'Maya Patel', email: 'maya@example.test', phone: '07700 900142', active: true }];
const BIKES = [{ id: 7, customerId: 5, make: 'Trek', model: 'Domane AL 3', colour: 'green', active: true }];
// Alex already has two hours on Tuesday; Jo has none, so Jo is chosen.
const JOBS = [{
  id: 1, title: 'Full service', reference: 'WH-1001', customerId: 5, customerName: 'Maya Patel', bikeId: 7, bikeLabel: 'Trek Domane AL 3',
  mechanicId: 11, mechanicName: 'Alex Morgan', jobDate: '2026-10-06', startTime: '13:00', endTime: '15:00', status: 'scheduled',
  bookingState: 'scheduled', custodyState: 'expected', workState: 'not_started', version: 1, notes: null, requested: null,
  cancelledBy: null, cancelledAt: null, cancellationSeenAt: null, orderId: null, orderStatus: null, orderTotal: null,
  createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z',
}];

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let answer;
// Free time by day and mechanic, as GET /api/workshop-capacity gives it.
// Unless a test says otherwise everyone is free 09:00–18:00.
let freeOn;
let capacityDown;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
  // What a test set before opening the diary.
  orderPut = null;
  settings = { openingHours: [] };
  bookIn = null;
  order = null;
});

let addedBikes = [];
let orderPut = null;
let settings = { openingHours: [] };
let bookIn = null;
let order = null;
function stubServer() {
  calls = [];
  addedBikes = [];
  answer = null;
  freeOn = () => [{ start: '09:00', end: '18:00' }];
  capacityDown = false;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ url, method, body: init.body ? JSON.parse(init.body) : undefined });
    const reply = (status, body) => ({ status, ok: status < 300, json: async () => body });
    const u = new URL(url, 'http://localhost');
    if (method === 'POST' && u.pathname === '/api/workshop-jobs/50/book-in' && bookIn) return bookIn;
    if (method === 'POST' && u.pathname === '/api/workshop-jobs') return answer ?? reply(201, { ...JOBS[0], id: 50, version: 1 });
    if (method === 'POST' && u.pathname === '/api/customers/5/bikes') {
      const body = JSON.parse(init.body);
      const bike = { id: 8, customerId: 5, make: body.make, model: body.model, colour: body.colour, active: true };
      addedBikes.push(bike);
      return reply(201, bike);
    }
    if (method === 'POST') return reply(200, { ...JOBS[0], id: 50, version: 2 });
    if (method === 'PUT' && u.pathname === '/api/sale-documents/9') return orderPut ?? reply(200, { ...ORDER, workshopJobId: 50 });
    if (u.pathname === '/api/workshop-jobs/1') return reply(200, JOBS[0]);
    if (u.pathname === '/api/sale-documents/9') return reply(200, order ?? ORDER);
    if (u.pathname === '/api/workshop-jobs/5') return reply(200, { ...JOBS[0], id: 5, title: 'Gear service', bookingState: 'offered', offer: { fromDate: '2026-10-06', fromTime: '10:00', message: null } });
    if (u.pathname === '/api/customers/5') return reply(200, CUSTOMERS[0]);
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/employees') return reply(200, MECHANICS);
    if (u.pathname === '/api/workshop-settings') return reply(200, settings);
    if (u.pathname === '/api/workshop-waiting') return reply(200, { count: 0, items: [] });
    if (u.pathname === '/api/workshop-jobs') return reply(200, JOBS);
    if (u.pathname === '/api/workshop-services') return reply(200, SERVICES);
    if (u.pathname === '/api/workshop-capacity') {
      if (capacityDown && u.searchParams.get('start') !== u.searchParams.get('end')) return reply(500, { error: 'Something broke' });
      const days = [];
      for (let d = new Date(`${u.searchParams.get('start')}T12:00:00Z`); d.toISOString().slice(0, 10) <= u.searchParams.get('end'); d.setUTCDate(d.getUTCDate() + 1)) {
        const date = d.toISOString().slice(0, 10);
        days.push({ date, mechanics: MECHANICS.map((m) => ({ mechanicId: m.id, working: true, freeWindows: freeOn(date, m.id) })) });
      }
      return reply(200, { days });
    }
    if (u.pathname === '/api/customers') return reply(200, CUSTOMERS.filter((c) => c.name.toLowerCase().includes((u.searchParams.get('search') || '').toLowerCase())));
    if (u.pathname === '/api/customers/5/bikes') return reply(200, [...BIKES, ...addedBikes]);
    return reply(404, { error: 'Not found' });
  };
}

async function openDiary(query) {
  uninstall = installDom(`http://localhost/workshop/diary${query}`);
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


const ORDER = { id: 9, kind: 'order', status: 'open', title: 'Wheel build', customerId: 5, customerName: 'Maya Patel', note: 'Rims ordered', workshopJobId: null, items: [] };

const has = (q) => Boolean(q);
const puts = () => calls.filter((c) => c.method === 'PUT').map((c) => `${c.url} ${JSON.stringify(c.body)}`);

test('?job= opens that job’s page on the day asked, and leaves the address', async () => {
  const r = await openDiary('?date=2026-10-06&job=1');
  assert.ok(has(await r.ui.findByRole('dialog', { name: /Full service/ })));
  assert.equal(new URL(window.location.href).searchParams.get('job'), null);
  assert.equal(new URL(window.location.href).searchParams.get('date'), '2026-10-06');
});

test('?order= opens New job with the order’s title, customer and note, at a time to enter', async () => {
  const r = await openDiary('?date=2026-10-05&order=9');
  const form = r.within(await r.ui.findByRole('dialog', { name: 'New job' }));
  assert.equal(form.getByLabelText('Job title').value, 'Wheel build');
  assert.ok(has(await form.findByText('Maya Patel')));
  assert.equal(form.getByLabelText('Staff notes').value, 'Rims ordered');
  assert.equal(form.getByLabelText('Date').value, '2026-10-05');
  assert.equal(new URL(window.location.href).searchParams.get('order'), null);
});

test('saving New job for an order links the job to the order', async () => {
  const r = await openDiary('?date=2026-10-05&order=9');
  const form = r.within(await r.ui.findByRole('dialog', { name: 'New job' }));
  await form.findByText('Maya Patel');
  r.fireEvent.click(form.getByRole('button', { name: 'Save job' }));
  await r.waitFor(() => assert.equal(has(r.ui.queryByRole('dialog', { name: 'New job' })), false));
  assert.deepEqual(puts(), ['/api/sale-documents/9 {"workshopJobId":50}']);
});

test('a link the server refuses says the job is saved but not linked', async () => {
  const r = await openDiary('?date=2026-10-05&order=9');
  const form = r.within(await r.ui.findByRole('dialog', { name: 'New job' }));
  await form.findByText('Maya Patel');
  orderPut = { status: 400, ok: false, json: async () => ({ error: 'This order is already completed' }) };
  r.fireEvent.click(form.getByRole('button', { name: 'Save job' }));
  assert.ok(has(await r.ui.findByText('The job is saved, but couldn’t be linked to the order: This order is already completed')));
  assert.equal(has(r.ui.queryByRole('dialog', { name: 'New job' })), false);
});

test('an order that can’t be read opens nothing and says so', async () => {
  const r = await openDiary('?date=2026-10-05&order=404');
  assert.ok(has(await r.ui.findByText('Couldn’t open that order: Not found')));
  assert.equal(has(r.ui.queryByRole('dialog', { name: 'New job' })), false);
});

// Fresh review, 20 Oct: the form waited for nothing, so it opened before the
// mechanics and opening hours had loaded.
test('the order’s New job chooses the freest mechanic and the shop’s first hour, as Enter a time instead does', async () => {
  settings = { openingHours: [{ weekday: 2, open: '10:00', close: '17:00' }] };
  const r = await openDiary('?date=2026-10-06&order=9');
  const form = r.within(await r.ui.findByRole('dialog', { name: 'New job' }));
  await form.findByText('Maya Patel');
  r.fireEvent.click(form.getByRole('button', { name: 'Save job' }));
  await r.waitFor(() => assert.ok(calls.some((c) => c.method === 'POST' && c.url === '/api/workshop-jobs')));
  const body = calls.find((c) => c.method === 'POST' && c.url === '/api/workshop-jobs').body;
  assert.equal(body.mechanicId, 12, 'Jo has the most free time on Tuesday');
  assert.equal(body.startTime, '10:00');
});

test('a book-in refused after the job is saved still links it, closes the form and says so', async () => {
  const r = await openDiary('?date=2026-10-05&order=9');
  const form = r.within(await r.ui.findByRole('dialog', { name: 'New job' }));
  await form.findByText('Maya Patel');
  r.fireEvent.click(form.getByRole('switch', { name: /The bike is here now/ }));
  bookIn = { status: 409, ok: false, json: async () => ({ error: 'This job changed while you were looking at it.', code: 'stale' }) };
  r.fireEvent.click(form.getByRole('button', { name: 'Save job' }));
  await r.waitFor(() => assert.equal(has(r.ui.queryByRole('dialog', { name: 'New job' })), false));
  assert.deepEqual(puts(), ['/api/sale-documents/9 {"workshopJobId":50}']);
  assert.ok(has(r.ui.getByText(/^The job is saved, but couldn’t be booked in: This job changed while you were looking at it\.$/)));
});

test('an order no longer open isn’t put in the diary, and says why', async () => {
  order = { ...ORDER, status: 'completed' };
  const r = await openDiary('?date=2026-10-05&order=9');
  assert.ok(has(await r.ui.findByText('That order is already completed, so it can’t go in the diary.')));
  assert.equal(has(r.ui.queryByRole('dialog', { name: 'New job' })), false);
});

test('an order that already has a job opens that job instead', async () => {
  order = { ...ORDER, workshopJobId: 1 };
  const r = await openDiary('?date=2026-10-05&order=9');
  assert.ok(has(await r.ui.findByRole('dialog', { name: /Full service/ })));
  assert.equal(has(r.ui.queryByRole('dialog', { name: 'New job' })), false);
  assert.equal(calls.filter((c) => c.method !== 'GET' && c.method !== undefined).length, 0);
});

test('?job= for an offered time opens its request pop-up, as its block does', async () => {
  const r = await openDiary('?date=2026-10-05&job=5');
  assert.ok(has(await r.ui.findByRole('dialog', { description: 'Time offered' })));
});
