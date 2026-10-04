// The staff diary page (piece 1: seeing the week and the day), rendered in
// jsdom inside the real app shell with the server stubbed in its real shapes
// (serializeWorkshopJob, the waiting feed, employees, workshop settings).
// Spec: docs/superpowers/specs/2026-10-03-staff-diary-view-design.md
//
// The diary keeps its place in the address (?date=, ?view=, ?who=), so each
// test opens a fixed week. Assertions compare true/false or text, never
// elements: printing a jsdom element in a failure takes most of a minute.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const MECHANICS = [
  { id: 11, name: 'Alex Morgan', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5, 6], active: true },
  { id: 12, name: 'Jo Taylor', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true },
];
const SETTINGS = { openingHours: [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, open: '09:00', close: '18:00' })) };

function job(over) {
  return {
    id: 1, title: 'Brake service', reference: 'WH-1001', customerId: 5, customerName: 'Maya Patel', bikeId: 7, bikeLabel: 'Trek Domane',
    mechanicId: 11, mechanicName: 'Alex Morgan', jobDate: '2026-10-06', startTime: '10:00', endTime: '11:00', status: 'scheduled',
    bookingState: 'scheduled', custodyState: 'expected', workState: 'not_started', version: 3, notes: null, requested: null,
    cancelledBy: null, cancelledAt: null, cancellationSeenAt: null, changeDeclinedAt: null, orderId: null, orderStatus: null, orderTotal: null,
    createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z', ...over,
  };
}

const JOBS = [
  job({}),
  job({ id: 2, reference: 'WH-1002', title: 'Full service', bikeLabel: 'Brompton C Line', customerName: 'Oliver Chen', mechanicId: 12, mechanicName: 'Jo Taylor', jobDate: '2026-10-05', startTime: '10:00', endTime: '11:00',
    bookingState: 'reschedule_requested', requested: { jobDate: '2026-10-05', startTime: '14:00', endTime: '15:00', mechanicId: 12 } }),
  job({ id: 3, reference: 'WH-1003', title: 'Puncture repair', bikeLabel: 'Specialized Sirrus', customerName: 'Sam Reed', mechanicId: null, mechanicName: null, jobDate: '2026-10-09', startTime: '10:00', endTime: '10:45', bookingState: 'pending' }),
  job({ id: 4, reference: 'WH-1004', title: 'Safety check', bikeLabel: 'Cannondale Quick', customerName: 'Aisha Khan', jobDate: '2026-10-07', startTime: '13:00', endTime: '14:00', bookingState: 'cancelled', cancelledBy: 'customer' }),
  job({ id: 5, reference: 'WH-1005', title: 'Gear tune', bikeLabel: 'Giant Escape', customerName: 'Priya Shah', jobDate: '2026-10-08', startTime: '09:00', endTime: '10:00', bookingState: 'declined' }),
  job({ id: 6, reference: 'WH-1006', title: 'Standard service', bikeLabel: 'Ribble CGR', customerName: 'Tom Hale', jobDate: '2026-10-06', startTime: null, endTime: null }),
];
const NEXT_WEEK = [job({ id: 7, reference: 'WH-1007', title: 'Wheel true', bikeLabel: 'Cube Attain', customerName: 'Lena Fox', jobDate: '2026-10-14', startTime: '11:00', endTime: '12:00' })];
const WAITING = {
  count: 2,
  items: [
    { kind: 'new_booking', jobId: 3, reference: 'WH-1003', jobDate: '2026-10-09', startTime: '10:00', endTime: '10:45', mechanicId: null, mechanicName: null, customerName: 'Sam Reed', serviceNames: ['Puncture repair'], services: [], arrivedAt: '2026-10-03T08:00:00Z' },
    { kind: 'new_booking', jobId: 7, reference: 'WH-1007', jobDate: '2026-10-14', startTime: '11:00', endTime: '12:00', mechanicId: 11, mechanicName: 'Alex Morgan', customerName: 'Lena Fox', serviceNames: ['Wheel true'], services: [], arrivedAt: '2026-10-03T09:00:00Z' },
  ],
};

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

function stubServer() {
  calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    const ok = (body) => ({ status: 200, ok: true, json: async () => body });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return ok(OWNER);
    if (u.pathname === '/api/employees') return ok(MECHANICS);
    if (u.pathname === '/api/workshop-settings') return ok(SETTINGS);
    if (u.pathname === '/api/workshop-waiting') return ok(WAITING);
    if (u.pathname === '/api/workshop-jobs') return ok(u.searchParams.get('start') === '2026-10-12' ? NEXT_WEEK : JOBS);
    return { status: 404, ok: false, json: async () => ({ error: 'Not found' }) };
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

const has = (q) => Boolean(q);

test('a job sits in its own day, showing the bike and the job', async () => {
  const { ui, within } = await openDiary();
  const tue = within(ui.getByRole('group', { name: 'Tuesday 6 October' }));
  assert.ok(has(tue.queryByText('Trek Domane')));
  assert.ok(has(tue.queryByText('Brake service')));
  assert.ok(has(tue.queryByText('Trek Domane, Brake service, Maya Patel, WH-1001, Expected, 10:00–11:00')));
});

test('the week runs Monday to Sunday and is named in the toolbar', async () => {
  const { ui } = await openDiary();
  assert.ok(has(ui.queryByText('5–11 October 2026')));
  for (const day of ['Monday 5 October', 'Sunday 11 October']) assert.ok(has(ui.queryByRole('group', { name: day })), day);
});

test('a job with no time sits in the No time row', async () => {
  const { ui, within } = await openDiary();
  assert.ok(has(within(ui.getByRole('group', { name: 'No time' })).queryByText('Ribble CGR')));
});

test('a booking request is Pending, a change request shows where it asks to go, a customer cancellation stays until seen', async () => {
  const { ui, within } = await openDiary();
  assert.ok(has(ui.queryByText(/Specialized Sirrus, Puncture repair, Sam Reed, WH-1003, Pending/)));
  const mon = within(ui.getByRole('group', { name: 'Monday 5 October' }));
  assert.ok(has(mon.queryByText(/Brompton C Line, Full service, Oliver Chen, WH-1002, Change requested/)));
  assert.ok(has(mon.queryByText('Brompton C Line asks to move here: 14:00–15:00')));
  assert.ok(has(ui.queryByText(/Cannondale Quick, Safety check, Aisha Khan, WH-1004, Cancelled/)));
});

test('declined bookings are not drawn', async () => {
  const { ui } = await openDiary();
  assert.equal(has(ui.queryByText('Giant Escape')), false);
});

test('choosing a mechanic shows only their jobs; a request with no mechanic yet shows only under Everyone', async () => {
  const { ui, fireEvent } = await openDiary();
  const alex = ui.getByRole('button', { name: 'Alex Morgan' });
  assert.equal(ui.getByRole('button', { name: 'Everyone' }).getAttribute('aria-pressed'), 'true');
  fireEvent.click(alex);
  assert.equal(alex.getAttribute('aria-pressed'), 'true');
  assert.ok(has(ui.queryByText('Trek Domane')));
  assert.equal(has(ui.queryByText('Brompton C Line')), false);
  assert.equal(has(ui.queryByText('Specialized Sirrus')), false);
});

test('Next week loads the next week', async () => {
  const { ui, fireEvent } = await openDiary();
  fireEvent.click(ui.getByRole('button', { name: 'Next week' }));
  assert.ok(has(await ui.findByText('12–18 October 2026')));
  assert.ok(has(await ui.findByText('Cube Attain')));
  assert.ok(calls.some((c) => c.includes('start=2026-10-12') && c.includes('end=2026-10-18')));
});

test('Day view shows one column per mechanic for one day', async () => {
  const { ui, fireEvent, within } = await openDiary('?date=2026-10-06');
  fireEvent.click(ui.getByRole('tab', { name: 'Day' }));
  assert.ok(has(await ui.findByText('Tuesday 6 October')));
  const alex = within(await ui.findByRole('group', { name: 'Alex Morgan' }));
  assert.ok(has(alex.queryByText('Trek Domane')));
  assert.ok(has(alex.queryByText('Brake service · Expected')));
  assert.ok(has(ui.queryByRole('group', { name: 'Jo Taylor' })));
});

test('Waiting for you lists what needs an answer', async () => {
  const { ui, within } = await openDiary();
  const col = within(ui.getByRole('region', { name: 'Waiting for you (2)' }));
  assert.ok(has(col.queryByText('Sam Reed')));
  assert.ok(has(col.queryByText('Puncture repair · Fri 9 Oct, 10:00–10:45')));
  assert.equal(col.getAllByText('New booking request').length, 2);
});

test('choosing a waiting card moves the diary to its week and marks its job', async () => {
  const { ui, fireEvent, within } = await openDiary();
  const card = within(ui.getByRole('region', { name: 'Waiting for you (2)' })).getByRole('button', { name: /Lena Fox/ });
  fireEvent.click(card);
  assert.equal(card.getAttribute('aria-pressed'), 'true');
  assert.ok(has(await ui.findByText('12–18 October 2026')));
  assert.ok(has(await ui.findByText(/Cube Attain, Wheel true, Lena Fox, WH-1007, Expected, 11:00–12:00, chosen from Waiting for you/)));
});

test('the legend names each colour', async () => {
  const { ui, within } = await openDiary();
  const legend = within(ui.getByRole('list', { name: 'What the colours mean' }));
  for (const label of ['Expected, booked in or in the workshop', 'Pending', 'Quoting', 'Change requested', 'Waiting for parts', 'Finished', 'Cancelled']) assert.ok(has(legend.queryByText(label)), label);
});

// Follow-up to #112 (its fresh review, finding 5): a job chosen from Waiting
// for you stays marked when it sits in a stack.
test('a chosen job in a stack marks the stack', async () => {
  NEXT_WEEK.push(job({ id: 8, reference: 'WH-1008', title: 'Puncture repair', bikeLabel: 'Brompton', customerName: 'Sam Reed', jobDate: '2026-10-14', startTime: '11:00', endTime: '11:30' }));
  try {
    const { ui, fireEvent, within } = await openDiary();
    fireEvent.click(within(ui.getByRole('region', { name: 'Waiting for you (2)' })).getByRole('button', { name: /Lena Fox/ }));
    const stack = await ui.findByRole('button', { name: /^2 jobs booked 11:00 to 12:00/ });
    assert.ok(stack.getAttribute('aria-label').endsWith(', chosen from Waiting for you'));
  } finally {
    NEXT_WEEK.pop();
  }
});
