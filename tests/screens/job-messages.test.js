// The job's messages, the outbox (Jack, 20 Oct, docs/decisions/2026-10-20-messages-engine.md
// answer 2; drawn as job-messages): the job page's "Message Maya Patel" button
// opens "Messages", a conversation: the shop's messages on the right, each
// with its name, Waiting or Pretend, and how and when; the customer's on the
// left; oldest at the top. "Pretend for now: each shows what Maya would get.
// Nothing is really sent."

import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const CUSTOMER = { id: 5, name: 'Maya Patel', email: 'maya@example.test', phone: '07700 900 142', active: true };
const READY = 'Hi Maya, your Trek Domane AL 3 is ready to collect from North Street Cycles. £111.00 to pay on collection. See what we did: [link]. Job WH-1042. We’re open [opening hours].';
const QUOTE = 'Hi Maya, North Street Cycles has a quote for more work on your Trek Domane AL 3. See it and say yes or no to each part: [link] — no app or sign-in needed. Your repair · WH-1042.';
const msg = (over) => ({
  id: 1, customerId: 5, jobId: 1, key: 'bike_ready', name: 'Bike ready', channel: 'sms', to: '07700 900 142', subject: null,
  body: READY, state: 'delivered', pretend: true, sendAfter: '2026-09-17T14:31:00.000Z', sentAt: '2026-09-17T14:31:05.000Z',
  error: null, createdAt: '2026-09-17T14:30:00.000Z', direction: 'outbound', ...over,
});

let JOB;
let MESSAGES;
const job = (over) => ({
  id: 1, title: 'Standard service', reference: 'WH-1042', customerId: 5, customerName: 'Maya Patel', bikeId: 7, bikeLabel: 'Trek Domane AL 3',
  mechanicId: 11, mechanicName: 'Alex Morgan', jobDate: '2026-10-08', startTime: '10:00', endTime: '11:30', status: 'scheduled',
  bookingState: 'scheduled', custodyState: 'in_shop', workState: 'complete', version: 3, notes: '', requested: null,
  customerDescription: null, cancelledBy: null, cancelledAt: null, cancellationSeenAt: null,
  orderId: 80, orderStatus: 'draft', orderTotal: 111, createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z', ...over,
});

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

async function openJob(messages) {
  JOB = job({});
  MESSAGES = messages;
  calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ url, method });
    const reply = (status, body) => ({ status, ok: status < 300, json: async () => body });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/employees') return reply(200, []);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/workshop-waiting') return reply(200, { count: 0, items: [] });
    if (u.pathname === '/api/workshop-jobs') return reply(200, [JOB]);
    if (u.pathname === '/api/workshop-jobs/1') return reply(200, JOB);
    if (u.pathname === '/api/customers/5') return reply(200, CUSTOMER);
    if (u.pathname === '/api/sale-documents/80') return reply(200, { id: 80, status: 'draft', total: 111, items: [] });
    if (u.pathname === '/api/messages' && u.searchParams.get('jobId') === '1') return reply(200, MESSAGES);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom('http://localhost/workshop/diary?date=2026-10-05');
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  rtl.fireEvent.click(await ui.findByRole('button', { name: /^Trek Domane AL 3, Standard service/ }));
  const dlg = rtl.within(await ui.findByRole('dialog', { name: /Standard service/ }));
  return { ...rtl, ui, dlg };
}

async function openMessages(messages) {
  const t = await openJob(messages);
  t.fireEvent.click(await t.dlg.findByRole('button', { name: 'Message Maya Patel' }));
  const pop = t.within(await t.ui.findByRole('dialog', { name: 'Messages' }));
  return { ...t, pop };
}
const items = async (pop) => [...(await pop.findByRole('list', { name: 'Messages with Maya Patel' })).querySelectorAll('li')];
const has = (q) => Boolean(q);

test('the Message button opens the conversation, oldest first, the shop’s on the right', async () => {
  const soon = new Date(Date.now() + 60_000).toISOString();
  // The server lists newest first.
  const { pop } = await openMessages([
    msg({ id: 2, state: 'intended', sendAfter: soon, sentAt: null, pretend: false }),
    msg({ id: 1, key: 'quote_to_approve', name: 'Quote to approve', body: QUOTE }),
  ]);
  assert.ok(has(pop.queryByText('Maya Patel · Standard service · WH-1042')));
  assert.ok(has(pop.queryByText('Pretend for now: each shows what Maya would get. Nothing is really sent.')));
  const [first, second] = await items(pop);
  assert.equal(first.dataset.from, 'shop');
  assert.match(first.textContent, /^Quote to approvePretend/);
  assert.ok(first.textContent.includes(QUOTE));
  assert.ok(first.textContent.endsWith('By text to 07700 900 142 · Thu 17 Sep, 15:31'));
  const at = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(soon));
  assert.match(second.textContent, /^Bike readyWaiting/);
  assert.ok(second.textContent.endsWith(`By text to 07700 900 142 · goes at ${at}`));
});

test('a message from the customer sits on the left, with their name and when', async () => {
  const { pop } = await openMessages([msg({ id: 5, direction: 'inbound', name: 'Message', key: null, body: 'Can I collect at 5?', state: 'delivered', sentAt: '2026-09-17T15:00:00.000Z' })]);
  const [li] = await items(pop);
  assert.equal(li.dataset.from, 'customer');
  assert.equal(li.textContent, 'MayaCan I collect at 5?Thu 17 Sep, 16:00');
});

test('an email says so, and an undone message says it was stopped', async () => {
  const { pop } = await openMessages([msg({ id: 3, channel: 'email', to: 'maya@example.test', state: 'undone', sentAt: null })]);
  const [li] = await items(pop);
  assert.match(li.textContent, /^Bike readyUndone/);
  assert.ok(li.textContent.endsWith('By email to maya@example.test · stopped with Undo'));
});

test('a message that couldn’t go says why', async () => {
  const { pop } = await openMessages([msg({ id: 4, state: 'failed', pretend: false, sentAt: null, error: 'The number isn’t a mobile' })]);
  const [li] = await items(pop);
  assert.match(li.textContent, /^Bike readyNot sent/);
  assert.ok(li.textContent.includes('The number isn’t a mobile'));
});

test('no messages yet says so', async () => {
  const { pop } = await openMessages([]);
  assert.ok(has(await pop.findByText('No messages yet.')));
});

test('the job page itself shows no messages', async () => {
  const { dlg } = await openJob([msg({})]);
  await dlg.findByRole('button', { name: 'Message Maya Patel' });
  assert.equal(has(dlg.queryByText(READY)), false);
});

test('every other state has its words: Sending, Sent, Not sure it went, and going now once its time has passed', async () => {
  const past = new Date(Date.now() - 60_000).toISOString();
  const { pop } = await openMessages([
    msg({ id: 9, state: 'unknown', sentAt: null, pretend: false }),
    msg({ id: 8, state: 'delivered', pretend: false }),
    msg({ id: 7, state: 'sending', sentAt: null, pretend: false }),
    msg({ id: 6, state: 'intended', sendAfter: past, sentAt: null, pretend: false }),
  ]);
  const words = (await items(pop)).map((li) => li.textContent);
  assert.match(words[0], /^Bike readyWaiting.*· going now$/);
  assert.match(words[1], /^Bike readySending.*· going now$/);
  assert.match(words[2], /^Bike readySent.*· Thu 17 Sep, 15:31$/);
  assert.match(words[3], /^Bike readyNot sure it went/);
});

test('closing Messages puts focus back on the Message button', async () => {
  const { ui, pop, fireEvent, waitFor } = await openMessages([msg({})]);
  fireEvent.click(pop.getByRole('button', { name: 'Close' }));
  await waitFor(() => assert.equal(has(ui.queryByRole('dialog', { name: 'Messages' })), false));
  await waitFor(() => assert.equal(document.activeElement?.getAttribute('aria-label'), 'Message Maya Patel'));
});

test('with no messages there is no empty list, and the button asks for up to 200', async () => {
  const { pop } = await openMessages([]);
  await pop.findByText('No messages yet.');
  assert.equal(has(pop.queryByRole('list', { name: 'Messages with Maya Patel' })), false);
  assert.ok(calls.some((c) => c.url.includes('/api/messages?jobId=1&limit=200')));
});
