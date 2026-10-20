// The staff diary, piece 2: answering what's waiting (journey 12 decisions
// 14, 15, 19; the request pop-ups drawn as request-new, request-decline,
// request-change and request-cancel in docs/design/user-journeys/generator/
// diary.mjs). Rendered in jsdom inside the app shell, the server stubbed in
// its real shapes; the answer routes take { version } and return the job.
// Spec: docs/superpowers/specs/2026-10-03-staff-diary-view-design.md (piece 2)
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const MECHANICS = [{ id: 11, name: 'Alex Morgan', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true }];

function job(over) {
  return {
    id: 1, title: 'Brake service', reference: 'WH-1001', customerId: 5, customerName: 'Maya Patel', bikeId: 7, bikeLabel: 'Trek Domane',
    mechanicId: 11, mechanicName: 'Alex Morgan', jobDate: '2026-10-06', startTime: '10:00', endTime: '11:00', status: 'scheduled',
    bookingState: 'scheduled', custodyState: 'expected', workState: 'not_started', version: 3, notes: null, requested: null,
    customerDescription: null, cancelledBy: null, cancelledAt: null, cancellationSeenAt: null, changeDeclinedAt: null,
    orderId: null, orderStatus: null, orderTotal: null, createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z', ...over,
  };
}
const REQUEST = job({ id: 3, reference: 'WH-1003', title: 'Puncture repair', bikeLabel: 'Specialized Sirrus', customerName: 'Sam Reed', mechanicId: null, mechanicName: null, jobDate: '2026-10-09', startTime: '10:00', endTime: '10:45', bookingState: 'pending', version: 4 });
const CHANGE = job({ id: 2, reference: 'WH-1002', title: 'Full service', bikeLabel: 'Brompton C Line', customerName: 'Oliver Chen', jobDate: '2026-10-05', bookingState: 'reschedule_requested', version: 7,
  requested: { jobDate: '2026-10-05', startTime: '14:00', endTime: '15:00', mechanicId: 11 } });
const CANCELLED = job({ id: 4, reference: 'WH-1004', title: 'Safety check', bikeLabel: 'Cannondale Quick', customerName: 'Aisha Khan', jobDate: '2026-10-07', startTime: '13:00', endTime: '14:00',
  bookingState: 'cancelled', cancelledBy: 'customer', cancelledAt: '2026-10-03T07:58:00Z', version: 9 });
const JOBS = [REQUEST, CHANGE, CANCELLED];
const WAITING = {
  count: 3,
  items: [
    { kind: 'new_booking', jobId: 3, reference: 'WH-1003', jobDate: '2026-10-09', startTime: '10:00', endTime: '10:45', mechanicId: null, customerName: 'Sam Reed', serviceNames: ['Puncture repair'], services: [], arrivedAt: '2026-10-03T08:15:00Z' },
    { kind: 'change_request', jobId: 2, reference: 'WH-1002', jobDate: '2026-10-05', startTime: '10:00', endTime: '11:00', mechanicId: 11, customerName: 'Oliver Chen', serviceNames: ['Full service'], services: [], arrivedAt: '2026-10-03T08:20:00Z',
      from: { jobDate: '2026-10-05', startTime: '10:00', endTime: '11:00', mechanicId: 11, mechanicName: 'Sam' }, to: { jobDate: '2026-10-05', startTime: '14:00', endTime: '15:00', mechanicId: 12, mechanicName: 'Alex Morgan' } },
    { kind: 'customer_cancelled', jobId: 4, reference: 'WH-1004', jobDate: '2026-10-07', startTime: '13:00', endTime: '14:00', mechanicId: 11, customerName: 'Aisha Khan', serviceNames: ['Safety check'], services: [], arrivedAt: '2026-10-03T07:58:00Z' },
  ],
};

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let answer; // what the next POST gets back: { status, body }
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
    if (method === 'POST') return answer ? reply(answer.status, answer.body) : reply(200, JOBS.find((j) => u.pathname.includes(`/${j.id}/`)));
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/employees') return reply(200, MECHANICS);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/workshop-waiting') return reply(200, WAITING);
    if (u.pathname === '/api/workshop-jobs') return reply(200, JOBS);
    const one = u.pathname.match(/^\/api\/workshop-jobs\/(\d+)$/);
    if (one) return reply(200, JOBS.find((j) => j.id === Number(one[1])));
    return reply(404, { error: 'Not found' });
  };
}

async function openDiary() {
  uninstall = installDom('http://localhost/workshop/diary?date=2026-10-05');
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
  await ui.findByRole('button', { name: /Sam Reed/ });
  return { ...rtl, ui };
}

// Choose a waiting card, then press its Open button.
async function openCard({ ui, fireEvent, within }, customer) {
  const col = within(ui.getByRole('region', { name: /Waiting for you/ }));
  fireEvent.click(col.getByRole('button', { name: new RegExp(customer) }));
  fireEvent.click(await col.findByRole('button', { name: `Open ${customer}'s request` }));
  return loaded({ ui, within });
}

// The pop-up, once the job's details have arrived.
async function loaded({ ui, within, waitFor }) {
  const dlg = within(await ui.findByRole('dialog'));
  await (waitFor ?? (await import('@testing-library/react')).waitFor)(() => assert.equal(has(dlg.queryByText('Loading…')), false));
  return dlg;
}

const posted = () => calls.filter((c) => c.method === 'POST').map((c) => `${c.url} ${JSON.stringify(c.body)}`);
const has = (q) => Boolean(q);

test('a booking request opens in a pop-up with what the customer asked for', async () => {
  const r = await openDiary();
  const dlg = await openCard(r, 'Sam Reed');
  assert.ok(has(dlg.queryByRole('heading', { name: 'Sam Reed · Specialized Sirrus' })));
  assert.ok(has(dlg.queryByText('Pending')));
  assert.ok(has(dlg.queryByText('No message from the customer.')));
  assert.ok(has(dlg.queryByText('Puncture repair')));
  assert.ok(has(dlg.queryByText('Requested Fri 9 Oct, 10:00–10:45')));
});

test('Accept accepts the booking with the version seen, closes the pop-up and refreshes the diary', async () => {
  const r = await openDiary();
  const dlg = await openCard(r, 'Sam Reed');
  const before = calls.filter((c) => c.url === '/api/workshop-waiting').length;
  r.fireEvent.click(dlg.getByRole('button', { name: 'Accept' }));
  await r.waitFor(() => assert.equal(has(r.ui.queryByRole('dialog')), false));
  assert.deepEqual(posted(), ['/api/workshop-jobs/3/accept {"version":4}']);
  await r.waitFor(() => assert.ok(calls.filter((c) => c.url === '/api/workshop-waiting').length > before));
});

// Choosing the mechanic as you accept (Workshop day decision 62; drawn on
// request-new): pills for the shop's mechanics and the shared queue, the
// request's own picked.
test('the request shows the mechanic pills with its own picked; choosing one sends it with Accept', async () => {
  const r = await openDiary();
  const dlg = await openCard(r, 'Sam Reed');
  const group = await dlg.findByRole('radiogroup', { name: 'Mechanic' });
  const pills = r.within(group).getAllByRole('radio');
  assert.deepEqual(pills.map((p) => p.textContent), ['Alex Morgan', 'Shared queue']);
  assert.equal(r.within(group).getByRole('radio', { name: 'Shared queue' }).getAttribute('aria-checked'), 'true');
  r.fireEvent.click(r.within(group).getByRole('radio', { name: 'Alex Morgan' }));
  assert.equal(r.within(group).getByRole('radio', { name: 'Alex Morgan' }).getAttribute('aria-checked'), 'true');
  r.fireEvent.click(dlg.getByRole('button', { name: 'Accept' }));
  await r.waitFor(() => assert.deepEqual(posted(), ['/api/workshop-jobs/3/accept {"mechanicId":11,"version":4}']));
});

test('a request with its mechanic already set has that pill picked; keeping it sends no change', async () => {
  const keep = JOBS.find((j) => j.id === 3);
  const i = JOBS.indexOf(keep);
  JOBS[i] = { ...keep, mechanicId: 11, mechanicName: 'Alex Morgan' };
  try {
    const r = await openDiary();
    const dlg = await openCard(r, 'Sam Reed');
    const group = await dlg.findByRole('radiogroup', { name: 'Mechanic' });
    await r.waitFor(() => assert.equal(r.within(group).getByRole('radio', { name: 'Alex Morgan' }).getAttribute('aria-checked'), 'true'));
    r.fireEvent.click(dlg.getByRole('button', { name: 'Accept' }));
    await r.waitFor(() => assert.deepEqual(posted(), ['/api/workshop-jobs/3/accept {"version":4}']));
  } finally {
    JOBS[i] = keep;
  }
});

// Pills move with the arrow keys, one Tab stop per group (drawn: mechanicPill's
// roving tabindex): only the picked pill is in the Tab order.
test('the mechanic pills are one Tab stop, and the arrow keys move and pick, wrapping', async () => {
  const r = await openDiary();
  const dlg = await openCard(r, 'Sam Reed');
  const group = await dlg.findByRole('radiogroup', { name: 'Mechanic' });
  const alex = r.within(group).getByRole('radio', { name: 'Alex Morgan' });
  const queue = r.within(group).getByRole('radio', { name: 'Shared queue' });
  await r.waitFor(() => assert.equal(queue.tabIndex, 0));
  assert.equal(alex.tabIndex, -1);
  queue.focus();
  r.fireEvent.keyDown(queue, { key: 'ArrowRight' });
  await r.waitFor(() => assert.equal(alex.getAttribute('aria-checked'), 'true'));
  assert.ok(document.activeElement === alex, 'wraps to the first');
  assert.equal(alex.tabIndex, 0);
  assert.equal(queue.tabIndex, -1);
  // A browser shortcut (Alt+arrow) is left alone.
  r.fireEvent.keyDown(alex, { key: 'ArrowLeft', altKey: true });
  assert.ok(document.activeElement === alex);
  assert.equal(alex.getAttribute('aria-checked'), 'true');
  r.fireEvent.keyDown(alex, { key: 'End' });
  await r.waitFor(() => assert.equal(queue.getAttribute('aria-checked'), 'true'));
  assert.ok(document.activeElement === queue);
});

// Telling staff when a booking message didn't go (booking messages answer 5;
// drawn as diary-no-message): the diary's floating note, with Close.
test('an accept whose message couldn’t reach the customer says so in the diary, until closed', async () => {
  const r = await openDiary();
  const dlg = await openCard(r, 'Sam Reed');
  answer = { status: 200, body: { ...REQUEST, bookingState: 'scheduled', bookingMessage: { skipped: 'no_contact', name: 'Booking confirmed' } } };
  r.fireEvent.click(dlg.getByRole('button', { name: 'Accept' }));
  const note = await r.ui.findByText('“Booking confirmed” didn’t go: Sam Reed has no phone number or email on file.');
  assert.equal(note.closest('[role]').getAttribute('role'), 'status');
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Close the message' }));
  await r.waitFor(() => assert.ok(r.ui.queryByText(/didn’t go/) === null));
});

test('an accept whose message went says nothing more', async () => {
  const r = await openDiary();
  const dlg = await openCard(r, 'Sam Reed');
  r.fireEvent.click(dlg.getByRole('button', { name: 'Accept' }));
  await r.waitFor(() => assert.ok(r.ui.queryByRole('dialog') === null));
  assert.ok(r.ui.queryByText(/didn’t go/) === null);
});

// Declining with a message (Workshop day 15; Jack, 20 Oct; drawn as request-decline).
const DECLINE_WORDS = 'Sorry, we can’t fit this service in on Friday. Please try another day, or call us and we’ll help find one.';
test('Decline opens the message to the customer, started for them; Keep request changes nothing', async () => {
  const r = await openDiary();
  const dlg = await openCard(r, 'Sam Reed');
  r.fireEvent.click(dlg.getByRole('button', { name: 'Decline' }));
  assert.ok(has(dlg.queryByText('Explain what the customer can do next')));
  assert.ok(has(r.ui.queryByRole('dialog', { name: 'Decline booking request' })));
  assert.equal(dlg.getByLabelText('Message to Sam').value, DECLINE_WORDS);
  assert.ok(has(dlg.queryByText('Declining releases the request’s reservation. The customer is told not to travel for this request.')));
  r.fireEvent.click(dlg.getByRole('button', { name: 'Keep request' }));
  assert.ok(has(dlg.queryByRole('button', { name: 'Accept' })));
  assert.deepEqual(posted(), []);
});

test('Decline & notify customer declines the booking with the message', async () => {
  const r = await openDiary();
  const dlg = await openCard(r, 'Sam Reed');
  r.fireEvent.click(dlg.getByRole('button', { name: 'Decline' }));
  r.fireEvent.change(dlg.getByLabelText('Message to Sam'), { target: { value: 'Fully booked that week, sorry.' } });
  r.fireEvent.click(dlg.getByRole('button', { name: 'Decline & notify customer' }));
  await r.waitFor(() => assert.equal(posted().length, 1));
  const post = calls.find((c) => c.method === 'POST');
  assert.equal(new URL(post.url, 'http://localhost').pathname, '/api/workshop-jobs/3/decline');
  assert.deepEqual(post.body, { message: 'Fully booked that week, sorry.', version: 4 });
});

test('a change request shows where from and to, and Accept moves it', async () => {
  const r = await openDiary();
  const dlg = await openCard(r, 'Oliver Chen');
  assert.ok(has(dlg.queryByRole('heading', { name: 'Change request' })));
  assert.ok(has(dlg.queryByText('Mon 5 Oct · 10:00 · Sam')));
  assert.ok(has(dlg.queryByText('Mon 5 Oct · 14:00 · Alex Morgan')));
  r.fireEvent.click(dlg.getByRole('button', { name: 'Accept' }));
  await r.waitFor(() => assert.deepEqual(posted(), ['/api/workshop-jobs/2/accept-change {"version":7}']));
});

test('a change request names the mechanic on each side, since accepting moves it to the one asked for', async () => {
  // Jack, 8 Oct: the pop-up said "Accepting keeps the same work and mechanic",
  // but accepting moves the booking to the mechanic the customer asked for.
  const r = await openDiary();
  const dlg = await openCard(r, 'Oliver Chen');
  assert.ok(has(dlg.queryByText('Mon 5 Oct · 10:00 · Sam')));
  assert.ok(has(dlg.queryByText('Mon 5 Oct · 14:00 · Alex Morgan')));
  assert.ok(has(dlg.queryByText('The customer asked to move this booking. Accepting keeps the same work.')));
  assert.ok(dlg.queryByText(/same work and mechanic/) === null);
});

test('a change request to no mechanic reads Shared queue on its To side', async () => {
  const to = WAITING.items[1].to;
  const saved = { ...to };
  Object.assign(to, { mechanicId: null, mechanicName: null });
  try {
    const r = await openDiary();
    const dlg = await openCard(r, 'Oliver Chen');
    assert.ok(has(dlg.queryByText('Mon 5 Oct · 14:00 · Shared queue')));
  } finally {
    Object.assign(to, saved);
  }
});

test('declining a change request keeps the booking where it was', async () => {
  const r = await openDiary();
  const dlg = await openCard(r, 'Oliver Chen');
  r.fireEvent.click(dlg.getByRole('button', { name: 'Decline' }));
  await r.waitFor(() => assert.deepEqual(posted(), ['/api/workshop-jobs/2/decline-change {"version":7}']));
});

test("a customer's cancellation has one answer: Seen", async () => {
  const r = await openDiary();
  const dlg = await openCard(r, 'Aisha Khan');
  assert.ok(has(dlg.queryByRole('heading', { name: 'Cancelled booking' })));
  assert.ok(has(dlg.queryByText('Cancelled by the customer on Sat 3 Oct.')));
  r.fireEvent.click(dlg.getByRole('button', { name: 'Seen' }));
  await r.waitFor(() => assert.deepEqual(posted(), ['/api/workshop-jobs/4/cancellation-seen {"version":9}']));
});

test('if someone else changed the job first, the pop-up says so and shows it afresh', async () => {
  const r = await openDiary();
  const dlg = await openCard(r, 'Sam Reed');
  answer = { status: 409, body: { error: 'Job has been changed by someone else', code: 'stale' } };
  const reads = () => calls.filter((c) => c.url === '/api/workshop-jobs/3').length;
  const before = reads();
  r.fireEvent.click(dlg.getByRole('button', { name: 'Accept' }));
  assert.ok(has(await dlg.findByText('This job changed while you were looking at it.')));
  assert.ok(has(r.ui.queryByRole('dialog')));
  await r.waitFor(() => assert.ok(reads() > before));
});

test('a change to a time that has gone says the time is no longer free', async () => {
  const r = await openDiary();
  const dlg = await openCard(r, 'Oliver Chen');
  answer = { status: 409, body: { error: 'The requested time is no longer free', code: 'capacity' } };
  r.fireEvent.click(dlg.getByRole('button', { name: 'Accept' }));
  assert.ok(has(await dlg.findByText('The requested time is no longer free.')));
});

// Decision 14: on a touch screen the first tap chooses, a second tap opens.
test('a second tap on a chosen card opens it, on a touch screen', async () => {
  const r = await openDiary();
  const col = r.within(r.ui.getByRole('region', { name: /Waiting for you/ }));
  const tap = () => {
    const card = col.getAllByRole('button', { name: /Aisha Khan/ }).find((b) => b.hasAttribute('aria-pressed'));
    r.fireEvent.pointerDown(card, { button: 0, pointerType: 'touch' });
    r.fireEvent.click(card, { detail: 1 });
  };
  tap();
  assert.ok(r.ui.queryByRole('dialog') === null);
  tap();
  const dlg = await loaded(r);
  assert.ok(has(dlg.queryByRole('heading', { name: 'Cancelled booking' })));
});

// A click from the keyboard (detail 0) is never a tap, as for a stack: Enter
// on a chosen card chooses it, whatever was pressed before.
test('Enter on a chosen card does not open it, even after a tap', async () => {
  const r = await openDiary();
  const col = r.within(r.ui.getByRole('region', { name: /Waiting for you/ }));
  const card = () => col.getAllByRole('button', { name: /Aisha Khan/ }).find((b) => b.hasAttribute('aria-pressed'));
  r.fireEvent.pointerDown(card(), { button: 0, pointerType: 'touch' });
  r.fireEvent.click(card(), { detail: 1 });
  r.fireEvent.click(card(), { detail: 0 });
  await new Promise((done) => setTimeout(done, 50));
  assert.ok(r.ui.queryByRole('dialog') === null);
});

test('a second mouse click on a chosen card does not open it', async () => {
  const r = await openDiary();
  const col = r.within(r.ui.getByRole('region', { name: /Waiting for you/ }));
  for (let i = 0; i < 2; i++) {
    const card = col.getAllByRole('button', { name: /Aisha Khan/ }).find((b) => b.hasAttribute('aria-pressed'));
    r.fireEvent.pointerDown(card, { button: 0, pointerType: 'mouse' });
    r.fireEvent.click(card);
  }
  await new Promise((done) => setTimeout(done, 50));
  assert.ok(r.ui.queryByRole('dialog') === null);
  assert.equal(col.getAllByRole('button', { name: /Aisha Khan/ }).find((b) => b.hasAttribute('aria-pressed')).getAttribute('aria-pressed'), 'true');
});

test('double-clicking a card opens it straight away', async () => {
  const r = await openDiary();
  const col = r.within(r.ui.getByRole('region', { name: /Waiting for you/ }));
  r.fireEvent.doubleClick(col.getByRole('button', { name: /Aisha Khan/ }));
  const dlg = await loaded(r);
  assert.ok(has(dlg.queryByRole('heading', { name: 'Cancelled booking' })));
});

// The layout review (#238, item 8): a change request's pop-up has "Open full
// job", as drawn on request-change, which closes it and opens the job page.
// Spec: openspec/changes/review-catch-ups
test('a change request pop-up opens the full job', async () => {
  const r = await openDiary();
  const dlg = await openCard(r, 'Oliver Chen');
  r.fireEvent.click(dlg.getByRole('button', { name: 'Open full job' }));
  assert.ok(has(await r.ui.findByRole('dialog', { name: /Full service/ })), 'the job page opens');
  assert.ok(r.ui.queryByRole('heading', { name: 'Change request' }) === null, 'the request closes');
});
