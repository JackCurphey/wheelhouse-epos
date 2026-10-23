// "No answer yet" after the quote reminder (Jack, 1 Oct, drop-off and quote
// decision 4: "the job shows 'No answer yet' on Today and in the diary with
// the customer's number"; the Today line drawn as dq-today-no-answer;
// openspec/changes/quote-no-answer). In the diary the job's word is "No
// answer yet" instead of "Quoting"; its page says so with the number.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';
import { fakeJob } from '../helpers/fake-job.js';
import { fakeOrder } from '../helpers/fake-order.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const MECHANICS = [{ id: 11, name: 'Alex Morgan', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true }];
const CUSTOMER = { id: 5, name: 'Maya Patel', email: 'maya@example.test', phone: '07700 900142', active: true };
const ORDER = fakeOrder({ id: 80, kind: 'order', status: 'open', subtotal: 75, discount: 0, total: 75, items: [
  { id: 1, productId: null, name: 'Standard service', sku: null, unitPrice: 75, qty: 1, lineTotal: 75, lineType: 'labour', serviceId: 1, minutes: 90 },
] });
const LINE = { id: 1, kind: 'part', description: 'Brake pads (pair)', productId: 40, quantity: 1, unitAmount: 18, decision: 'pending', lineTotal: 18, need: 'needed', reason: 'Worn down to 1mm', decidedVia: null, decidedAt: null, decidedByName: null, addedToOrderAt: null, goesWithLineId: null, without: null, photoId: null };
// Sent Mon 5 Oct 10:15 and reminded Tue 6 Oct 10:15, London time.
const SENT = '2026-10-05T09:15:00Z';
const REMINDED = '2026-10-06T09:15:00Z';
const QUOTE = { id: 9, workshopJobId: 1, revision: 1, state: 'sent', createdAt: '2026-10-05T09:00:00Z', sentAt: SENT, lines: [LINE], totals: { all: 18, approved: 0, pending: 18, declined: 0 } };

let JOB;
function job(reminderSentAt) {
  return fakeJob({
    id: 1, title: 'Standard service', reference: 'WH-1042', customerId: 5, customerName: 'Maya Patel', bikeId: 7, bikeLabel: 'Trek Domane AL 3',
    mechanicId: 11, mechanicName: 'Alex Morgan', jobDate: '2026-10-05', startTime: '10:00', endTime: '11:30', status: 'scheduled',
    bookingState: 'scheduled', custodyState: 'in_shop', workState: 'not_started', version: 3, notes: null, requested: null,
    customerDescription: null, cancelledBy: null, cancelledAt: null, cancellationSeenAt: null, orderId: 80, orderStatus: 'open', orderTotal: 75,
    createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z',
    quote: { id: 9, state: 'sent', revision: 1, sentAt: SENT, reminderSentAt },
    parts: [{ id: 21, position: 1, date: '2026-10-05', startTime: '10:00', endTime: '11:30', mechanicId: 11, mechanicName: 'Alex Morgan' }],
  });
}

const realFetch = globalThis.fetch;
let uninstall;
let shell;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

function stubServer() {
  globalThis.fetch = async (url) => {
    const reply = (status, body) => ({ status, ok: status < 300, json: async () => body });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/employees') return reply(200, MECHANICS);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/workshop-waiting') return reply(200, { count: 0, items: [] });
    if (u.pathname === '/api/workshop-jobs') return reply(200, [JOB]);
    if (u.pathname === '/api/workshop-jobs/1') return reply(200, JOB);
    if (u.pathname === '/api/workshop-jobs/1/attachments') return reply(200, []);
    if (u.pathname === '/api/customers/5') return reply(200, CUSTOMER);
    if (u.pathname === '/api/sale-documents/80') return reply(200, ORDER);
    if (u.pathname === '/api/quotes/9') return reply(200, QUOTE);
    if (u.pathname === '/api/workshop-services') return reply(200, []);
    if (u.pathname === '/api/products') return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
}

async function openDiary(reminderSentAt, query = '?date=2026-10-05', first = /^Trek Domane AL 3, Standard service/) {
  JOB = job(reminderSentAt);
  uninstall = installDom(`http://localhost/workshop/diary${query}`);
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  stubServer();
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  const block = await ui.findByRole('button', { name: first });
  return { ...rtl, ui, block };
}
async function openJob(reminderSentAt) {
  const { fireEvent, within, waitFor, ui, block } = await openDiary(reminderSentAt);
  fireEvent.click(block);
  const dlg = within(await ui.findByRole('dialog', { name: /Standard service/ }));
  await waitFor(() => assert.equal(Boolean(dlg.queryByText('Loading…')), false));
  await dlg.findByRole('button', { name: 'Record their answer' });
  return { dlg };
}

test('after the reminder, the week’s block says No answer yet, not Quoting', async () => {
  const { block } = await openDiary(REMINDED);
  const name = block.getAttribute('aria-label') ?? block.textContent;
  assert.match(name, /, No answer yet,/);
  assert.equal(/Quoting/.test(name), false);
});

test('before the reminder, it still says Quoting', async () => {
  const { block } = await openDiary(null);
  assert.match(block.getAttribute('aria-label') ?? block.textContent, /, Quoting,/);
  assert.equal(block.textContent.includes('No answer yet'), false);
});

test('a wide block in the day view shows No answer yet', async () => {
  const { block } = await openDiary(REMINDED, '?date=2026-10-05&view=day');
  const seen = [...block.querySelectorAll(':scope > [aria-hidden="true"]')].map((el) => el.textContent).join(' | ');
  assert.match(seen, /No answer yet/);
});

// A month chip has no room for words (diary-month.tsx): its name says it.
test('the month view’s chip is named No answer yet', async () => {
  const { block } = await openDiary(REMINDED, '?date=2026-10-05&view=month', /^10:00, Trek Domane AL 3/);
  assert.match(block.getAttribute('aria-label') ?? '', /, No answer yet$/);
});

test('the job’s page says no answer yet, when it was sent and reminded, and the customer’s number', async () => {
  const { dlg } = await openJob(REMINDED);
  const said = await dlg.findByText('No answer to the quote yet');
  const box = said.closest('[role="note"]');
  assert.ok(box !== null, 'in its own note');
  assert.match(box.textContent, /Sent Mon 5 Oct, 10:15 · reminder sent Tue 6 Oct, 10:15 · 07700 900142/);
  const tel = [...box.querySelectorAll('a')].find((a) => a.textContent === '07700 900142');
  assert.equal(tel?.getAttribute('href'), 'tel:07700900142');
});

test('before the reminder the job’s page has no such line', async () => {
  const { dlg } = await openJob(null);
  assert.ok(dlg.queryByText('No answer to the quote yet') === null);
});
