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
import { fakeJob } from '../helpers/fake-job.js';
import { fakeOrder } from '../helpers/fake-order.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const MECHANICS = [{ id: 11, name: 'Alex Morgan', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true }];
const PRODUCTS = [{ id: 40, sku: 'BP-01', barcode: '501', name: 'Brake pads (pair)', price: 18, stockQty: 6, active: true }];
const ORDER = fakeOrder({ id: 80, kind: 'order', status: 'open', subtotal: 75, discount: 0, total: 75, items: [
  { id: 1, productId: null, name: 'Standard service', sku: null, unitPrice: 75, qty: 1, lineTotal: 75, lineType: 'labour', serviceId: 1, minutes: 90 },
] });
let JOB;
let QUOTE;
function job(over) {
  return fakeJob({
    id: 1, title: 'Standard service', reference: 'WH-1042', customerId: 5, customerName: 'Maya Patel', bikeId: 7, bikeLabel: 'Trek Domane AL 3',
    mechanicId: 11, mechanicName: 'Alex Morgan', jobDate: '2026-10-05', startTime: '10:00', endTime: '11:30', status: 'scheduled',
    bookingState: 'scheduled', custodyState: 'in_shop', workState: 'not_started', version: 3, notes: null, requested: null,
    customerDescription: null, cancelledBy: null, cancelledAt: null, cancellationSeenAt: null, orderId: 80, orderStatus: 'open', orderTotal: 75,
    createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z', quote: null,
    parts: [{ id: 21, position: 1, date: '2026-10-05', startTime: '10:00', endTime: '11:30', mechanicId: 11, mechanicName: 'Alex Morgan' }],
    ...over,
  });
}
const line = (over) => ({ id: 1, kind: 'part', description: 'Brake pads (pair)', productId: 40, quantity: 1, unitAmount: 18, decision: 'pending', lineTotal: 18, need: 'needed', reason: 'Worn down to 1mm', decidedVia: null, decidedAt: null, decidedByName: null, addedToOrderAt: null, goesWithLineId: null, without: null, photoId: null, ...over });
const quote = (state, lines) => ({ id: 9, workshopJobId: 1, revision: 1, state, createdAt: '2026-10-05T09:00:00Z', sentAt: null, lines,
  totals: { all: lines.reduce((s, l) => s + l.lineTotal, 0), approved: lines.filter((l) => l.decision === 'approved').reduce((s, l) => s + l.lineTotal, 0), pending: lines.filter((l) => l.decision === 'pending').reduce((s, l) => s + l.lineTotal, 0), declined: lines.filter((l) => l.decision === 'declined').reduce((s, l) => s + l.lineTotal, 0) } });

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let sendAnswer;
let FILES = [];
let refuse = null; // a quote refusal the next POST gets, in the shop's words
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
    if (method === 'POST' && !refuse && u.pathname === '/api/quotes/9/within-limit') return reply(200, { quote: { ...QUOTE, state: 'approved' }, message: { status: 'sent', channel: 'sms' } });
    if (method === 'POST' && u.pathname === '/api/quotes/9/send') return reply(200, sendAnswer ?? { quote: { ...QUOTE, state: 'sent' }, message: { status: 'sent' }, link: 'http://localhost/book/north-street/booking/abc' });
    if (method === 'POST' && refuse) return reply(409, { error: refuse, code: 'illegal' });
    if (method === 'DELETE') return reply(200, { ok: true });
    if (method === 'GET' && u.pathname === '/api/workshop-jobs/1/attachments') return reply(200, FILES);
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

test('the quote goes the customer’s way, and staff are told which', async () => {
  const { dlg, fireEvent } = await openJob({ q: quote('draft', [line({})]) });
  sendAnswer = { quote: { ...QUOTE, state: 'sent' }, message: { status: 'sent', channel: 'email', to: 'maya@example.test', pretend: true }, link: 'http://localhost/book/north-street/booking/abc' };
  fireEvent.click(await dlg.findByRole('button', { name: 'Send quote' }));
  assert.ok(has(await dlg.findByText('Quote sent to Maya Patel by email.')));
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
  const rec = within(await ui.findByRole('dialog', { name: 'Record Maya’s answer' }));
  // Ticks start the way the mechanic recommended: Needed yes, Optional no.
  assert.equal(rec.getByRole('checkbox', { name: 'Yes to Brake pads (pair)' }).checked, true);
  assert.equal(rec.getByRole('checkbox', { name: 'Yes to Fit new gear cable' }).checked, false);
  // The drawn dq-record-answer wording, following how they answered.
  assert.ok(has(rec.queryByText('Quote for WH-1042 · answered by phone')));
  assert.ok(has(rec.queryByText('Tick what Maya agreed to on the phone. These answers are final once saved, as if answered online.')));
  fireEvent.click(rec.getByRole('radio', { name: 'In the shop' }));
  assert.ok(has(rec.queryByText('Quote for WH-1042 · answered in the shop')));
  assert.ok(has(rec.queryByText('Tick what Maya agreed to in the shop. These answers are final once saved, as if answered online.')));
  fireEvent.click(rec.getByRole('radio', { name: 'By phone' }));
  fireEvent.click(rec.getByRole('button', { name: 'Save: yes to 1 line, no thanks to 1' }));
  await waitFor(() => assert.deepEqual(posts(), ['/api/quotes/9/answer {"via":"phone","decisions":[{"lineId":1,"decision":"approved"},{"lineId":2,"decision":"declined"}]}']));
});

test('a sent quote can be withdrawn, after asking', async () => {
  const { dlg, fireEvent, waitFor, within, ui } = await openJob({ q: quote('sent', [line({})]) });
  fireEvent.click(await dlg.findByRole('button', { name: 'Withdraw quote' }));
  const confirm = within(await ui.findByRole('dialog', { name: 'Withdraw this quote?' }));
  // The drawn withdraw-title wording.
  assert.ok(has(confirm.queryByText('WH-1042 · Maya Patel')));
  assert.ok(has(confirm.queryByText('Maya’s page will say the quote was withdrawn and there’s nothing to answer. Only the booked work stays agreed.')));
  fireEvent.click(confirm.getByRole('button', { name: 'Withdraw quote' }));
  await waitFor(() => assert.deepEqual(posts(), ['/api/quotes/9/withdraw {}']));
});

// Jack, 15 Oct (issue #190): a quote refusal says why in plain words.
test('a refused quote action says why in plain words', async () => {
  const { dlg, fireEvent, within, ui } = await openJob({ q: quote('sent', [line({})]) });
  refuse = 'a quote that is approved cannot be withdrawn';
  try {
    fireEvent.click(await dlg.findByRole('button', { name: 'Withdraw quote' }));
    const confirm = within(await ui.findByRole('dialog', { name: 'Withdraw this quote?' }));
    fireEvent.click(confirm.getByRole('button', { name: 'Withdraw quote' }));
    assert.ok(Boolean(await ui.findByText('This quote has been approved, so it can\'t be withdrawn.')));
    assert.ok(ui.queryByText(/cannot be withdrawn/) === null);
  } finally { refuse = null; }
});

test('an answer the customer beat staff to says so in plain words', async () => {
  const lines = [line({})];
  const { dlg, fireEvent, within, ui } = await openJob({ q: quote('sent', lines) });
  refuse = 'a quote that is approved is not open for an answer';
  try {
    fireEvent.click(await dlg.findByRole('button', { name: 'Record their answer' }));
    const rec = within(await ui.findByRole('dialog', { name: 'Record Maya’s answer' }));
    fireEvent.click(rec.getByRole('radio', { name: 'By phone' }));
    fireEvent.click(rec.getByRole('button', { name: /^Save/ }));
    assert.ok(Boolean(await ui.findByText('This quote has been approved, so it can\'t be answered.')));
  } finally { refuse = null; }
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

// Goes with (decision 7, M2; dq-job-quote) and what happens without a Needed
// line (decision 7, H1).
const FIT = (over) => line({ id: 2, kind: 'labour', description: 'Fit and adjust brakes', productId: null, unitAmount: 12, lineTotal: 12, reason: 'Needed with the new pads', ...over });

test('a draft labour line can go with one of the quote’s parts, and the part line has no choice', async () => {
  const { dlg, fireEvent, waitFor } = await openJob({ q: quote('draft', [line({}), FIT({})]) });
  const pick = await dlg.findByRole('combobox', { name: 'Fit and adjust brakes goes with' });
  assert.deepEqual([...pick.options].map((o) => o.textContent), ['Nothing', 'Brake pads (pair)']);
  assert.ok(dlg.queryByRole('combobox', { name: 'Brake pads (pair) goes with' }) === null);
  fireEvent.change(pick, { target: { value: '1' } });
  await waitFor(() => assert.match(posts().at(-1) ?? '', /"description":"Fit and adjust brakes".*"goesWith":0/));
});

test('a saved pair shows as chosen, and Nothing takes it off', async () => {
  const { dlg, fireEvent, waitFor } = await openJob({ q: quote('draft', [line({}), FIT({ goesWithLineId: 1 })]) });
  const pick = await dlg.findByRole('combobox', { name: 'Fit and adjust brakes goes with' });
  assert.equal(pick.value, '1');
  fireEvent.change(pick, { target: { value: '' } });
  await waitFor(() => assert.ok(posts().length === 1 && !posts()[0].includes('goesWith')));
});

test('a draft Needed line takes what happens without it, in the mechanic’s words', async () => {
  const { dlg, fireEvent, waitFor } = await openJob({ q: quote('draft', [line({}), FIT({ need: 'optional' })]) });
  const box = await dlg.findByRole('textbox', { name: 'What happens without Brake pads (pair)' });
  assert.ok(dlg.queryByRole('textbox', { name: 'What happens without Fit and adjust brakes' }) === null, 'Optional lines have none');
  fireEvent.change(box, { target: { value: 'The rear brake stays worn.' } });
  fireEvent.blur(box);
  await waitFor(() => assert.match(posts().at(-1) ?? '', /"without":"The rear brake stays worn\."/));
});

test('once sent, the pair reads Goes with, and recording an answer ticks it together', async () => {
  const { dlg, fireEvent, within, ui } = await openJob({ q: quote('sent', [line({}), FIT({ goesWithLineId: 1 })]) });
  assert.ok(has(await dlg.findByText('Goes with Brake pads (pair)')));
  fireEvent.click(dlg.getByRole('button', { name: 'Record their answer' }));
  const rec = within(await ui.findByRole('dialog', { name: 'Record Maya’s answer' }));
  fireEvent.click(rec.getByRole('checkbox', { name: 'Yes to Brake pads (pair)' }));
  assert.equal(rec.getByRole('checkbox', { name: 'Yes to Fit and adjust brakes' }).checked, false);
  assert.ok(has(rec.queryByRole('button', { name: 'Save: yes to 0 lines, no thanks to 2' })));
});

test('Record their answer starts a mixed Needed and Optional pair ticked together', async () => {
  const { dlg, fireEvent, within, ui } = await openJob({ q: quote('sent', [line({}), FIT({ goesWithLineId: 1, need: 'optional' })]) });
  fireEvent.click(await dlg.findByRole('button', { name: 'Record their answer' }));
  const rec = within(await ui.findByRole('dialog', { name: 'Record Maya’s answer' }));
  assert.equal(rec.getByRole('checkbox', { name: 'Yes to Fit and adjust brakes' }).checked, true);
});

// A photo on a quote line (Jack, 1 Oct; dq-job-quote): one per line, one of the job's files.
const PNG_FILE = () => new window.File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'pads.png', { type: 'image/png' });

test('Add photo uploads the picture to the job’s files, then puts it on the line', async () => {
  const { dlg, fireEvent, waitFor } = await openJob({ q: quote('draft', [line({})]) });
  fireEvent.change(await dlg.findByLabelText('Add photo for Brake pads (pair)'), { target: { files: [PNG_FILE()] } });
  await waitFor(() => assert.equal(posts().length, 2));
  assert.equal(posts()[0], '/api/workshop-jobs/1/attachments {"filename":"pads.png","contentType":"image/png","dataBase64":"iVBORw=="}');
  assert.match(posts()[1], /^\/api\/workshop-jobs\/1\/quotes .*"photoId":9/);
});

test('a line’s photo opens larger, and can be replaced or taken off the line', async () => {
  const { dlg, fireEvent, waitFor, within, ui } = await openJob({ q: quote('draft', [line({ photoId: 30 })]) });
  fireEvent.click(await dlg.findByRole('button', { name: '1 photo — view or add for Brake pads (pair)' }));
  const big = within(await ui.findByRole('dialog', { name: 'Brake pads (pair)' }));
  assert.equal(big.getByRole('img', { name: 'Brake pads (pair)' }).getAttribute('src'), '/api/workshop-jobs/1/attachments/30');
  fireEvent.click(big.getByRole('button', { name: 'Remove from line' }));
  await waitFor(() => assert.equal(posts().length, 1));
  assert.ok(posts()[0].startsWith('/api/workshop-jobs/1/quotes') && !posts()[0].includes('photoId'));
});

test('Replace photo swaps the line’s picture', async () => {
  const { dlg, fireEvent, waitFor, within, ui } = await openJob({ q: quote('draft', [line({ photoId: 30 })]) });
  fireEvent.click(await dlg.findByRole('button', { name: '1 photo — view or add for Brake pads (pair)' }));
  const big = within(await ui.findByRole('dialog', { name: 'Brake pads (pair)' }));
  fireEvent.change(big.getByLabelText('Replace photo'), { target: { files: [PNG_FILE()] } });
  await waitFor(() => assert.equal(posts().length, 2));
  assert.match(posts()[1], /"photoId":9/);
});

test('a sent quote has no Add photo, as drawn', async () => {
  const { dlg } = await openJob({ q: quote('sent', [line({})]) });
  await dlg.findByText('Quoting');
  assert.ok(dlg.queryByLabelText('Add photo for Brake pads (pair)') === null);
});

test('removing a line’s photo from Files and photos fetches the quote again', async () => {
  FILES = [{ id: 30, workshopJobId: 1, originalName: 'pads.png', contentType: 'image/png', sizeBytes: 4, uploadedAt: '2026-10-05T10:00:00Z', fromCustomer: false }];
  try {
    const { dlg, fireEvent, waitFor, within, ui } = await openJob({ q: quote('draft', [line({ photoId: 30 })]) });
    const files = within(await dlg.findByRole('region', { name: 'Files and photos' }));
    const before = calls.filter((c) => c.method === 'GET' && c.url === '/api/quotes/9').length;
    fireEvent.click(await files.findByRole('button', { name: 'Remove pads.png' }));
    fireEvent.click(within(await ui.findByRole('dialog', { name: 'Remove pads.png?' })).getByRole('button', { name: 'Remove' }));
    await waitFor(() => assert.ok(calls.filter((c) => c.method === 'GET' && c.url === '/api/quotes/9').length > before, 'the quote is read again'));
  } finally { FILES = []; }
});

test('a photo saved after a slow upload keeps a reason saved meanwhile', async () => {
  const { dlg, fireEvent, waitFor } = await openJob({ q: quote('draft', [line({}), FIT({})]) });
  // The server's draft has moved on since the page loaded (a reason saved meanwhile).
  QUOTE = quote('draft', [line({ id: 11 }), FIT({ id: 12, reason: 'Saved while uploading' })]);
  fireEvent.change(await dlg.findByLabelText('Add photo for Brake pads (pair)'), { target: { files: [PNG_FILE()] } });
  await waitFor(() => assert.equal(posts().length, 2));
  assert.match(posts()[1], /"Saved while uploading"/);
  assert.match(posts()[1], /"photoId":9/);
});

// Jack, 22 Oct (docs/decisions/2026-10-22-quote-after-declined.md): after a
// customer says no to everything, staff can quote again.
test('after a quote is declined, Add to quote starts a new quote with just the new line', async () => {
  const { dlg, fireEvent, waitFor } = await openJob({ q: quote('declined', [line({ decision: 'declined', decidedVia: 'online' })]) });
  fireEvent.click(await dlg.findByRole('button', { name: 'Add to quote' }));
  fireEvent.change(dlg.getByLabelText('Search products or services, or scan a barcode'), { target: { value: 'brake' } });
  fireEvent.click(await dlg.findByRole('button', { name: /Brake pads \(pair\)/ }));
  await waitFor(() => assert.deepEqual(posts(), ['/api/workshop-jobs/1/quotes {"lines":[{"kind":"part","description":"Brake pads (pair)","productId":40,"quantity":1,"unitAmount":18,"need":"needed","reason":""}]}']));
});

// The customer's spending limit, as a tag on the job (Workshop day 42; job-page.mjs SPEND_LIMIT).
test('the job shows the customer’s spending limit, or that they want asking first', async () => {
  const { dlg } = await openJob({ jobOver: { spendLimit: 200 } });
  assert.ok(has(await dlg.findByText('Customer OK up to £200')));
  assert.equal(has(dlg.queryByText('Ask before any extra work')), false);
});

test('a job with no limit says to ask before any extra work', async () => {
  const { dlg } = await openJob();
  assert.ok(has(await dlg.findByText('Ask before any extra work')));
});

test('a large limit reads with a thousands comma', async () => {
  const { dlg } = await openJob({ jobOver: { spendLimit: 100000 } });
  assert.ok(has(await dlg.findByText('Customer OK up to £100,000')));
});

// Work within the customer's spending limit (Workshop day 41-43; dq-job-within).
const withinQuote = (wholeBill) => ({ ...quote('draft', [line({}), line({ id: 2, kind: 'labour', description: 'Fit and adjust brakes', productId: null, unitAmount: 28, lineTotal: 28 })]), limit: { spendLimit: 200, wholeBill } });

test('within the customer’s limit, the quote isn’t sent: Save and tell them, with a minute to Undo', async () => {
  const { dlg, fireEvent, waitFor } = await openJob({ jobOver: { spendLimit: 200 }, q: withinQuote(111) });
  assert.ok(has(await dlg.findByText('Within Maya’s £200 limit — no quote needed. Maya will be told what was added.')));
  assert.ok(dlg.queryByRole('button', { name: 'Send quote' }) === null);
  fireEvent.click(dlg.getByRole('button', { name: 'Save and tell Maya' }));
  assert.ok(has(await dlg.findByText('Adding the work and telling Maya by text in 1 minute.')));
  await waitFor(() => assert.deepEqual(posts(), ['/api/quotes/9/within-limit {}']));
  assert.ok(has(await dlg.findByText('Added, and Maya was told by text.')));
});

test('Undo stops Save and tell before anything is added', async () => {
  const { dlg, fireEvent } = await openJob({ jobOver: { spendLimit: 200 }, q: withinQuote(111) });
  window.WH_QUOTE_SEND_DELAY_MS = 400;
  fireEvent.click(await dlg.findByRole('button', { name: 'Save and tell Maya' }));
  fireEvent.click(await dlg.findByRole('button', { name: 'Undo' }));
  await new Promise((r) => setTimeout(r, 500));
  assert.deepEqual(posts(), []);
});

test('over the customer’s limit, the quote goes to them as usual', async () => {
  const { dlg } = await openJob({ jobOver: { spendLimit: 200 }, q: withinQuote(250) });
  assert.ok(has(await dlg.findByRole('button', { name: 'Send quote' })));
  assert.ok(dlg.queryByRole('button', { name: 'Save and tell Maya' }) === null);
  assert.ok(has(dlg.queryByText('Quotes are sent when the customer asked to be called first, or the total is over their limit.')));
});

// From the fresh review.
test('a refused Save and tell reads the quote again, so the panel can offer Send quote', async () => {
  const { dlg, fireEvent, waitFor } = await openJob({ jobOver: { spendLimit: 200 }, q: withinQuote(111) });
  const reads = () => calls.filter((c) => c.method === 'GET' && c.url === '/api/quotes/9').length;
  refuse = 'That takes the whole bill to £260.00, over the £200 limit. Send a quote instead.';
  try {
    fireEvent.click(await dlg.findByRole('button', { name: 'Save and tell Maya' }));
    const before = reads();
    assert.ok(has(await dlg.findByText('That takes the whole bill to £260.00, over the £200 limit. Send a quote instead.')));
    await waitFor(() => assert.ok(reads() > before));
  } finally { refuse = null; }
});

test('the proposed total is the whole bill the limit is checked against', async () => {
  const { dlg } = await openJob({ jobOver: { spendLimit: 200 }, q: withinQuote(111) });
  assert.ok(has(await dlg.findByText('Proposed total £111.00')));
});

test('with no limit, the drawn hint says when quotes go', async () => {
  const { dlg } = await openJob({ q: { ...quote('draft', [line({})]), limit: { spendLimit: null, wholeBill: 93 } } });
  assert.ok(has(await dlg.findByText('Quotes are sent when the customer asked to be called first, or the total is over their limit.')));
  assert.ok(has(dlg.queryByRole('button', { name: 'Send quote' })));
});
