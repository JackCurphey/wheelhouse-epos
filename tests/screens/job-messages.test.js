// The job's messages, the outbox (Jack, 20 Oct, docs/decisions/2026-10-20-messages-engine.md
// answer 2; drawn as job-messages): under Notes, "Pretend for now: each shows
// what Maya would get. Nothing is really sent.", newest first, each with its
// name, Waiting or Pretend, how and when, and the words.
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
  error: null, createdAt: '2026-09-17T14:30:00.000Z', ...over,
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
const has = (q) => Boolean(q);

test('the job’s messages, newest first: Waiting with when it goes, then Pretend with when, and the words', async () => {
  const soon = new Date(Date.now() + 60_000).toISOString();
  const { dlg } = await openJob([
    msg({ id: 2, state: 'intended', sendAfter: soon, sentAt: null, pretend: false }),
    msg({ id: 1, key: 'quote_to_approve', name: 'Quote to approve', body: QUOTE }),
  ]);
  const section = (await dlg.findByRole('heading', { name: 'Messages' })).closest('section');
  const t = section.textContent;
  assert.ok(t.includes('Pretend for now: each shows what Maya would get. Nothing is really sent.'));
  const items = [...section.querySelectorAll('li')];
  assert.equal(items.length, 2);
  const at = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(soon));
  assert.match(items[0].textContent, /^Bike readyWaiting/);
  assert.ok(items[0].textContent.includes(`By text to 07700 900 142 · goes at ${at}`));
  assert.ok(items[0].textContent.includes(READY));
  assert.match(items[1].textContent, /^Quote to approvePretend/);
  assert.ok(items[1].textContent.includes('By text to 07700 900 142 · Thu 17 Sep, 15:31'));
  assert.ok(items[1].textContent.includes(QUOTE));
});

test('an email says so, and an undone message says it was stopped', async () => {
  const { dlg } = await openJob([
    msg({ id: 3, channel: 'email', to: 'maya@example.test', state: 'undone', sentAt: null }),
  ]);
  const section = (await dlg.findByRole('heading', { name: 'Messages' })).closest('section');
  const [li] = section.querySelectorAll('li');
  assert.match(li.textContent, /^Bike readyUndone/);
  assert.ok(li.textContent.includes('By email to maya@example.test · stopped with Undo'));
});

test('a message that couldn’t go says why', async () => {
  const { dlg } = await openJob([msg({ id: 4, state: 'failed', pretend: false, sentAt: null, error: 'The number isn’t a mobile' })]);
  const section = (await dlg.findByRole('heading', { name: 'Messages' })).closest('section');
  const [li] = section.querySelectorAll('li');
  assert.match(li.textContent, /^Bike readyNot sent/);
  assert.ok(li.textContent.includes('The number isn’t a mobile'));
});

test('a job with no messages shows no Messages section', async () => {
  const { dlg, waitFor } = await openJob([]);
  await waitFor(() => assert.ok(calls.some((c) => c.url.includes('/api/messages?jobId=1'))));
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(has(dlg.queryByRole('heading', { name: 'Messages' })), false);
});
