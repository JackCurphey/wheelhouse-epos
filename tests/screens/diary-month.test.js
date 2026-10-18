// The staff diary's month view (Jack, 18 Oct,
// docs/decisions/2026-10-18-old-diary-features.md answer 1 and its tablet and
// phone section): the weeks of the month, each day's first three jobs and
// "+[n] more", a day's list, and the arrows a month at a time.
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
  // Two more on Tuesday 6 October, so it has four: three show, "+1 more".
  job({ id: 8, reference: 'WH-1008', title: 'Wheel true', bikeLabel: 'Cube Attain', customerName: 'Lena Fox', jobDate: '2026-10-06', startTime: '09:00', endTime: '09:30' }),
  job({ id: 9, reference: 'WH-1009', title: 'Safety check', bikeLabel: 'Giant Escape', customerName: 'Priya Shah', jobDate: '2026-10-06', startTime: '14:00', endTime: '15:00' }),
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
    if (u.pathname === '/api/workshop-jobs') {
      const [from, to] = [u.searchParams.get('start'), u.searchParams.get('end')];
      return ok([...JOBS, ...NEXT_WEEK].filter((j) => j.jobDate >= from && j.jobDate <= to));
    }
    const one = u.pathname.match(/^\/api\/workshop-jobs\/(\d+)$/);
    if (one) return ok(JOBS.find((j) => j.id === Number(one[1])));
    return { status: 404, ok: false, json: async () => ({ error: 'Not found' }) };
  };
}

async function openDiary(query = '?date=2026-10-05', firstBike = 'Trek Domane', matchMedia = null) {
  uninstall = installDom(`http://localhost/workshop/diary${query}`);
  if (matchMedia) window.matchMedia = matchMedia;
  // jsdom has no <dialog> methods; the job page opens in one.
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
  if (firstBike) await ui.findByText(firstBike);
  return { ...rtl, ui };
}

const has = (q) => Boolean(q);

const MONTH_Q = '?date=2026-10-06&view=month';

test('Month shows the month\'s weeks, each day\'s first three jobs, earliest first, and "+[n] more"', async () => {
  const { ui, within } = await openDiary(MONTH_Q, null);
  assert.ok(has(await ui.findByText('October 2026')));
  const tue = within(await ui.findByRole('group', { name: 'Tuesday 6 October' }));
  assert.deepEqual(tue.getAllByRole('button', { name: /^\d\d:\d\d,/ }).map((b) => b.textContent), ['09:00Cube Attain', '10:00Trek Domane', '14:00Giant Escape']);
  assert.ok(has(tue.queryByRole('button', { name: '+1 more' })));
  assert.ok(calls.some((c) => c.includes('start=2026-09-28') && c.includes('end=2026-11-01')));
});

test('"+1 more" opens the day\'s list; its last line opens the day in the Day view', async () => {
  const { ui, within, fireEvent } = await openDiary(MONTH_Q, null);
  const tue = within(await ui.findByRole('group', { name: 'Tuesday 6 October' }));
  fireEvent.click(tue.getByRole('button', { name: '+1 more' }));
  const list = within(await ui.findByRole('dialog', { name: 'Tuesday 6 October' }));
  assert.ok(has(list.queryByText(/Ribble CGR/)));
  assert.ok(has(list.queryByText(/Cube Attain/)));
  fireEvent.click(list.getByRole('button', { name: 'Open this day in the Day view' }));
  assert.ok(has(await ui.findByRole('group', { name: 'Alex Morgan' })));
  assert.ok(window.location.search.includes('view=day'));
  assert.ok(window.location.search.includes('date=2026-10-06'));
});

test('a day\'s date opens it in the Day view', async () => {
  const { ui, fireEvent } = await openDiary(MONTH_Q, null);
  fireEvent.click(await ui.findByRole('button', { name: 'Open Thursday 8 October in the Day view' }));
  await ui.findByText('Thursday 8 October');
  assert.ok(window.location.search.includes('view=day'));
  assert.ok(window.location.search.includes('date=2026-10-08'));
});

test('a job in the month opens its page', async () => {
  const { ui, fireEvent } = await openDiary(MONTH_Q, null);
  fireEvent.click(await ui.findByRole('button', { name: /^10:00, Trek Domane/ }));
  assert.ok(has(await ui.findByRole('dialog', { name: /Brake service/ })));
});

test('Next month loads the next month', async () => {
  const { ui, fireEvent } = await openDiary(MONTH_Q, null);
  await ui.findByText('October 2026');
  fireEvent.click(ui.getByRole('button', { name: 'Next month' }));
  assert.ok(has(await ui.findByText('November 2026')));
  assert.ok(calls.some((c) => c.includes('start=2026-10-26') && c.includes('end=2026-12-06')));
});

test('on a touch screen, a tap anywhere in a day opens its list', async () => {
  const coarse = (q) => ({ matches: q.includes('pointer: coarse'), media: q, addEventListener() {}, removeEventListener() {} });
  const { ui, within, fireEvent } = await openDiary(MONTH_Q, null, coarse);
  // A real button over the day's jobs, so a keyboard, Switch Control or
  // Voice Control can open it too (fresh review).
  const thu = within(await ui.findByRole('group', { name: 'Thursday 8 October' }));
  fireEvent.click(thu.getByRole('button', { name: /^Show Thursday 8 October’s jobs/ }));
  assert.ok(has(await ui.findByRole('dialog', { name: 'Thursday 8 October' })));
  assert.ok(has(ui.queryByText('Tap a day to see its jobs.')));
  // The list's rows are the way to a job here; so the chips aren't tapped one by one.
  const tue = within(ui.getByRole('group', { name: 'Tuesday 6 October' }));
  assert.equal(has(tue.queryByRole('button', { name: /^10:00, Trek Domane/ })), false);
});

test('the month is a plain region, not a grid that arrow keys can\'t move in', async () => {
  const { ui } = await openDiary(MONTH_Q, null);
  assert.ok(has(await ui.findByRole('region', { name: 'Workshop diary, October 2026' })));
  assert.equal(has(ui.queryByRole('grid')), false);
});

test('switching to Month while choosing a time for New job stops choosing', async () => {
  const { ui, fireEvent } = await openDiary('?date=2026-10-06', 'Trek Domane');
  fireEvent.click(ui.getByRole('button', { name: 'New job' }));
  assert.ok(has(ui.queryByText('Choose a time for the new job.')));
  fireEvent.click(ui.getByRole('tab', { name: 'Month' }));
  await ui.findByText('October 2026');
  assert.equal(has(ui.queryByText(/Choose a time for the new job/)), false);
});
