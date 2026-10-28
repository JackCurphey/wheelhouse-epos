// Office › Today (openspec/changes/today-page; drawn as op-today and
// op-today-staff in generator/opening.mjs; Jack, 30 Sep, opening the shop
// decisions 3 and 4; 7 Oct, stage-1 drawing gaps 12): the date and the shop,
// Needs attention for the Owner, and Workshop today, which shares the
// Overview's rules (workshop-day.tsx). Who's in waits for check-ins (WP-1.7).
import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';
import { fakeJob, changed } from '../helpers/fake-job.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const JO = { ...OWNER, id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false };
// Wednesday 21 October 2026, 10:00 in the shop.
const NOW = new Date(2026, 9, 21, 10, 0, 0);
const TODAY = '2026-10-21';
const job = (over) => fakeJob({
  id: 1, title: 'Standard service', reference: 'WH-1042', customerId: 5, customerName: 'Maya Patel', bikeId: 7, bikeLabel: 'Trek Domane AL 3',
  mechanicId: 11, mechanicName: 'Alex Morgan', jobDate: TODAY, startTime: '10:30', endTime: '12:00', version: 3,
  createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z', ...over,
});
// The Overview's day: Maya due now, Jamie later, Aisha's drop-off, a request
// (not counted), and three in the shop, one of them ready.
const MAYA = job({});
const JAMIE = job({ id: 2, reference: 'WH-1045', title: 'Gear adjustment', customerName: 'Jamie Brooks', bikeLabel: 'Giant Escape 2', startTime: '14:00', endTime: '15:00' });
const AISHA = job({ id: 3, reference: 'WH-1047', title: 'Safety check', customerName: 'Aisha Khan', bikeLabel: 'Cannondale Quick', startTime: null, endTime: null, mechanicId: null, mechanicName: null,
  parts: [{ id: 31, position: 1, date: TODAY, startTime: '', endTime: '', mechanicId: null, mechanicName: null }] });
const REQUEST = job({ id: 4, reference: 'WH-1048', title: 'Puncture repair', customerName: 'Sam Reed', bikeLabel: 'Specialized Sirrus', startTime: '11:00', bookingState: 'pending' });
const PARTS = job({ id: 5, reference: 'WH-1050', jobDate: '2026-10-19', custodyState: 'in_shop', workState: 'waiting_parts' });
const READY = job({ id: 6, reference: 'WH-1051', jobDate: '2026-10-20', custodyState: 'in_shop', workState: 'complete' });
const QUEUED = job({ id: 7, reference: 'WH-1052', jobDate: '2026-10-20', custodyState: 'in_shop', workState: 'in_progress' });
const NO_ANSWER = { kind: 'quote_no_answer', jobId: 9, reference: 'WH-1039', customerName: 'Maya Patel', phone: '07700 900142', sentAt: '2026-10-19T09:15:00Z', reminderSentAt: '2026-10-20T09:15:00Z' };
const REPLIES = { kind: 'replies', count: 2, oldestName: 'Maya Patel', oldestAt: '2026-10-21T08:40:00Z' };

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let booked;
let attention;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
  mock.timers.reset();
});

async function openToday({ who = OWNER, items = [NO_ANSWER, REPLIES], phone = false } = {}) {
  calls = [];
  booked = false;
  attention = items;
  mock.timers.enable({ apis: ['Date'], now: NOW });
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ url, method });
    const reply = (status, body) => ({ status, ok: status < 300, json: async () => body });
    const u = new URL(url, 'http://localhost');
    const maya = booked ? { ...MAYA, custodyState: 'in_shop', version: 4 } : MAYA;
    if (method === 'POST' && u.pathname === '/api/workshop-jobs/1/book-in') { booked = true; return reply(200, changed({ ...MAYA, custodyState: 'in_shop', version: 4 })); }
    if (u.pathname === '/api/auth/me') return reply(200, who);
    if (u.pathname === '/api/needs-attention') return who.isOwner ? reply(200, { items: attention }) : reply(403, { error: 'no', code: 'owner_only' });
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [{ weekday: 3, open: '09:00', close: '17:30' }] });
    if (u.pathname === '/api/workshop-jobs' && u.searchParams.get('custody') === 'in_shop') return reply(200, [...(booked ? [maya] : []), PARTS, READY, QUEUED]);
    if (u.pathname === '/api/workshop-jobs' && u.searchParams.get('start') === TODAY) return reply(200, [maya, JAMIE, AISHA, REQUEST, PARTS]);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom('http://localhost/workshop/today');
  if (phone) window.matchMedia = (q) => ({ matches: q.includes('max-width'), media: q, addEventListener() {}, removeEventListener() {} });
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByRole('heading', { level: 1, name: 'Today' });
  await ui.findByRole('heading', { name: 'Workshop today' });
  return { ...rtl, ui };
}
const card = async (ui, name) => (await import('@testing-library/react')).within(ui.getByRole('region', { name }));

test('Today says the day, the shop and its hours', async () => {
  const { ui } = await openToday();
  assert.ok((await ui.findByText('Wednesday 21 October · North Street Cycles · open 09:00–17:30')) !== null);
});

test('Workshop today: the Overview\'s figures, the bikes still to arrive, and Open the diary', async () => {
  const { ui, waitFor } = await openToday();
  const work = await card(ui, 'Workshop today');
  await waitFor(() => assert.ok(work.queryByText('3 bikes') !== null));
  assert.ok(work.queryByText('Expected today') !== null);
  assert.ok(work.queryByText('3 still to arrive') !== null);
  assert.ok(work.queryByText('Repairs ready to collect') !== null);
  assert.equal(work.getByText('Repairs ready to collect').nextElementSibling.textContent, '1');
  assert.ok(work.queryByRole('heading', { name: 'Still to arrive' }) !== null);
  const rows = work.getAllByRole('listitem').map((li) => li.textContent);
  assert.ok(rows[0].includes('WH-1042 · Maya Patel') && rows[0].includes('Trek Domane AL 3 · Standard service'), rows[0]);
  assert.ok(rows.some((r) => r.includes('WH-1045 · Jamie Brooks') && r.includes('14:00 appointment')), 'Jamie isn\'t due yet, so his time shows');
  assert.ok(!rows.some((r) => r.includes('WH-1048')), 'a request isn\'t expected');
  assert.equal(work.getByRole('link', { name: 'Open the diary' }).getAttribute('href'), '/workshop/diary');
});

test('Book in on a bike that\'s due books it in and it leaves the list', async () => {
  const { ui, fireEvent, waitFor } = await openToday();
  const work = await card(ui, 'Workshop today');
  fireEvent.click(await work.findByRole('button', { name: 'Book in WH-1042' }));
  await waitFor(() => assert.ok(calls.some((c) => c.method === 'POST' && c.url.endsWith('/api/workshop-jobs/1/book-in'))));
  await waitFor(() => assert.ok(work.queryByRole('button', { name: 'Book in WH-1042' }) === null));
  assert.ok(work.queryByText('2 still to arrive') !== null);
  // The row has gone: the focus stays in the card, on its list's heading (fresh review).
  await waitFor(() => assert.ok(document.activeElement === work.getByRole('heading', { name: 'Still to arrive' })));
});

test('Needs attention, with its count: the quote with no answer and the messages needing a reply', async () => {
  const { ui } = await openToday();
  assert.ok((await ui.findByRole('heading', { name: 'Needs attention · 2' })) !== null);
  const box = await card(ui, 'Needs attention · 2');
  assert.ok(box.queryByText('WH-1039 · Maya Patel — no answer to the quote yet') !== null);
  const sent = box.getByText(/^Sent /);
  assert.match(sent.textContent, /^Sent Mon 19 Oct, \d\d:15 · reminder sent Tue 20 Oct, \d\d:15 · 07700 900142$/);
  assert.equal(box.getByRole('link', { name: '07700 900142' }).getAttribute('href'), 'tel:07700900142');
  assert.equal(box.getByRole('link', { name: 'Record their answer for WH-1039' }).getAttribute('href'), '/workshop/diary?job=9');
  assert.ok(box.queryByText('2 messages need a reply') !== null);
  assert.match(box.getByText(/^From customers · oldest from /).textContent, /^From customers · oldest from Maya Patel at \d\d:40$/);
  assert.equal(box.getByRole('link', { name: 'Open Messages' }).getAttribute('href'), '/workshop/messages');
});

test('with nothing waiting, Needs attention says so, with no count', async () => {
  const { ui } = await openToday({ items: [] });
  assert.ok((await ui.findByRole('heading', { name: 'Needs attention' })) !== null);
  assert.ok(ui.queryByText('Nothing needs you right now') !== null);
});

test('a message waiting since an earlier day says the day too', async () => {
  const { ui } = await openToday({ items: [{ ...REPLIES, oldestAt: '2026-10-20T15:20:00Z' }] });
  assert.ok((await ui.findByText(/^From customers · oldest from Maya Patel at Tue 20 Oct, \d\d:20$/)) !== null);
});

test('one message waiting reads in the singular', async () => {
  const { ui } = await openToday({ items: [{ ...REPLIES, count: 1 }] });
  assert.ok((await ui.findByText('1 message needs a reply')) !== null);
});

test('Staff see no Needs attention, and the list behind it isn\'t asked for', async () => {
  const { ui } = await openToday({ who: JO });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(ui.queryByRole('heading', { name: /^Needs attention/ }) === null);
  assert.ok(!calls.some((c) => c.url.includes('/api/needs-attention')), 'it asked for the Owner\'s list');
});

test('on a phone the cards are one column, Needs attention first', async () => {
  const { ui } = await openToday({ phone: true });
  await ui.findByRole('heading', { name: 'Needs attention · 2' });
  const regions = ui.getAllByRole('region').map((r) => r.getAttribute('aria-labelledby'));
  // Tills and Who's in come between (whos-in-and-first-pin; op-today's left column first).
  assert.deepEqual(regions, ['today-attention', 'today-tills', 'today-whos-in', 'today-workshop']);
  const [attention, work] = ['today-attention', 'today-workshop'].map((id) => ui.container.querySelector(`[aria-labelledby="${id}"]`));
  assert.ok(attention.parentElement === work.parentElement, 'the two cards should share one column');
});

test('on a computer the cards are two columns, Needs attention on the left', async () => {
  const { ui } = await openToday();
  await ui.findByRole('heading', { name: 'Needs attention · 2' });
  const [attention, work] = ['today-attention', 'today-workshop'].map((id) => ui.container.querySelector(`[aria-labelledby="${id}"]`));
  assert.ok(attention.parentElement !== work.parentElement, 'each card should have its own column');
  assert.ok(attention.parentElement.nextElementSibling === work.parentElement, 'Needs attention should be the left column');
});
