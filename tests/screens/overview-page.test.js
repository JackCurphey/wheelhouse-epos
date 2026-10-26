// The Workshop Overview (Jack, 21 Oct, docs/decisions/2026-10-21-workshop-overview.md;
// drawn as overview in generator/diary.mjs; openspec/changes/workshop-overview):
// today's figures, four tabs of jobs, Book in for an arrival that's due, and
// each job opening in the diary. Planned effort waits for Mark's capacity figures.
import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

import { fakeJob, changed } from '../helpers/fake-job.js';
const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
// Wednesday 21 October 2026, 10:00 in the shop.
const NOW = new Date(2026, 9, 21, 10, 0, 0);
const TODAY = '2026-10-21';
const job = (over) => fakeJob({
  id: 1, title: 'Standard service', reference: 'WH-1042', customerId: 5, customerName: 'Maya Patel', bikeId: 7, bikeLabel: 'Trek Domane AL 3',
  mechanicId: 11, mechanicName: 'Alex Morgan', jobDate: TODAY, startTime: '10:30', endTime: '12:00', version: 3,
  createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z', ...over,
});
// Today's arrivals: due now, later today, and a drop-off with no time and no mechanic.
const MAYA = job({});
const JAMIE = job({ id: 2, reference: 'WH-1045', title: 'Gear adjustment', customerName: 'Jamie Brooks', bikeLabel: 'Giant Escape 2', startTime: '14:00', endTime: '15:00' });
// As the server sends it: a drop-off's day has an empty start time (fresh review, 21 Oct).
const AISHA = job({ id: 3, reference: 'WH-1047', title: 'Safety check', customerName: 'Aisha Khan', bikeLabel: 'Cannondale Quick', startTime: null, endTime: null, mechanicId: null, mechanicName: null,
  parts: [{ id: 31, position: 1, date: TODAY, startTime: '', endTime: '', mechanicId: null, mechanicName: null }] });
// A request still waiting for the shop: not a booking yet, so not counted.
const REQUEST = job({ id: 4, reference: 'WH-1048', title: 'Puncture repair', customerName: 'Sam Reed', bikeLabel: 'Specialized Sirrus', startTime: '11:00', bookingState: 'pending' });
// In the shop since earlier days.
const PARTS = job({ id: 5, reference: 'WH-1050', title: 'Wheel build', customerName: 'Oliver Chen', bikeLabel: 'Brompton C Line', jobDate: '2026-10-19', startTime: '09:00', custodyState: 'in_shop', workState: 'waiting_parts' });
const READY = job({ id: 6, reference: 'WH-1051', title: 'Brake bleed', customerName: 'Priya Shah', bikeLabel: 'Ribble CGR', jobDate: '2026-10-20', startTime: '13:00', custodyState: 'in_shop', workState: 'complete' });
const QUEUED = job({ id: 7, reference: 'WH-1052', title: 'Gear service', customerName: 'Tom Hale', bikeLabel: 'Boardman ADV', jobDate: '2026-10-20', startTime: '15:00', custodyState: 'in_shop', workState: 'in_progress', mechanicId: null, mechanicName: null });

// Started yesterday with Alex; today's day is in the shared queue, and the bike isn't in yet.
const TWO_DAY = job({ id: 8, reference: 'WH-1053', title: 'Full rebuild', customerName: 'Ella Ward', bikeLabel: 'Surly Cross-Check', jobDate: '2026-10-20', startTime: '09:00',
  parts: [{ id: 81, position: 1, date: '2026-10-20', startTime: '09:00', endTime: '17:00', mechanicId: 11, mechanicName: 'Alex Morgan' }, { id: 82, position: 2, date: TODAY, startTime: '09:30', endTime: '12:00', mechanicId: null, mechanicName: null }] });

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let bookIn;
let booked;
let capacity = null;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
  mock.timers.reset();
  capacity = null;
});

async function openOverview({ phone = false, coarse = false, inShopDown = false, extra = [], interval = false } = {}) {
  calls = [];
  bookIn = null;
  booked = false;
  mock.timers.enable({ apis: interval ? ['Date', 'setInterval'] : ['Date'], now: NOW });
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ url, method, body: init.body ? JSON.parse(init.body) : undefined });
    const reply = (status, body) => ({ status, ok: status < 300, json: async () => body });
    const u = new URL(url, 'http://localhost');
    const maya = booked ? { ...MAYA, custodyState: 'in_shop', version: 4 } : MAYA;
    if (method === 'POST' && u.pathname === '/api/workshop-jobs/3/book-in') return reply(200, changed({ ...AISHA, custodyState: 'in_shop', version: 4 }));
    if (method === 'POST' && u.pathname === '/api/workshop-jobs/1/book-in') {
      if (bookIn) return bookIn;
      booked = true;
      return reply(200, changed({ ...MAYA, custodyState: 'in_shop', version: 4 }));
    }
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/workshop-capacity' && capacity) return reply(200, capacity);
    if (u.pathname === '/api/workshop-jobs' && u.searchParams.get('custody') === 'in_shop' && inShopDown) return reply(404, { error: 'Not found' });
    if (u.pathname === '/api/workshop-jobs' && u.searchParams.get('custody') === 'in_shop') return reply(200, [...(booked ? [maya] : []), PARTS, READY, QUEUED]);
    // Today's list also has a bike in the shop carried over to today: counted once.
    if (u.pathname === '/api/workshop-jobs' && u.searchParams.get('start') === TODAY && u.searchParams.get('end') === TODAY) return reply(200, [maya, JAMIE, AISHA, REQUEST, PARTS, ...extra]);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom('http://localhost/workshop/overview');
  if (phone || coarse) window.matchMedia = (q) => ({ matches: (phone && q.includes('max-width')) || (coarse && q.includes('coarse')), media: q, addEventListener() {}, removeEventListener() {} });
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByText('Wednesday 21 October · one shop, one view of the work');
  if (!inShopDown) await ui.findByRole('link', { name: 'WH-1042 · Maya Patel' });
  return { ...rtl, ui };
}
const tab = (ui, name) => ui.getByRole('button', { name: new RegExp(`^${name} · `) });
const rowNames = (ui) => ui.getAllByRole('link', { name: /^WH-\d+ · / }).map((a) => a.textContent);

test('today’s date, then the bikes expected and in the workshop; no Planned effort yet', async () => {
  const { ui, within } = await openOverview();
  const expected = within(ui.getByRole('region', { name: 'Expected today' }));
  assert.ok(expected.getByText('3 bikes'));
  assert.ok(expected.getByText('3 still to arrive'));
  const inWorkshop = within(ui.getByRole('region', { name: 'In the workshop' }));
  assert.ok(inWorkshop.getByText('3'));
  assert.ok(inWorkshop.getByText('1 ready to collect'));
  assert.ok(ui.queryByText(/Planned effort/) === null, 'no capacity figures, no Planned effort');
});

test('four tabs with their counts; Arrivals first, by time, a drop-off last; a request isn’t counted', async () => {
  const { ui, within } = await openOverview();
  const group = within(ui.getByRole('group', { name: 'Show jobs' }));
  assert.deepEqual(group.getAllByRole('button').map((b) => b.textContent), ['Arrivals · 3', 'Shared queue · 2', 'Needs attention · 1', 'Ready · 1']);
  assert.equal(tab(ui, 'Arrivals').getAttribute('aria-pressed'), 'true');
  assert.deepEqual(rowNames(ui), ['WH-1042 · Maya Patel', 'WH-1045 · Jamie Brooks', 'WH-1047 · Aisha Khan']);
  assert.ok(ui.queryByText(/Sam Reed/) === null);
});

test('each tab lists its jobs', async () => {
  const { ui, fireEvent } = await openOverview();
  fireEvent.click(tab(ui, 'Shared queue'));
  assert.equal(tab(ui, 'Shared queue').getAttribute('aria-pressed'), 'true');
  assert.deepEqual(rowNames(ui), ['WH-1052 · Tom Hale', 'WH-1047 · Aisha Khan']);
  fireEvent.click(tab(ui, 'Needs attention'));
  assert.deepEqual(rowNames(ui), ['WH-1050 · Oliver Chen']);
  assert.ok(ui.getByText('Wheel build · waiting for parts'));
  fireEvent.click(tab(ui, 'Ready'));
  assert.deepEqual(rowNames(ui), ['WH-1051 · Priya Shah']);
});

test('the table: bike, work, custody; Book in when due, the time when later, Book in for a drop-off', async () => {
  const { ui, within } = await openOverview();
  const table = within(ui.getByRole('table'));
  assert.deepEqual(table.getAllByRole('columnheader').map((h) => h.textContent), ['Job / customer', 'Bike', 'Work', 'Custody', 'Action']);
  const raw = table.getAllByRole('row').slice(1);
  const rows = raw.map((r) => within(r));
  assert.ok(rows[0].getByText('Trek Domane AL 3'));
  assert.ok(rows[0].getByText('Expected'));
  assert.ok(rows[0].getByRole('button', { name: 'Book in WH-1042' }));
  assert.ok(rows[0].getByText('Standard service · 10:30 appointment'), 'a due arrival keeps its time beside the work, as drawn');
  assert.ok(raw[1].lastElementChild.textContent === '14:00 appointment');
  assert.ok(rows[1].queryByRole('button') === null);
  assert.ok(rows[2].getByText('Safety check · drop-off'));
  assert.ok(rows[2].getByRole('button', { name: 'Book in WH-1047' }));
});

test('Book in books the bike in with its version, and it moves into the workshop', async () => {
  const { ui, fireEvent, waitFor, within } = await openOverview();
  fireEvent.click(ui.getByRole('button', { name: 'Book in WH-1042' }));
  await waitFor(() => assert.ok(calls.some((c) => c.method === 'POST')));
  const post = calls.find((c) => c.method === 'POST');
  assert.equal(post.url, '/api/workshop-jobs/1/book-in');
  assert.deepEqual(post.body, { version: 3 });
  await waitFor(() => assert.equal(tab(ui, 'Arrivals').textContent, 'Arrivals · 2'));
  assert.ok(within(ui.getByRole('region', { name: 'In the workshop' })).getByText('4'));
});

test('a refused Book in says why', async () => {
  const { ui, fireEvent } = await openOverview();
  bookIn = { status: 409, ok: false, json: async () => ({ error: 'This job changed while you were looking at it.', code: 'stale' }) };
  fireEvent.click(ui.getByRole('button', { name: 'Book in WH-1042' }));
  assert.equal((await ui.findByRole('alert')).textContent, 'This job changed while you were looking at it.');
});

test('a job’s number and name open it in the diary; custody reads In the shop once it’s in', async () => {
  const { ui, fireEvent, within } = await openOverview();
  assert.equal(ui.getByRole('link', { name: 'WH-1042 · Maya Patel' }).getAttribute('href'), '/workshop/diary?job=1');
  fireEvent.click(tab(ui, 'Ready'));
  const row = within(ui.getAllByRole('row')[1]);
  assert.ok(row.getByText('In the shop'));
});

test('on a phone the jobs are rows, not a table, each with its action', async () => {
  const { ui } = await openOverview({ phone: true });
  assert.ok(ui.queryByRole('table') === null);
  assert.deepEqual(rowNames(ui), ['WH-1042 · Maya Patel', 'WH-1045 · Jamie Brooks', 'WH-1047 · Aisha Khan']);
  assert.ok(ui.getByRole('button', { name: 'Book in WH-1042' }));
  assert.ok(ui.getByText('Trek Domane AL 3 · Standard service · 10:30 appointment'));
});

// Fresh review, 21 Oct.
test('a read that fails says so, and shows no figures that look real', async () => {
  const { ui } = await openOverview({ inShopDown: true });
  assert.match((await ui.findByRole('alert')).textContent, /couldn’t load the workshop’s jobs/);
  assert.ok(ui.queryByRole('region', { name: 'Expected today' }) === null);
  assert.ok(ui.queryByRole('group', { name: 'Show jobs' }) === null);
});

test('a Book in the server refuses is said in the job page’s plain words', async () => {
  const { ui, fireEvent } = await openOverview();
  bookIn = { status: 409, ok: false, json: async () => ({ error: 'cannot book_in a job that is in_shop; from here you can collect', code: 'illegal' }) };
  fireEvent.click(ui.getByRole('button', { name: 'Book in WH-1042' }));
  assert.equal((await ui.findByRole('alert')).textContent, 'The bike is already here.');
});

test('a refusal goes when another tab is chosen', async () => {
  const { ui, fireEvent } = await openOverview();
  bookIn = { status: 409, ok: false, json: async () => ({ error: 'x', code: 'stale' }) };
  fireEvent.click(ui.getByRole('button', { name: 'Book in WH-1042' }));
  await ui.findByRole('alert');
  fireEvent.click(tab(ui, 'Ready'));
  assert.ok(ui.queryByRole('alert') === null);
});

test('after Book in the focus stays on the page, on the Arrivals tab', async () => {
  const { ui, fireEvent, waitFor } = await openOverview();
  fireEvent.click(ui.getByRole('button', { name: 'Book in WH-1042' }));
  await waitFor(() => assert.equal(tab(ui, 'Arrivals').textContent, 'Arrivals · 2'));
  assert.ok(document.activeElement === tab(ui, 'Arrivals'));
});

test('the time moves on by itself: an appointment becomes due without anything pressed', async () => {
  const { ui, act } = await openOverview({ interval: true });
  assert.ok(ui.queryByRole('button', { name: 'Book in WH-1045' }) === null);
  await act(async () => { mock.timers.tick(3 * 60 * 60 * 1000); });
  assert.ok(await ui.findByRole('button', { name: 'Book in WH-1045' }));
});

test('a job over several days is read from today’s day: its mechanic and its arrival', async () => {
  const { ui, fireEvent } = await openOverview({ extra: [TWO_DAY] });
  assert.deepEqual(rowNames(ui), ['WH-1053 · Ella Ward', 'WH-1042 · Maya Patel', 'WH-1045 · Jamie Brooks', 'WH-1047 · Aisha Khan']);
  fireEvent.click(tab(ui, 'Shared queue'));
  assert.ok(rowNames(ui).includes('WH-1053 · Ella Ward'));
});

test('on a touch screen the tabs and buttons are 44px', async () => {
  const { ui } = await openOverview({ coarse: true });
  assert.match(tab(ui, 'Arrivals').className, /min-h-11/);
  assert.match(ui.getByRole('button', { name: 'Book in WH-1042' }).className, /min-h-11/);
});

test('after Book in from the Shared queue the focus is on the Shared queue tab', async () => {
  const { ui, fireEvent, waitFor } = await openOverview();
  fireEvent.click(tab(ui, 'Shared queue'));
  fireEvent.click(ui.getByRole('button', { name: 'Book in WH-1047' }));
  await waitFor(() => assert.ok(calls.some((c) => c.method === 'POST')));
  await waitFor(() => assert.ok(document.activeElement === tab(ui, 'Shared queue')));
});

// Planned effort (Jack, 21 Oct, workshop overview answer 2: once the capacity
// figures give it; drawn with its fill bar, audit M7).
test('Planned effort: the day’s work against the mechanics’ time, with its bar', async () => {
  capacity = { days: [{ date: TODAY, plannedMinutes: 360, availableMinutes: 480, mechanics: [] }] };
  const { ui, within } = await openOverview();
  const effort = within(await ui.findByRole('region', { name: 'Planned effort' }));
  assert.ok(effort.getByText('6h / 8h'));
  assert.ok(effort.getByText('Shared and assigned, counted once'));
  assert.ok(effort.getByRole('img', { name: '75% of planned effort used today' }));
});

test('Planned effort in half hours, and a closed day', async () => {
  capacity = { days: [{ date: TODAY, plannedMinutes: 390, availableMinutes: 0, mechanics: [] }] };
  const { ui, within } = await openOverview();
  const effort = within(await ui.findByRole('region', { name: 'Planned effort' }));
  assert.ok(effort.getByText('6.5h / 0h'));
  assert.ok(effort.queryByRole('img') === null, 'no bar with no time');
});

// The reply-shape file (working agreement task 2.4): this file's fake jobs are
// the shape the server sends, so a changed reply fails here too.
test('the fake jobs here are the shape of the server’s', async () => {
  const shapes = await import(new URL('../../.test-build/lib/api/shapes.js', import.meta.url).href);
  for (const j of [MAYA, JAMIE, AISHA, REQUEST, PARTS, READY, QUEUED, TWO_DAY]) {
    assert.deepEqual(shapes.shapeProblems(shapes.WORKSHOP_JOB, j), [], j.reference);
    for (const part of j.parts) assert.deepEqual(shapes.shapeProblems(shapes.JOB_PART, part), [], `${j.reference} part ${part.position}`);
  }
  // Book in sends the job back without its days.
  assert.deepEqual(shapes.shapeProblems(shapes.WORKSHOP_JOB_CHANGED, changed(MAYA)), []);
});
