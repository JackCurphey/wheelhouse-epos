// The staff diary, piece 4: the phone diary (decision 68; drawn as
// diary-phone, waiting-open-phone and the selected bar in
// docs/design/user-journeys/generator/diary.mjs). Below 768px the diary is
// one day at a time: a strip of the week's days, one people chip, the "No
// time" row, a timeline, and "Waiting (n)" in the top bar opening a sheet.
// jsdom has no screen size, so matchMedia is stubbed to say "phone".
// Spec: docs/superpowers/specs/2026-10-03-staff-diary-view-design.md (piece 4)
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
  job({ id: 2, reference: 'WH-1002', title: 'Gear tune', bikeLabel: 'Brompton C Line', customerName: 'Oliver Chen', mechanicId: 12, mechanicName: 'Jo Taylor', startTime: '13:00', endTime: '14:00' }),
  job({ id: 3, reference: 'WH-1003', title: 'Full service', bikeLabel: 'Giant Escape', customerName: 'Priya Shah', jobDate: '2026-10-05' }),
  job({ id: 6, reference: 'WH-1006', title: 'Standard service', bikeLabel: 'Ribble CGR', customerName: 'Tom Hale', startTime: null, endTime: null }),
  job({ id: 7, reference: 'WH-1007', title: 'Puncture repair', bikeLabel: 'Specialized Sirrus', customerName: 'Sam Reed', mechanicId: null, jobDate: '2026-10-08', bookingState: 'pending', version: 2 }),
];
const NEXT_WEEK = [job({ id: 9, reference: 'WH-1009', title: 'Wheel true', bikeLabel: 'Cube Attain', customerName: 'Lena Fox', jobDate: '2026-10-13' })];
const WAITING = {
  count: 1,
  items: [{ kind: 'new_booking', jobId: 7, reference: 'WH-1007', jobDate: '2026-10-08', startTime: '10:00', endTime: '11:00', mechanicId: null, customerName: 'Sam Reed', serviceNames: ['Puncture repair'], services: [], arrivedAt: '2026-10-03T08:15:00Z' }],
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
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? 'GET' });
    const reply = (status, body) => ({ status, ok: status < 300, json: async () => body });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/employees') return reply(200, MECHANICS);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/workshop-waiting') return reply(200, WAITING);
    if (u.pathname === '/api/workshop-jobs') return reply(200, u.searchParams.get('start') === '2026-10-12' ? NEXT_WEEK : JOBS);
    const one = u.pathname.match(/^\/api\/workshop-jobs\/(\d+)$/);
    if (one) return reply(200, JOBS.find((j) => j.id === Number(one[1])));
    return reply(404, { error: 'Not found' });
  };
}

async function openPhone(query = '?date=2026-10-06') {
  uninstall = installDom(`http://localhost/workshop/diary${query}`);
  window.matchMedia = (q) => ({ matches: q.includes('max-width'), media: q, addEventListener() {}, removeEventListener() {} });
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  stubServer();
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByText('Trek Domane');
  return { ...rtl, ui };
}

const has = (q) => Boolean(q);

test('a phone shows one day, chosen in a strip of the week', async () => {
  const { ui } = await openPhone();
  assert.equal(ui.getByRole('tab', { name: 'Tuesday 6 October' }).getAttribute('aria-selected'), 'true');
  assert.equal(ui.getAllByRole('tab').length, 7);
  assert.ok(has(ui.queryByText('Brompton C Line')));
  assert.equal(has(ui.queryByText('Giant Escape')), false); // Monday's job
  assert.equal(has(ui.queryByRole('tab', { name: 'Week' })), false); // no Week/Day switch on a phone
});

test('tapping another day shows that day', async () => {
  const { ui, fireEvent } = await openPhone();
  fireEvent.click(ui.getByRole('tab', { name: 'Monday 5 October' }));
  assert.ok(has(await ui.findByText('Giant Escape')));
  assert.equal(has(ui.queryByText('Trek Domane')), false);
});

test('the week arrows move a week, keeping the weekday', async () => {
  const { ui, fireEvent } = await openPhone();
  assert.ok(has(ui.queryByText('5–11 Oct')));
  fireEvent.click(ui.getByRole('button', { name: 'Next week' }));
  assert.ok(has(await ui.findByText('12–18 Oct')));
  assert.equal((await ui.findByRole('tab', { name: 'Tuesday 13 October' })).getAttribute('aria-selected'), 'true');
  assert.ok(has(await ui.findByText('Cube Attain')));
});

test('jobs with no time sit in the No time row', async () => {
  const { ui, within } = await openPhone();
  assert.ok(has(within(ui.getByRole('group', { name: 'No time' })).queryByText('Ribble CGR')));
});

test('one people chip chooses Everyone, By mechanic, or one person', async () => {
  const { ui, fireEvent, within } = await openPhone();
  const chip = ui.getByRole('button', { name: 'Showing Everyone. Change whose jobs are shown' });
  fireEvent.click(chip);
  fireEvent.click(ui.getByRole('menuitemradio', { name: 'By mechanic' }));
  assert.ok(has(await ui.findByRole('group', { name: 'Alex Morgan' })));
  assert.ok(has(within(ui.getByRole('group', { name: 'Jo Taylor' })).queryByText('Brompton C Line')));
  fireEvent.click(ui.getByRole('button', { name: 'Showing By mechanic. Change whose jobs are shown' }));
  fireEvent.click(ui.getByRole('menuitemradio', { name: 'Jo Taylor' }));
  assert.ok(has(await ui.findByRole('button', { name: 'Showing Jo Taylor. Change whose jobs are shown' })));
  assert.equal(has(ui.queryByText('Trek Domane')), false);
  assert.ok(has(ui.queryByText('Brompton C Line')));
});

test('Waiting in the top bar opens the list; a card goes to its day and shows the chosen bar, and Open opens it', async () => {
  const { ui, fireEvent, within } = await openPhone();
  fireEvent.click(await ui.findByRole('button', { name: 'Waiting for you, 1' }));
  const sheet = within(await ui.findByRole('dialog', { name: 'Waiting for you (1)' }));
  fireEvent.click(sheet.getByRole('button', { name: /Sam Reed/ }));
  assert.equal((await ui.findByRole('tab', { name: 'Thursday 8 October' })).getAttribute('aria-selected'), 'true');
  const bar = within(await ui.findByRole('status', { name: 'Chosen from Waiting for you' }));
  assert.ok(has(bar.queryByText('Sam Reed')));
  fireEvent.click(bar.getByRole('button', { name: "Open Sam Reed's request" }));
  assert.ok(has(await ui.findByRole('heading', { name: /Sam Reed/ })));
  // Let the pop-up finish loading the job before the test ends.
  assert.ok(has(await ui.findByRole('button', { name: 'Accept' })));
});
