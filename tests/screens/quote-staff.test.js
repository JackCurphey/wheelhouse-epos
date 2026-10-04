// The quote stage, staff side (journey 4; drawn by quoteJobBoards in
// docs/design/user-journeys/generator/diary.mjs and by quote.mjs): build the
// quote in the job's work and parts, send it with a minute to Undo, record an
// answer taken by phone or in the shop, withdraw it; once answered, declined
// lines are struck through and the Approved total shows.
// The minute is shortened for the tests (window.WH_QUOTE_SEND_DELAY_MS).
// Spec: docs/superpowers/specs/2026-10-03-quote-stage-design.md (piece 2)
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const MECHANICS = [{ id: 11, name: 'Alex Morgan', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true }];
const PRODUCTS = [{ id: 40, sku: 'BP-01', barcode: '501', name: 'Brake pads (pair)', price: 18, stockQty: 6, active: true }];
const ORDER = { id: 80, kind: 'order', status: 'open', subtotal: 75, discount: 0, total: 75, items: [
  { id: 1, productId: null, name: 'Standard service', sku: null, unitPrice: 75, qty: 1, lineTotal: 75, lineType: 'labour', serviceId: 1, minutes: 90 },
] };
let JOB;
let QUOTE;
function job(over) {
  return {
    id: 1, title: 'Standard service', reference: 'WH-1042', customerId: 5, customerName: 'Maya Patel', bikeId: 7, bikeLabel: 'Trek Domane AL 3',
    mechanicId: 11, mechanicName: 'Alex Morgan', jobDate: '2026-10-05', startTime: '10:00', endTime: '11:30', status: 'scheduled',
    bookingState: 'scheduled', custodyState: 'in_shop', workState: 'not_started', version: 3, notes: null, requested: null,
    customerDescription: null, cancelledBy: null, cancelledAt: null, cancellationSeenAt: null, orderId: 80, orderStatus: 'open', orderTotal: 75,
    createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z', quote: null,
    parts: [{ id: 21, position: 1, date: '2026-10-05', startTime: '10:00', endTime: '11:30', mechanicId: 11, mechanicName: 'Alex Morgan' }],
    ...over,
  };
}
const line = (over) => ({ id: 1, kind: 'part', description: 'Brake pads (pair)', productId: 40, quantity: 1, unitAmount: 18, decision: 'pending', lineTotal: 18, need: 'needed', reason: 'Worn down to 1mm', decidedVia: null, decidedAt: null, decidedByName: null, addedToOrderAt: null, ...over });
const quote = (state, lines) => ({ id: 9, workshopJobId: 1, revision: 1, state, createdAt: '2026-10-05T09:00:00Z', sentAt: null, lines,
  totals: { all: lines.reduce((s, l) => s + l.lineTotal, 0), approved: lines.filter((l) => l.decision === 'approved').reduce((s, l) => s + l.lineTotal, 0), pending: lines.filter((l) => l.decision === 'pending').reduce((s, l) => s + l.lineTotal, 0), declined: lines.filter((l) => l.decision === 'declined').reduce((s, l) => s + l.lineTotal, 0) } });

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let sendAnswer;
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
    const method = init.method ?? 'GET';
    calls.push({ url, method, body: init.body ? JSON.parse(init.body) : undefined });
    const reply = (status, body) => ({ status, ok: status < 300, json: async () => body });
    const u = new URL(url, 'http://localhost');
    if (method === 'POST' && u.pathname === '/api/quotes/9/send') return reply(200, sendAnswer ?? { quote: { ...QUOTE, state: 'sent' }, message: { status: 'sent' }, link: 'http://localhost/book/north-street/booking/abc' });
    if (method === 'POST') return reply(u.pathname.endsWith('/quotes') ? 201 : 200, { ...(QUOTE ?? quote('draft', [])), id: 9 });
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/employees') return reply(200, MECHANICS);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/workshop-waiting') return reply(200, { count: 0, items: [] });
    if (u.pathname === '/api/workshop-jobs') return reply(200, [JOB]);
    if (u.pathname === '/api/workshop-jobs/1') return reply(200, JOB);
    if (u.pathname === '/api/sale-documents/80') return reply(200, ORDER);
    if (u.pathname === '/api/quotes/9') return reply(200, QUOTE);
    if (u.pathname === '/api/workshop-services') return reply(200, []);
    if (u.pathname === '/api/products') return reply(200, PRODUCTS);
    return reply(404, { error: 'Not found' });
  };
}

async function openJob({ jobOver = {}, q = null } = {}) {
  JOB = job({ ...jobOver, quote: q ? { id: 9, state: q.state, revision: 1 } : null });
  QUOTE = q;
  sendAnswer = null;
  uninstall = installDom('http://localhost/workshop/diary?date=2026-10-05');
  window.WH_QUOTE_SEND_DELAY_MS = 40;
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  stubServer();
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  rtl.fireEvent.click(await ui.findByRole('button', { name: /^Trek Domane AL 3, Standard service/ }));
  const dlg = rtl.within(await ui.findByRole('dialog', { name: /Standard service/ }));
  await rtl.waitFor(() => assert.equal(Boolean(dlg.queryByText('Loading…')), false));
  await dlg.findByRole('table');
  return { ...rtl, ui, dlg };
}

const posts = () => calls.filter((c) => c.method === 'POST').map((c) => `${c.url} ${JSON.stringify(c.body)}`);
const has = (q) => Boolean(q);

test('Add to quote puts a part on the quote as Needed, awaiting approval', async () => {
  const { dlg, fireEvent, waitFor } = await openJob();
  fireEvent.click(dlg.getByRole('button', { name: 'Add to quote' }));
  fireEvent.change(dlg.getByLabelText('Search products or services, or scan a barcode'), { target: { value: 'brake' } });
  fireEvent.click(await dlg.findByRole('button', { name: /Brake pads \(pair\)/ }));
  await waitFor(() => assert.deepEqual(posts(), ['/api/workshop-jobs/1/quotes {"lines":[{"kind":"part","description":"Brake pads (pair)","productId":40,"quantity":1,"unitAmount":18,"need":"needed","reason":""}]}']));
});

test('a draft line shows Awaiting approval, can be made Optional, and the Proposed total adds it to the booked work', async () => {
  const { dlg, fireEvent, waitFor } = await openJob({ q: quote('draft', [line({})]) });
  assert.ok(has(await dlg.findByText('Awaiting approval')));
  assert.ok(has(dlg.queryByText('Proposed total £93.00')));
  fireEvent.click(dlg.getByRole('switch', { name: 'Brake pads (pair): needed' }));
  await waitFor(() => assert.match(posts().at(-1) ?? '', /"need":"optional"/));
});

test('Send quote waits a minute with Undo; Undo stops it', async () => {
  const { dlg, fireEvent } = await openJob({ q: quote('draft', [line({})]) });
  fireEvent.click(await dlg.findByRole('button', { name: 'Send quote' }));
  assert.ok(has(dlg.queryByText('Sending the quote to Maya Patel by text in 1 minute.')));
  fireEvent.click(dlg.getByRole('button', { name: 'Undo' }));
  await new Promise((r) => setTimeout(r, 80));
  assert.deepEqual(posts(), []);
});

test('when the minute is up the quote is sent, and staff are told it went', async () => {
  const { dlg, fireEvent, waitFor } = await openJob({ q: quote('draft', [line({})]) });
  fireEvent.click(await dlg.findByRole('button', { name: 'Send quote' }));
  await waitFor(() => assert.deepEqual(posts(), ['/api/quotes/9/send {}']));
  assert.ok(has(await dlg.findByText('Quote sent to Maya Patel by text.')));
});

test('if the text could not go, staff are told why and can copy the link', async () => {
  const { dlg, fireEvent } = await openJob({ q: quote('draft', [line({})]) });
  sendAnswer = { quote: { ...QUOTE, state: 'sent' }, message: { status: 'not_sent', reason: 'Maya Patel has no phone number on file.' }, link: 'http://localhost/book/north-street/booking/abc' };
  fireEvent.click(await dlg.findByRole('button', { name: 'Send quote' }));
  assert.ok(has(await dlg.findByText('The quote is ready for Maya Patel, but no text went: Maya Patel has no phone number on file.')));
  assert.ok(has(dlg.queryByText('http://localhost/book/north-street/booking/abc')));
  assert.ok(has(dlg.queryByRole('button', { name: 'Copy link' })));
});

test('while waiting, the job says so, and staff can record the answer taken by phone', async () => {
  const lines = [line({}), line({ id: 2, kind: 'labour', description: 'Fit new gear cable', productId: null, unitAmount: 12, lineTotal: 12, need: 'optional', reason: 'Shifting is stiff' })];
  const { dlg, fireEvent, waitFor, within, ui } = await openJob({ q: quote('sent', lines) });
  assert.ok(has(await dlg.findByText('Quoting')));
  fireEvent.click(dlg.getByRole('button', { name: 'Record their answer' }));
  const rec = within(await ui.findByRole('dialog', { name: "Record Maya Patel's answer" }));
  // Ticks start the way the mechanic recommended: Needed yes, Optional no.
  assert.equal(rec.getByRole('checkbox', { name: 'Yes to Brake pads (pair)' }).checked, true);
  assert.equal(rec.getByRole('checkbox', { name: 'Yes to Fit new gear cable' }).checked, false);
  fireEvent.click(rec.getByRole('radio', { name: 'By phone' }));
  fireEvent.click(rec.getByRole('button', { name: 'Save: yes to 1 line, no thanks to 1' }));
  await waitFor(() => assert.deepEqual(posts(), ['/api/quotes/9/answer {"via":"phone","decisions":[{"lineId":1,"decision":"approved"},{"lineId":2,"decision":"declined"}]}']));
});

test('a sent quote can be withdrawn, after asking', async () => {
  const { dlg, fireEvent, waitFor, within, ui } = await openJob({ q: quote('sent', [line({})]) });
  fireEvent.click(await dlg.findByRole('button', { name: 'Withdraw quote' }));
  const confirm = within(await ui.findByRole('dialog', { name: 'Withdraw this quote?' }));
  fireEvent.click(confirm.getByRole('button', { name: 'Withdraw' }));
  await waitFor(() => assert.deepEqual(posts(), ['/api/quotes/9/withdraw {}']));
});

test('an answered quote strikes out what was declined and shows the Approved total', async () => {
  const lines = [line({ decision: 'approved', addedToOrderAt: '2026-10-05T10:00:00Z' }), line({ id: 2, kind: 'labour', description: 'Fit new gear cable', productId: null, unitAmount: 12, lineTotal: 12, need: 'optional', decision: 'declined' })];
  const { dlg } = await openJob({ q: quote('partly_approved', lines) });
  const declined = await dlg.findByText('Fit new gear cable');
  assert.ok(declined.closest('tr').className.includes('line-through'));
  assert.ok(has(dlg.queryByText('Declined')));
  assert.ok(has(dlg.queryByText('Approved total £75.00')));
  assert.ok(has(dlg.queryByText('Fit new gear cable declined. Anything beyond these lines needs a new approval.')));
});
