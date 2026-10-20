// The staff diary, piece 5: New job (journey 12 decisions 16, 18, 22, 50, 66;
// drawn as new-job-pick, new-job and new-job-day in
// docs/design/user-journeys/generator/diary.mjs). New job puts the diary in
// "choose a time"; a click on the grid opens the form at that time, with the
// mechanic chosen for you. Only what the server saves is on the form.
// Spec: docs/superpowers/specs/2026-10-03-staff-diary-view-design.md (piece 5)
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
});

let addedBikes = [];
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
    if (method === 'POST' && u.pathname === '/api/workshop-jobs') return answer ?? reply(201, { ...JOBS[0], id: 50, version: 1 });
    if (method === 'POST' && u.pathname === '/api/customers/5/bikes') {
      const body = JSON.parse(init.body);
      const bike = { id: 8, customerId: 5, make: body.make, model: body.model, colour: body.colour, active: true };
      addedBikes.push(bike);
      return reply(201, bike);
    }
    if (method === 'POST') return reply(200, { ...JOBS[0], id: 50, version: 2 });
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/employees') return reply(200, MECHANICS);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
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

async function openDiary() {
  uninstall = installDom('http://localhost/workshop/diary?date=2026-10-05');
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  stubServer();
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByText('Trek Domane AL 3');
  return { ...rtl, ui };
}

// New job, then click Tuesday at 10:00 (the grid starts at 09:00; 29px a half hour).
async function pickTuesdayTen(r) {
  r.fireEvent.click(r.ui.getByRole('button', { name: 'New job' }));
  assert.ok(Boolean(r.ui.queryByText('Choose a time for the new job.')));
  r.fireEvent.click(r.ui.getByRole('group', { name: 'Tuesday 6 October' }), { clientY: 58 });
  return r.within(await r.ui.findByRole('dialog', { name: 'New job' }));
}

const posts = () => calls.filter((c) => c.method === 'POST').map((c) => `${c.url} ${JSON.stringify(c.body)}`);
const has = (q) => Boolean(q);

test('New job asks for a time; Cancel leaves the diary as it was', async () => {
  const r = await openDiary();
  r.fireEvent.click(r.ui.getByRole('button', { name: 'New job' }));
  assert.equal(r.ui.getByRole('button', { name: 'Choose a time' }).getAttribute('aria-pressed'), 'true');
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Cancel' }));
  assert.ok(has(r.ui.queryByRole('button', { name: 'New job' })));
  assert.equal(has(r.ui.queryByRole('dialog')), false);
});

test('a click on the grid opens the form at that time, with the mechanic with most free time chosen', async () => {
  const r = await openDiary();
  const form = await pickTuesdayTen(r);
  assert.ok(has(form.queryByText('Tue 6 Oct · 10:00 · Jo Taylor')));
  assert.equal(form.getByRole('radio', { name: 'Jo Taylor' }).getAttribute('aria-checked'), 'true');
});

test('choosing work fills the job title and its length; only active services are offered', async () => {
  const r = await openDiary();
  const form = await pickTuesdayTen(r);
  r.fireEvent.click(await form.findByRole('radio', { name: 'Full service' }));
  r.fireEvent.click(form.getByRole('radio', { name: 'Standard service · 90 min' }));
  assert.equal(form.getByLabelText('Job title').value, 'Standard service');
  assert.ok(has(form.queryByText('Tue 6 Oct · 10:00–11:30 · Jo Taylor')));
  r.fireEvent.click(form.getByRole('radio', { name: 'Individual service' }));
  assert.equal(has(form.queryByRole('radio', { name: /Old thing/ })), false);
});

test('a customer is found by name and their bike chosen; saving creates the job', async () => {
  const r = await openDiary();
  const form = await pickTuesdayTen(r);
  r.fireEvent.change(form.getByLabelText('Find customer by name, phone or email'), { target: { value: 'Maya' } });
  r.fireEvent.click(await form.findByRole('button', { name: /Maya Patel/ }));
  await r.waitFor(() => assert.ok(has(form.queryByRole('option', { name: 'Trek Domane AL 3 · green' }))));
  r.fireEvent.click(await form.findByRole('radio', { name: 'Full service' }));
  r.fireEvent.click(form.getByRole('radio', { name: 'Standard service · 90 min' }));
  r.fireEvent.click(form.getByRole('button', { name: 'Save job' }));
  await r.waitFor(() => assert.equal(has(r.ui.queryByRole('dialog')), false));
  assert.deepEqual(posts(), ['/api/workshop-jobs {"title":"Standard service","jobDate":"2026-10-06","startTime":"10:00","endTime":"11:30","customerId":5,"bikeId":7,"mechanicId":12,"status":"scheduled","notes":"","plannedMinutes":90}']);
});

test('"The bike is here now" books it in straight after saving', async () => {
  const r = await openDiary();
  const form = await pickTuesdayTen(r);
  r.fireEvent.change(form.getByLabelText('Find customer by name, phone or email'), { target: { value: 'Maya' } });
  r.fireEvent.click(await form.findByRole('button', { name: /Maya Patel/ }));
  r.fireEvent.change(form.getByLabelText('Job title'), { target: { value: 'Wobbly wheel' } });
  r.fireEvent.click(form.getByRole('switch', { name: 'The bike is here now' }));
  r.fireEvent.click(form.getByRole('button', { name: 'Save job' }));
  await r.waitFor(() => assert.equal(posts().length, 2));
  assert.equal(posts()[1], '/api/workshop-jobs/50/book-in {"version":1}');
});

test('"Waiting for parts" with the bike here saves once and closes: the server has already booked it in', async () => {
  // Jack, 8 Oct: the server puts a waiting-for-parts job's bike in the shop as
  // it creates it, so the book-in after it was refused, the form stayed open,
  // and a second Save could make a duplicate job.
  const r = await openDiary();
  const form = await pickTuesdayTen(r);
  r.fireEvent.change(form.getByLabelText('Find customer by name, phone or email'), { target: { value: 'Maya' } });
  r.fireEvent.click(await form.findByRole('button', { name: /Maya Patel/ }));
  r.fireEvent.change(form.getByLabelText('Job title'), { target: { value: 'Wobbly wheel' } });
  r.fireEvent.click(form.getByRole('radio', { name: 'Waiting for parts' }));
  r.fireEvent.click(form.getByRole('switch', { name: 'The bike is here now' }));
  answer = { status: 201, ok: true, json: async () => ({ ...JOBS[0], id: 50, version: 1, custodyState: 'in_shop', workState: 'waiting_parts' }) };
  r.fireEvent.click(form.getByRole('button', { name: 'Save job' }));
  await r.waitFor(() => assert.ok(r.ui.queryByRole('dialog', { name: 'New job' }) === null));
  assert.deepEqual(posts().map((p) => p.split(' ')[0]), ['/api/workshop-jobs']);
});

// Jack, 15 Oct (issue 192; drawn as new-job-entered): "Enter a time instead"
// opens the form with Date and Start time boxes, filled with the diary's day
// and the grid's first hour.
async function enterATime(r) {
  r.fireEvent.click(r.ui.getByRole('button', { name: 'New job' }));
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Enter a time instead' }));
  return r.within(await r.ui.findByRole('dialog', { name: 'New job' }));
}

test('Enter a time instead opens the form with Date and Start time boxes, filled in', async () => {
  const r = await openDiary();
  const form = await enterATime(r);
  assert.equal(form.getByLabelText('Date').value, '2026-10-05');
  assert.equal(form.getByLabelText('Start time').value, '09:00');
});

test('the date and time entered are the ones saved', async () => {
  const r = await openDiary();
  const form = await enterATime(r);
  r.fireEvent.change(form.getByLabelText('Date'), { target: { value: '2026-10-08' } });
  r.fireEvent.change(form.getByLabelText('Start time'), { target: { value: '14:30' } });
  r.fireEvent.change(form.getByLabelText('Job title'), { target: { value: 'PDI' } });
  r.fireEvent.click(form.getByRole('switch', { name: 'New bike build or pre-delivery check' }));
  r.fireEvent.click(form.getByRole('button', { name: 'Save job' }));
  await r.waitFor(() => assert.equal(posts().length, 1));
  const body = JSON.parse(posts()[0].split(' ').slice(1).join(' '));
  assert.deepEqual([body.jobDate, body.startTime, body.endTime], ['2026-10-08', '14:30', '15:30']);
});

test('a click on the grid shows no date or time box', async () => {
  const r = await openDiary();
  const form = await pickTuesdayTen(r);
  assert.ok(form.queryByLabelText('Date') === null);
  assert.ok(form.queryByLabelText('Start time') === null);
});

test('an empty date or time box is refused', async () => {
  const r = await openDiary();
  const form = await enterATime(r);
  r.fireEvent.change(form.getByLabelText('Start time'), { target: { value: '' } });
  r.fireEvent.change(form.getByLabelText('Job title'), { target: { value: 'PDI' } });
  r.fireEvent.click(form.getByRole('switch', { name: 'New bike build or pre-delivery check' }));
  r.fireEvent.click(form.getByRole('button', { name: 'Save job' }));
  assert.ok(has(await form.findByText('Choose a date and a start time.')));
  assert.equal(posts().length, 0);
});

// Decision 18 on the day entered: the mechanic is chosen again when the date
// changes, unless staff picked one themselves (fresh review, 15 Oct).
test('changing the date chooses the mechanic again, for the new day', async () => {
  const r = await openDiary();
  const form = await enterATime(r);
  assert.equal(form.getByRole('radio', { name: 'Alex Morgan' }).getAttribute('aria-checked'), 'true');
  r.fireEvent.change(form.getByLabelText('Date'), { target: { value: '2026-10-06' } });
  assert.equal(form.getByRole('radio', { name: 'Jo Taylor' }).getAttribute('aria-checked'), 'true');
  assert.ok(has(form.queryByText('Mechanic chosen automatically: most free time on Tuesday.')));
});

test('a mechanic picked by hand stays when the date changes', async () => {
  const r = await openDiary();
  const form = await enterATime(r);
  r.fireEvent.click(form.getByRole('radio', { name: 'Jo Taylor' }));
  r.fireEvent.change(form.getByLabelText('Date'), { target: { value: '2026-10-07' } });
  assert.equal(form.getByRole('radio', { name: 'Jo Taylor' }).getAttribute('aria-checked'), 'true');
  assert.ok(form.queryByText(/Mechanic chosen automatically/) === null);
});

async function saveEntered(r, form, time) {
  r.fireEvent.change(form.getByLabelText('Start time'), { target: { value: time } });
  r.fireEvent.change(form.getByLabelText('Job title'), { target: { value: 'PDI' } });
  r.fireEvent.click(form.getByRole('switch', { name: 'New bike build or pre-delivery check' }));
  r.fireEvent.click(form.getByRole('button', { name: 'Save job' }));
}

test('a start time off the quarter hour is refused, as the grid snaps to 15 minutes', async () => {
  const r = await openDiary();
  const form = await enterATime(r);
  await saveEntered(r, form, '14:37');
  assert.ok(has(await form.findByText('Choose a start time on the quarter hour, like 14:30 or 14:45.')));
  assert.equal(posts().length, 0);
});

test('a job that would run past midnight is refused in plain words', async () => {
  const r = await openDiary();
  const form = await enterATime(r);
  await saveEntered(r, form, '23:30');
  assert.ok(has(await form.findByText('The job would run past midnight. Choose an earlier start time.')));
  assert.equal(posts().length, 0);
});

test('a job needs a title, and a customer unless it is a new bike build', async () => {
  const r = await openDiary();
  const form = await pickTuesdayTen(r);
  r.fireEvent.click(form.getByRole('button', { name: 'Save job' }));
  assert.ok(has(await form.findByText('Give the job a title, and choose a customer or turn on New bike build.')));
  r.fireEvent.change(form.getByLabelText('Job title'), { target: { value: 'PDI' } });
  r.fireEvent.click(form.getByRole('switch', { name: 'New bike build or pre-delivery check' }));
  r.fireEvent.click(form.getByRole('button', { name: 'Save job' }));
  await r.waitFor(() => assert.equal(posts().length, 1));
  assert.equal(JSON.parse(posts()[0].split(' ').slice(1).join(' ')).customerId, null);
});

test('if the server refuses, the form says why and stays open', async () => {
  const r = await openDiary();
  const form = await pickTuesdayTen(r);
  r.fireEvent.change(form.getByLabelText('Job title'), { target: { value: 'PDI' } });
  r.fireEvent.click(form.getByRole('switch', { name: 'New bike build or pre-delivery check' }));
  answer = { status: 400, ok: false, json: async () => ({ error: 'Jo Taylor is off on that day' }) };
  r.fireEvent.click(form.getByRole('button', { name: 'Save job' }));
  assert.ok(has(await form.findByText('Jo Taylor is off on that day')));
  assert.ok(has(r.ui.queryByRole('dialog', { name: 'New job' })));
});

// Decision 23: New job warns when the work won't fit (drawn as new-job; the
// link's behaviour is Jack's answer of 15 Oct,
// docs/decisions/2026-10-15-new-job-wont-fit.md).
// Spec: openspec/changes/new-job-wont-fit
const WARN = 'Only 30 minutes free at 10:00 — this job needs 90. Choose another time, or save anyway and the diary will show the overlap.';
const joBusyAt1030 = (date, id) => (id === 12 && date === '2026-10-06' ? [{ start: '09:00', end: '10:30' }, { start: '12:00', end: '18:00' }] : [{ start: '09:00', end: '18:00' }]);

async function chooseWork(r, form, kind, name) {
  r.fireEvent.click(form.getByRole('radio', { name: kind }));
  r.fireEvent.click(await form.findByRole('radio', { name: new RegExp(`^${name}`) }));
}

test('work longer than the free time at the chosen start is warned about; Save job stays', async () => {
  const r = await openDiary();
  freeOn = joBusyAt1030;
  const form = await pickTuesdayTen(r);
  await chooseWork(r, form, 'Full service', 'Standard service');
  assert.ok(has(await form.findByText(WARN)));
  assert.ok(has(form.getByRole('button', { name: 'Find the next free 90 minutes' })));
  assert.equal(form.getByRole('button', { name: 'Save job' }).disabled, false);
});

test('work that fits, and the Shared queue, get no warning', async () => {
  const r = await openDiary();
  freeOn = joBusyAt1030;
  const form = await pickTuesdayTen(r);
  await chooseWork(r, form, 'Individual service', 'Brake adjust');
  await r.waitFor(() => assert.ok(calls.some((c) => c.url.includes('/api/workshop-capacity'))));
  assert.equal(has(form.queryByText(/minutes free at/)), false);
  await chooseWork(r, form, 'Full service', 'Standard service');
  await form.findByText(WARN);
  r.fireEvent.click(form.getByRole('radio', { name: 'Shared queue' }));
  assert.equal(has(form.queryByText(/minutes free at/)), false);
});

test('a start in busy time reads "No free time"', async () => {
  const r = await openDiary();
  freeOn = (date, id) => (id === 12 && date === '2026-10-06' ? [{ start: '12:00', end: '18:00' }] : [{ start: '09:00', end: '18:00' }]);
  const form = await pickTuesdayTen(r);
  await chooseWork(r, form, 'Full service', 'Standard service');
  assert.ok(has(await form.findByText('No free time at 10:00 — this job needs 90. Choose another time, or save anyway and the diary will show the overlap.')));
});

test('"Find the next free" moves the job to the mechanic\'s next gap that day, and the warning goes', async () => {
  const r = await openDiary();
  freeOn = joBusyAt1030;
  const form = await pickTuesdayTen(r);
  await chooseWork(r, form, 'Full service', 'Standard service');
  r.fireEvent.click(await form.findByRole('button', { name: 'Find the next free 90 minutes' }));
  assert.ok(has(await form.findByText('Tue 6 Oct · 12:00–13:30 · Jo Taylor')));
  assert.equal(has(form.queryByText(/free at/)), false);
  r.fireEvent.change(form.getByLabelText('Job title'), { target: { value: 'Standard service' } });
  r.fireEvent.click(form.getByRole('switch', { name: 'New bike build or pre-delivery check' }));
  r.fireEvent.click(form.getByRole('button', { name: 'Save job' }));
  await r.waitFor(() => assert.match(posts()[0], /"jobDate":"2026-10-06","startTime":"12:00","endTime":"13:30"/));
});

test('"Find the next free" goes on to a later day when that day has no gap', async () => {
  const r = await openDiary();
  freeOn = (date, id) => (id === 12 && date === '2026-10-06' ? [{ start: '09:00', end: '10:30' }] : [{ start: '09:00', end: '18:00' }]);
  const form = await pickTuesdayTen(r);
  await chooseWork(r, form, 'Full service', 'Standard service');
  r.fireEvent.click(await form.findByRole('button', { name: 'Find the next free 90 minutes' }));
  assert.ok(has(await form.findByText('Wed 7 Oct · 09:00–10:30 · Jo Taylor')));
});

test('"Find the next free" says so when there is none in 60 days', async () => {
  const r = await openDiary();
  freeOn = (date, id) => (id === 12 ? [{ start: '09:00', end: '10:00' }] : [{ start: '09:00', end: '18:00' }]);
  const form = await pickTuesdayTen(r);
  await chooseWork(r, form, 'Full service', 'Standard service');
  r.fireEvent.click(await form.findByRole('button', { name: 'Find the next free 90 minutes' }));
  assert.ok(has(await form.findByText('Jo Taylor has no free 90 minutes in the next 60 days.')));
});

test('saving with the warning showing saves at the time chosen', async () => {
  const r = await openDiary();
  freeOn = joBusyAt1030;
  const form = await pickTuesdayTen(r);
  await chooseWork(r, form, 'Full service', 'Standard service');
  await form.findByText(WARN);
  r.fireEvent.click(form.getByRole('switch', { name: 'New bike build or pre-delivery check' }));
  r.fireEvent.click(form.getByRole('button', { name: 'Save job' }));
  await r.waitFor(() => assert.match(posts()[0], /"jobDate":"2026-10-06","startTime":"10:00","endTime":"11:30"/));
});

test('from "Enter a time instead", the warning follows the time typed and the button fills the boxes', async () => {
  const r = await openDiary();
  freeOn = (date, id) => ([11, 12].includes(id) && date === '2026-10-06' ? [{ start: '09:00', end: '10:30' }, { start: '12:00', end: '18:00' }] : [{ start: '09:00', end: '18:00' }]);
  r.fireEvent.click(r.ui.getByRole('button', { name: 'New job' }));
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Enter a time instead' }));
  const form = r.within(await r.ui.findByRole('dialog', { name: 'New job' }));
  r.fireEvent.change(form.getByLabelText('Date'), { target: { value: '2026-10-06' } });
  r.fireEvent.change(form.getByLabelText('Start time'), { target: { value: '10:00' } });
  await chooseWork(r, form, 'Full service', 'Standard service');
  assert.ok(has(await form.findByText(WARN)));
  r.fireEvent.click(form.getByRole('button', { name: 'Find the next free 90 minutes' }));
  await r.waitFor(() => assert.equal(form.getByLabelText('Start time').value, '12:00'));
  assert.equal(form.getByLabelText('Date').value, '2026-10-06');
});

// After the fresh review.
test('"nothing found" goes when the mechanic changes', async () => {
  const r = await openDiary();
  freeOn = () => [{ start: '09:00', end: '10:00' }];
  const form = await pickTuesdayTen(r);
  await chooseWork(r, form, 'Full service', 'Standard service');
  r.fireEvent.click(await form.findByRole('button', { name: 'Find the next free 90 minutes' }));
  await form.findByText('Jo Taylor has no free 90 minutes in the next 60 days.');
  r.fireEvent.click(form.getByRole('radio', { name: 'Alex Morgan' }));
  await form.findByRole('button', { name: 'Find the next free 90 minutes' });
  assert.equal(has(form.queryByText(/has no free 90 minutes/)), false);
});

test('a search the server fails says so', async () => {
  const r = await openDiary();
  freeOn = joBusyAt1030;
  capacityDown = true;
  const form = await pickTuesdayTen(r);
  await chooseWork(r, form, 'Full service', 'Standard service');
  r.fireEvent.click(await form.findByRole('button', { name: 'Find the next free 90 minutes' }));
  assert.ok(has(await form.findByText("Couldn't find free time — try again.")));
});

test('after a move the focus is on the new time, and the automatic choice still names the day it was made for', async () => {
  const r = await openDiary();
  freeOn = (date, id) => (id === 12 && date === '2026-10-06' ? [{ start: '09:00', end: '10:30' }] : [{ start: '09:00', end: '18:00' }]);
  const form = await pickTuesdayTen(r);
  await chooseWork(r, form, 'Full service', 'Standard service');
  r.fireEvent.click(await form.findByRole('button', { name: 'Find the next free 90 minutes' }));
  const line = await form.findByText('Wed 7 Oct · 09:00–10:30 · Jo Taylor');
  await r.waitFor(() => assert.ok(document.activeElement === line));
  assert.ok(has(form.queryByText('Mechanic chosen automatically: most free time on Tuesday.')));
});

// new-job-pick: the slot under the pointer shows as a solid target with its
// time, before the click (drawn, not built until 16 Oct; Jack asked for it).
// Spec: openspec/changes/pick-hover-and-pointer
test('choosing a time, the slot under the pointer is highlighted with its time', async () => {
  const r = await openDiary();
  const col = () => r.ui.getByRole('group', { name: 'Tuesday 6 October' });
  const slot = () => r.ui.container.querySelector('[data-pick-slot]');
  r.fireEvent.pointerMove(col(), { pointerType: 'mouse', clientY: 58 });
  assert.equal(has(slot()), false, 'no highlight before New job');
  r.fireEvent.click(r.ui.getByRole('button', { name: 'New job' }));
  r.fireEvent.pointerMove(col(), { pointerType: 'mouse', clientY: 58 });
  assert.ok(has(slot()), 'the slot under the pointer is highlighted');
  assert.equal(slot().textContent, '10:00');
  r.fireEvent.pointerLeave(col(), { pointerType: 'mouse' });
  assert.equal(has(slot()), false, 'it goes when the pointer leaves');
});

// After the fresh review: a touch screen sends a pointer move before a tap,
// which must not show the highlight (on an iPad it could swallow the tap);
// and a highlight doesn't come back when New job is pressed again.
test('a touch shows no highlight, and the next New job starts without the last one', async () => {
  const r = await openDiary();
  const col = () => r.ui.getByRole('group', { name: 'Tuesday 6 October' });
  const slot = () => r.ui.container.querySelector('[data-pick-slot]');
  r.fireEvent.click(r.ui.getByRole('button', { name: 'New job' }));
  r.fireEvent.pointerMove(col(), { pointerType: 'touch', clientY: 58 });
  assert.equal(has(slot()), false, 'a touch shows no highlight');
  r.fireEvent.pointerMove(col(), { pointerType: 'mouse', clientY: 58 });
  assert.ok(has(slot()));
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Cancel' }));
  r.fireEvent.click(r.ui.getByRole('button', { name: 'New job' }));
  assert.equal(has(slot()), false, 'no highlight left over from last time');
});

// Jack, 16 Oct: the customer search drops down over the form, so New job
// keeps one size as he types (the size itself is checked in a real browser,
// tests/browser/diary-extras.spec.ts). Spec: openspec/changes/new-job-customer-dropdown
test('the customer search drops down over the form and closes on Escape', async () => {
  const r = await openDiary();
  const form = await pickTuesdayTen(r);
  const box = form.getByLabelText('Find customer by name, phone or email');
  r.fireEvent.change(box, { target: { value: 'zz' } });
  await form.findAllByText('No customer matches “zz”.');
  const list = r.ui.container.ownerDocument.querySelector('[data-customer-results]');
  assert.ok(has(list), 'the results are in their own drop-down');
  assert.match(list.className, /\babsolute\b/, 'the drop-down floats over the form');
  r.fireEvent.keyDown(box, { key: 'Escape' });
  assert.equal(has(r.ui.container.ownerDocument.querySelector('[data-customer-results]')), false, 'Escape closes the list');
  assert.ok(has(r.ui.queryByRole('dialog', { name: 'New job' })), 'and New job stays open');
  r.fireEvent.change(box, { target: { value: 'zzz' } });
  assert.ok((await form.findAllByText('No customer matches “zzz”.')).length > 0, 'typing opens it again');
  assert.ok(has(r.ui.container.ownerDocument.querySelector('[data-customer-results]')));
});

// After the fresh review. Safari and iPad don't focus a button on click, so
// the search box loses focus before the click lands: pressing a result must
// keep the focus where it is, or the list closes and no customer is chosen.
// Escape only acts when the list is showing; the result is announced.
test('pressing a result keeps the focus in the search, so Safari can choose it; the list is announced', async () => {
  const r = await openDiary();
  const form = await pickTuesdayTen(r);
  const box = form.getByLabelText('Find customer by name, phone or email');
  r.fireEvent.change(box, { target: { value: 'Maya' } });
  const maya = await form.findByRole('button', { name: /Maya Patel/ });
  assert.equal(r.fireEvent.mouseDown(maya), false, 'pressing a result keeps the focus in the search');
  assert.ok(has(form.queryByText('1 customer found.')), 'a screen reader hears how many were found');
  r.fireEvent.change(box, { target: { value: 'zz' } });
  await form.findAllByText('No customer matches “zz”.');
  r.fireEvent.change(box, { target: { value: 'z' } });
  const escape = r.fireEvent.keyDown(box, { key: 'Escape' });
  assert.equal(escape, true, 'with nothing showing, Escape is left for New job');
});

// Jack, 16 Oct: the "choose a time" bar floats at the bottom of the screen.
// Spec: openspec/changes/floating-diary-messages
test('the choose-a-time bar floats instead of pushing the diary down', async () => {
  const r = await openDiary();
  r.fireEvent.click(r.ui.getByRole('button', { name: 'New job' }));
  const bar = r.ui.getByText('Choose a time for the new job.');
  assert.ok(bar.closest('[data-floating]') !== null, 'the bar floats');
});

// After the fresh review: keyboard users land on the bar's first button, and
// the page gains room at the bottom so the bar can't hide the last hour.
test('New job puts the focus on Enter a time instead, and room is kept at the bottom for the bar', async () => {
  const r = await openDiary();
  r.fireEvent.click(r.ui.getByRole('button', { name: 'New job' }));
  await r.waitFor(() => assert.equal(document.activeElement?.textContent, 'Enter a time instead'));
  assert.ok(r.ui.container.querySelector('[data-floating-spacer]') !== null, 'room is kept at the bottom');
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Cancel' }));
  assert.ok(r.ui.container.querySelector('[data-floating-spacer]') === null);
});

// "+ Add a bike" (not-drawn pages row 22, answer C: the old job form's
// inline Make, Model, Colour and Serial number, with Cancel and Add bike).
async function withMaya(r) {
  const form = await pickTuesdayTen(r);
  r.fireEvent.change(form.getByLabelText('Find customer by name, phone or email'), { target: { value: 'Maya' } });
  r.fireEvent.click(await form.findByRole('button', { name: /Maya Patel/ }));
  await r.waitFor(() => assert.ok(has(form.queryByRole('option', { name: 'Trek Domane AL 3 · green' }))));
  return form;
}

test('+ Add a bike waits for a customer', async () => {
  const r = await openDiary();
  const form = await pickTuesdayTen(r);
  assert.equal(form.getByRole('button', { name: '+ Add a bike' }).disabled, true);
});

test('+ Add a bike adds the customer’s bike there and then, and chooses it', async () => {
  const r = await openDiary();
  const form = await withMaya(r);
  r.fireEvent.click(form.getByRole('button', { name: '+ Add a bike' }));
  r.fireEvent.change(form.getByLabelText('Make'), { target: { value: 'Brompton' } });
  r.fireEvent.change(form.getByLabelText('Model'), { target: { value: 'C Line' } });
  r.fireEvent.change(form.getByLabelText('Colour'), { target: { value: 'black' } });
  r.fireEvent.change(form.getByLabelText('Serial number'), { target: { value: 'BR123' } });
  r.fireEvent.click(form.getByRole('button', { name: 'Add bike' }));
  await r.waitFor(() => assert.deepEqual(posts(), ['/api/customers/5/bikes {"make":"Brompton","model":"C Line","colour":"black","serialNumber":"BR123"}']));
  await r.waitFor(() => assert.equal(form.getByLabelText('Bike').value, '8'));
  assert.equal(has(form.queryByLabelText('Make')), false, 'the fields close');
});

test('a bike needs a make or a model; Cancel closes the fields and adds nothing', async () => {
  const r = await openDiary();
  const form = await withMaya(r);
  r.fireEvent.click(form.getByRole('button', { name: '+ Add a bike' }));
  r.fireEvent.click(form.getByRole('button', { name: 'Add bike' }));
  assert.ok(has(await form.findByText('Enter a make or a model.')));
  r.fireEvent.click(form.getByRole('button', { name: 'Cancel adding a bike' }));
  assert.equal(has(form.queryByLabelText('Make')), false);
  assert.deepEqual(posts(), []);
});

