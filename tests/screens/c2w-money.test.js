// Front desk › Cycle to Work › the order: the provider's payment (openspec/changes/
// cycle-to-work task 8's order-page screens, PR 8d; c2w.mjs cw-order-owed,
// cw-mark-paid, cw-mark-paid-diff, cw-order-part-paid, cw-order-paid). The Owed
// pages and Record a payment come with PR 8e. Example data from the drawing:
// North Street Cycles, Bolton, Jo Taylor, Jack Lewis, Maya Patel. Providers,
// bikes, certificate numbers and references stay bracketed; dates and amounts
// are visibly test values.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const JO = { id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const BIKE = { id: 21, name: '[Bike] · [Size]', sku: null, pricePence: 80000, price: 800, supplier: '[Supplier]' };
const PROVIDER = { id: 3, name: '[Provider]', paysInDays: 30, accessoriesInside: true, commissionKind: 'percent', commissionValue: 500, handoverNote: '', handoverChecks: [], retiredAt: null };
const SETTINGS = { holdDays: 7, remindDays: 2, quoteValidDays: 30, orderRule: 'certificate', depositKind: 'percent', depositValue: null, depositOnCertificate: 'refund', depositOnPullOut: 'refund', howToApply: '[The shop’s own words]', todayLines: true, noCertificateDays: null, paymentLateDays: 7 };

const TODAY = '2026-09-14';
const day = (n) => { const d = new Date(`${TODAY}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const long = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
// Collected today: a £800.00 certificate, the provider keeps 5%, so £760.00 is expected in 30 days.
const order = (over = {}) => ({
  supplier: '[Supplier]',
  id: 9, stage: 'collected', quoteNumber: 1, quoteRef: 'CW-1', customerId: 5, customerName: 'Maya Patel', customerPhone: '07700 900 142', customerEmail: 'maya@example.test',
  providerId: 3, providerName: '[Provider]', productId: 21, bike: '[Bike] · [Size]', siteId: 1, siteName: 'Bolton', frameId: 40, onOrder: false,
  quoteGivenAt: `${day(-20)}T10:00:00.000Z`, quoteRevisedAt: null, validUntil: day(10), holdUntil: null, holdWanted: true,
  accessories: [], totalPence: 80000, appliedAt: null, applicationReference: null,
  certificateNumber: '[certificate number]', certificatePence: 80000, certificateReceivedOn: day(-10), differenceChoice: null, providerPaysPence: 80000, customerPaysPence: null, certificateLate: false,
  saleId: 300, collectedAt: `${TODAY}T09:00:00.000Z`, paidOn: null, closeReason: null, inStock: true, held: false, purchaseOrderId: null, orderedFrom: null, releasedAt: null,
  expectedPence: 76000, expectedBy: day(30), paidPence: null, providerReference: null, next: 'paid', ...over,
});
const QUOTE_EV = { kind: 'quote_given', by: 'Jo Taylor', at: `${day(-20)}T10:00:00.000Z`, reason: null, detail: { quoteRef: 'CW-1', closing: '' } };
const PART_EV = { kind: 'part_paid', by: 'Jack Lewis', at: `${TODAY}T12:00:00.000Z`, reason: null, detail: { amountPence: 70000, receivedOn: TODAY, paymentId: 1 } };

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let state;
let rendered = false;
afterEach(async () => {
  if (!rendered) return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
  rendered = false;
});

/** `paid` answers POST /api/c2w/orders/9/paid with [status, body] (or a promise of it); it may change `state`, which the page then reloads. */
async function open({ theOrder = order(), events = [QUOTE_EV], user = OWNER, paid, settings = SETTINGS, providers = [PROVIDER] } = {}) {
  calls = [];
  state = { order: theOrder, events };
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: String(url), method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const p = new URL(url, 'http://localhost').pathname;
    if (p === '/api/auth/me') return reply(200, user);
    if (p === '/api/c2w/count') return reply(200, { count: 1 });
    if (p === '/api/c2w/settings') return reply(200, { settings });
    if (p === '/api/c2w/providers') return reply(200, { providers });
    if (p === '/api/products/21') return reply(200, BIKE);
    if (method === 'POST' && p === '/api/c2w/orders/9/paid' && paid) { const [status, b] = await paid(body); return reply(status, b); }
    if (method === 'POST') return reply(404, { error: 'Not found' });
    if (p === '/api/c2w/orders/9') return reply(200, { order: { ...state.order, events: state.events }, today: TODAY });
    if (p.startsWith('/api/')) return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom('http://localhost/workshop/c2w/9');
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  rendered = true;
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui };
}
const posts = () => calls.filter((c) => c.method === 'POST' && c.url.endsWith('/api/c2w/orders/9/paid'));
const para = (text) => (_, el) => el?.tagName === 'P' && el.textContent === text;
const openMarkPaid = async (ui, fireEvent, button = 'Mark paid') => {
  fireEvent.click(await ui.findByRole('button', { name: button }));
  return ui.findByRole('dialog', { name: 'Mark paid' });
};
const typeAmount = (box, fireEvent, value) => fireEvent.change(box.getByRole('textbox', { name: 'Amount received' }), { target: { value } });

// What the server does with each kind of payment (server/c2w/money.js applyToOrder), so the page reloads into it.
const step = (kind, body, extra = {}) => {
  const owed = state.order.expectedPence - (state.order.paidPence ?? 0);
  const put = kind === 'paid' ? owed : body.amountPence;
  const detail = { amountPence: put, receivedOn: body.receivedOn, ...(body.reference ? { reference: body.reference } : {}), ...extra };
  if (kind === 'paid' && body.amountPence !== put) { detail.paymentPence = body.amountPence; detail.extraPence = body.amountPence - put; }
  if (kind === 'shortfall_closed') detail.shortfallPence = owed - put;
  state.order = {
    ...state.order,
    paidPence: (state.order.paidPence ?? 0) + put,
    ...(kind === 'paid' ? { stage: 'paid', paidOn: body.receivedOn, next: null } : {}),
    ...(kind === 'shortfall_closed' ? { stage: 'closed', closeReason: body.reason, next: null } : {}),
  };
  state.events = [...state.events, { kind, by: 'Jack Lewis', at: `${TODAY}T15:00:00.000Z`, reason: body.reason ?? null, detail }];
  return [200, { order: state.order }];
};
const answer = (body) => step(body.as === 'part' ? 'part_paid' : body.as === 'close' ? 'shortfall_closed' : 'paid', body);

test('cw-order-owed: an owner sees what the provider is expected to pay, by when, and Mark paid', async () => {
  const { ui, within } = await open();
  const next = within(await ui.findByRole('region', { name: 'Next: the provider’s payment' }));
  assert.ok(next.getByText(para(`Expected £760.00 from [Provider] by ${long(day(30))} — the certificate £800.00 less 5% commission.`)));
  assert.ok(next.getByRole('button', { name: 'Mark paid' }));
  assert.ok(next.getByText('If it hasn’t arrived 7 days after that, it shows on Today.'));
  assert.ok(ui.queryByRole('button', { name: 'More for Maya Patel’s order' }) === null);
});

test('cw-order-owed: someone who can’t see costs sees what’s expected but not the commission, and no Mark paid', async () => {
  // The server leaves the commission off the provider for them (c2w-settings serializeProvider); decision H3.
  const { commissionKind, commissionValue, ...noCosts } = PROVIDER;
  const { ui, within } = await open({ user: JO, providers: [noCosts] });
  const next = within(await ui.findByRole('region', { name: 'Next: the provider’s payment' }));
  assert.ok(next.getByText(para(`Expected £760.00 from [Provider] by ${long(day(30))}.`)));
  assert.ok(next.queryByText(/commission/) === null);
  assert.ok(next.queryByRole('button', { name: 'Mark paid' }) === null);
});

test('cw-mark-paid: the popup starts at what’s expected, today; Cancel closes it and nothing is sent', async () => {
  const { ui, within, fireEvent } = await open();
  const box = within(await openMarkPaid(ui, fireEvent));
  assert.ok(box.getByText(`Maya Patel · [Provider] · expected £760.00 by ${long(day(30))}`));
  assert.equal(box.getByRole('textbox', { name: 'Amount received' }).value, '760.00');
  assert.equal(box.getByLabelText('Received on').value, TODAY);
  assert.equal(box.getByRole('textbox', { name: 'Provider’s reference' }).value, '');
  assert.ok(box.getByText('Optional — from the remittance'));
  assert.ok(box.getByText(para('Matches what was expected.')));
  assert.ok(box.getByText('This goes in the order’s history and the activity log.'));
  assert.ok(box.getByText('The payment goes to your accounts software with that day’s figures, as “[Provider] paid £760.00 · commission £40.00”.'));
  fireEvent.click(box.getByRole('button', { name: 'Cancel' }));
  assert.ok(ui.queryByRole('dialog', { name: 'Mark paid' }) === null);
  assert.equal(posts().length, 0);
});

test('cw-mark-paid → cw-order-paid: Mark paid sends what’s owed; the order then says Paid, as expected, with the history line', async () => {
  const { ui, within, fireEvent } = await open({ paid: answer });
  const box = within(await openMarkPaid(ui, fireEvent));
  fireEvent.change(box.getByRole('textbox', { name: 'Provider’s reference' }), { target: { value: '[reference]' } });
  fireEvent.click(box.getByRole('button', { name: 'Mark paid' }));
  const next = within(await ui.findByRole('region', { name: 'Paid' }));
  assert.deepEqual(posts().map((c) => c.body), [{ amountPence: 76000, receivedOn: TODAY, reference: '[reference]', as: null, owedPence: 76000 }]);
  assert.ok(next.getByText(para(`£760.00 received from [Provider] on ${long(TODAY)}, as expected.`)));
  assert.ok(ui.queryByRole('dialog', { name: 'Mark paid' }) === null);
  assert.ok(await ui.findByText(`marked paid: £760.00 received ${long(TODAY)} · reference [reference]`));
});

test('cw-mark-paid: a blank reference isn’t sent, and an amount that isn’t pounds and pence is refused before sending', async () => {
  const { ui, within, fireEvent } = await open({ paid: answer });
  const box = within(await openMarkPaid(ui, fireEvent));
  typeAmount(box, fireEvent, 'lots');
  fireEvent.click(box.getByRole('button', { name: 'Mark paid' }));
  assert.equal(box.getByRole('alert').textContent, 'Pounds and pence, like 5.00');
  assert.equal(posts().length, 0);
  typeAmount(box, fireEvent, '760');
  fireEvent.click(box.getByRole('button', { name: 'Mark paid' }));
  await ui.findByRole('region', { name: 'Paid' });
  assert.deepEqual(posts().map((c) => c.body), [{ amountPence: 76000, receivedOn: TODAY, as: null, owedPence: 76000 }]);
});

test('cw-mark-paid-diff: less than expected offers part paid or closing it; Save as part paid sends as part', async () => {
  const { ui, within, fireEvent } = await open({ paid: answer });
  const box = within(await openMarkPaid(ui, fireEvent));
  typeAmount(box, fireEvent, '700.00');
  assert.ok(box.getByText(para('£60.00 less than expected. Save it as part paid and keep chasing the rest, or close it with a reason.')));
  assert.ok(box.queryByText(para('Matches what was expected.')) === null);
  assert.ok(box.queryByRole('button', { name: 'Mark paid' }) === null);
  assert.ok(box.getByRole('button', { name: 'Close with a reason…' }));
  assert.ok(box.getByText('The payment goes to your accounts software with that day’s figures, as “[Provider] paid £700.00 · commission £40.00”.'));
  fireEvent.click(box.getByRole('button', { name: 'Save as part paid' }));
  const next = within(await ui.findByRole('region', { name: 'Next: the rest of the payment' }));
  assert.deepEqual(posts().map((c) => c.body), [{ amountPence: 70000, receivedOn: TODAY, as: 'part', owedPence: 76000 }]);
  assert.ok(next.getByText(para('£700.00 of £760.00 received from [Provider]. £60.00 still owed — it stays on the owed list and on Today if it’s late.')));
  assert.ok(next.getByRole('button', { name: 'Mark the rest paid' }));
  assert.ok(next.getByRole('button', { name: 'Close with a reason…' }));
  assert.ok(await ui.findByText(`saved part paid: £700.00 of £760.00 received ${long(TODAY)} · £60.00 still owed`));
});

test('cw-order-part-paid: Mark the rest paid starts at what’s still owed and sends it', async () => {
  const { ui, within, fireEvent } = await open({ theOrder: order({ paidPence: 70000 }), events: [QUOTE_EV, PART_EV], paid: answer });
  const box = within(await openMarkPaid(ui, fireEvent, 'Mark the rest paid'));
  assert.equal(box.getByRole('textbox', { name: 'Amount received' }).value, '60.00');
  assert.ok(box.getByText(para('Matches what was expected.')));
  fireEvent.click(box.getByRole('button', { name: 'Mark paid' }));
  const next = within(await ui.findByRole('region', { name: 'Paid' }));
  assert.deepEqual(posts().map((c) => c.body), [{ amountPence: 6000, receivedOn: TODAY, as: null, owedPence: 6000 }]);
  assert.ok(next.getByText(para(`£760.00 received from [Provider] on ${long(TODAY)}, as expected.`)));
  assert.ok(await ui.findByText(`marked paid: £60.00 received ${long(TODAY)}`));
});

test('cw-mark-paid-diff: Close with a reason… asks why, then closes it with what was received', async () => {
  const { ui, within, fireEvent } = await open({ paid: answer });
  const box = within(await openMarkPaid(ui, fireEvent));
  typeAmount(box, fireEvent, '700.00');
  fireEvent.click(box.getByRole('button', { name: 'Close with a reason…' }));
  fireEvent.click(box.getByRole('button', { name: 'Close it' }));
  assert.equal(box.getByRole('alert').textContent, 'Say why it’s being closed');
  assert.equal(posts().length, 0);
  fireEvent.change(box.getByRole('textbox', { name: 'Why?' }), { target: { value: '[reason]' } });
  fireEvent.click(box.getByRole('button', { name: 'Close it' }));
  assert.ok(await ui.findByText(para('Closed with £60.00 not paid. [reason]')));
  assert.deepEqual(posts().map((c) => c.body), [{ amountPence: 70000, receivedOn: TODAY, as: 'close', reason: '[reason]', owedPence: 76000 }]);
  assert.ok(ui.queryByRole('list', { name: 'Stages' }) === null);
  assert.ok(await ui.findByText(`closed it with £60.00 not paid: £700.00 received ${long(TODAY)} · [reason]`));
});

test('cw-order-part-paid: Close with a reason… closes the rest with nothing more received', async () => {
  const { ui, within, fireEvent } = await open({ theOrder: order({ paidPence: 70000 }), events: [QUOTE_EV, PART_EV], paid: answer });
  fireEvent.click(await ui.findByRole('button', { name: 'Close with a reason…' }));
  const box = within(await ui.findByRole('dialog', { name: 'Mark paid' }));
  assert.ok(box.queryByRole('textbox', { name: 'Amount received' }) === null);
  fireEvent.change(box.getByRole('textbox', { name: 'Why?' }), { target: { value: '[reason]' } });
  fireEvent.click(box.getByRole('button', { name: 'Close it' }));
  assert.ok(await ui.findByText(para('Closed with £60.00 not paid. [reason]')));
  assert.deepEqual(posts().map((c) => c.body), [{ amountPence: 0, receivedOn: TODAY, as: 'close', reason: '[reason]', owedPence: 6000 }]);
  assert.ok(await ui.findByText('closed it with £60.00 not paid · [reason]'));
});

test('cw-mark-paid: more than expected is said, sent as paid, and the extra is noted', async () => {
  const { ui, within, fireEvent } = await open({ paid: answer });
  const box = within(await openMarkPaid(ui, fireEvent));
  typeAmount(box, fireEvent, '800.00');
  assert.ok(box.getByText(para('£40.00 more than expected. The extra £40.00 is noted.')));
  fireEvent.click(box.getByRole('button', { name: 'Mark paid' }));
  const next = within(await ui.findByRole('region', { name: 'Paid' }));
  assert.deepEqual(posts().map((c) => c.body), [{ amountPence: 80000, receivedOn: TODAY, as: 'paid', owedPence: 76000 }]);
  assert.ok(next.getByText(para(`£800.00 received from [Provider] on ${long(TODAY)}.`)));
  assert.ok(await ui.findByText(`marked paid: £800.00 received ${long(TODAY)} · the extra £40.00 is noted`));
});

test('cw-mark-paid: while saving the popup can’t be closed; what the server says shows in it', async () => {
  let release;
  const { ui, within, fireEvent } = await open({
    paid: () => new Promise((r) => { release = () => r([409, { error: 'What’s owed has changed since you opened this. Refresh to see what’s owed now.', code: 'owed_changed' }]); }),
  });
  const dialog = await openMarkPaid(ui, fireEvent);
  const box = within(dialog);
  fireEvent.click(box.getByRole('button', { name: 'Mark paid' }));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(box.getByRole('button', { name: 'Cancel' }).disabled, true);
  assert.equal(box.getByRole('button', { name: 'Mark paid' }).disabled, true);
  const esc = new window.Event('cancel', { cancelable: true });
  dialog.dispatchEvent(esc);
  assert.equal(esc.defaultPrevented, true);
  release();
  assert.equal((await box.findByRole('alert')).textContent, 'What’s owed has changed since you opened this. Refresh to see what’s owed now.');
  assert.ok(ui.getByRole('dialog', { name: 'Mark paid' }));
  assert.equal(box.getByRole('button', { name: 'Cancel' }).disabled, false);
});

test('cw-order-owed: when the order’s figures don’t match the provider’s rate now, the commission is given in pounds', async () => {
  // Expected £740.00 against an £800.00 certificate is £60.00 kept, not the provider's 5% today.
  const { ui, within } = await open({ theOrder: order({ expectedPence: 74000 }) });
  const next = within(await ui.findByRole('region', { name: 'Next: the provider’s payment' }));
  assert.ok(next.getByText(para(`Expected £740.00 from [Provider] by ${long(day(30))} — the certificate £800.00 less £60.00 commission.`)));
});

test('cw-order-owed: with no late-payment days set, there’s no Today note', async () => {
  const { ui, within } = await open({ settings: { ...SETTINGS, paymentLateDays: null } });
  const next = within(await ui.findByRole('region', { name: 'Next: the provider’s payment' }));
  assert.ok(next.queryByText(/shows on Today/) === null);
});

test('cw-order-part-paid: someone who isn’t the owner sees what’s still owed but no buttons', async () => {
  const { ui, within } = await open({ user: JO, theOrder: order({ paidPence: 70000 }), events: [QUOTE_EV, PART_EV] });
  const next = within(await ui.findByRole('region', { name: 'Next: the rest of the payment' }));
  assert.ok(next.queryByRole('button') === null);
});

test('cw-order-paid: a payment covering several bikes shows only what went on this order', async () => {
  const paidEv = { kind: 'paid', by: 'Jack Lewis', at: `${TODAY}T12:00:00.000Z`, reason: null, detail: { amountPence: 76000, paymentPence: 228000, receivedOn: TODAY, paymentId: 4 } };
  const { ui, within } = await open({ theOrder: order({ stage: 'paid', paidPence: 76000, paidOn: TODAY, next: null }), events: [QUOTE_EV, paidEv] });
  const next = within(await ui.findByRole('region', { name: 'Paid' }));
  assert.ok(next.getByText(para(`£760.00 received from [Provider] on ${long(TODAY)}, as expected.`)));
  assert.ok(await ui.findByText(`marked paid: £760.00 received ${long(TODAY)}`));
});

test('cw-mark-paid: clearing Received on puts back today, so the date saved is the one shown', async () => {
  const { ui, within, fireEvent } = await open();
  const box = within(await openMarkPaid(ui, fireEvent));
  const on = box.getByLabelText('Received on');
  fireEvent.change(on, { target: { value: '' } });
  assert.equal(on.value, TODAY);
});

test('cw-mark-paid: the difference message is announced as it changes', async () => {
  const { ui, within, fireEvent } = await open();
  const box = within(await openMarkPaid(ui, fireEvent));
  const status = box.getByRole('status');
  assert.equal(status.textContent, 'Matches what was expected.');
  typeAmount(box, fireEvent, '700.00');
  assert.equal(status.textContent, '£60.00 less than expected. Save it as part paid and keep chasing the rest, or close it with a reason.');
});

test('cw-mark-paid: nothing received can be closed with a reason, not saved as part paid', async () => {
  const { ui, within, fireEvent } = await open({ paid: answer });
  const box = within(await openMarkPaid(ui, fireEvent));
  typeAmount(box, fireEvent, '0');
  assert.ok(box.queryByRole('button', { name: 'Save as part paid' }) === null);
  fireEvent.click(box.getByRole('button', { name: 'Close with a reason…' }));
  const why = box.getByRole('textbox', { name: 'Why?' });
  assert.ok(document.activeElement === why);
  fireEvent.change(why, { target: { value: '[reason]' } });
  fireEvent.click(box.getByRole('button', { name: 'Close it' }));
  const closed = await ui.findByRole('region', { name: 'Closed with £760.00 not paid.' });
  assert.ok(closed);
  assert.deepEqual(posts().map((c) => c.body), [{ amountPence: 0, receivedOn: TODAY, as: 'close', reason: '[reason]', owedPence: 76000 }]);
});

test('cw-mark-paid: after saving, a note says so and focus moves to the new box', async () => {
  const { ui, within, fireEvent } = await open({ paid: answer });
  const box = within(await openMarkPaid(ui, fireEvent));
  fireEvent.click(box.getByRole('button', { name: 'Mark paid' }));
  await ui.findByRole('region', { name: 'Paid' });
  assert.ok(await ui.findByText('Marked paid.'));
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(document.activeElement?.textContent, 'Paid');
});

test('cw-mark-paid: Back from the reason step returns to the amount', async () => {
  const { ui, within, fireEvent } = await open();
  const box = within(await openMarkPaid(ui, fireEvent));
  typeAmount(box, fireEvent, '700.00');
  fireEvent.click(box.getByRole('button', { name: 'Close with a reason…' }));
  fireEvent.click(box.getByRole('button', { name: 'Back' }));
  await new Promise((r) => setTimeout(r, 10));
  const amount = box.getByRole('textbox', { name: 'Amount received' });
  assert.equal(amount.value, '700.00');
  assert.ok(document.activeElement === amount);
});

test('cw-mark-paid: what’s owed is fixed while the popup is open, even if the page reloads', async () => {
  const { ui, within, fireEvent } = await open({ paid: () => [409, { error: 'What’s owed has changed since you opened this. Refresh to see what’s owed now.', code: 'owed_changed' }] });
  const box = within(await openMarkPaid(ui, fireEvent));
  step('part_paid', { amountPence: 70000, receivedOn: TODAY }); // recorded on another computer
  await shell.queryClient.invalidateQueries({ queryKey: ['c2w-order', 9] });
  await ui.findByRole('region', { name: 'Next: the rest of the payment' });
  assert.ok(box.getByText('Matches what was expected.'));
  fireEvent.click(box.getByRole('button', { name: 'Mark paid' }));
  await box.findByRole('alert');
  assert.deepEqual(posts().map((c) => c.body.owedPence), [76000]);
});

test('cw-mark-paid: when the server says what’s owed changed, the popup catches up, keeps what was typed, and the next try uses the new figure', async () => {
  let first = true;
  const { ui, within, fireEvent } = await open({
    paid: (body) => {
      if (!first) return answer(body);
      first = false;
      step('part_paid', { amountPence: 70000, receivedOn: TODAY }); // someone else saved part paid meanwhile
      return [409, { error: 'What’s owed has changed since you opened this. Refresh to see what’s owed now.', code: 'owed_changed' }];
    },
  });
  const box = within(await openMarkPaid(ui, fireEvent));
  fireEvent.click(box.getByRole('button', { name: 'Mark paid' }));
  await box.findByRole('alert');
  await ui.findByRole('region', { name: 'Next: the rest of the payment' });
  await new Promise((r) => setTimeout(r, 10));
  // What came is from the remittance, so it stays; the difference is worked out against the new figure.
  assert.equal(box.getByRole('textbox', { name: 'Amount received' }).value, '760.00');
  assert.equal(box.getByRole('status').textContent, '£700.00 more than expected. The extra £700.00 is noted.');
  typeAmount(box, fireEvent, '60.00');
  fireEvent.click(box.getByRole('button', { name: 'Mark paid' }));
  await ui.findByRole('region', { name: 'Paid' });
  assert.deepEqual(posts().map((c) => c.body.owedPence), [76000, 6000]);
  assert.equal(posts()[1].body.amountPence, 6000);
});

test('cw-mark-paid: if more has come than is now expected, the popup starts at nothing owed, never below', async () => {
  // As the server's owedOf: what's owed never goes below £0.00.
  const { ui, within, fireEvent } = await open({ theOrder: order({ paidPence: 80000 }), events: [QUOTE_EV, PART_EV] });
  const box = within(await openMarkPaid(ui, fireEvent, 'Mark the rest paid'));
  assert.equal(box.getByRole('textbox', { name: 'Amount received' }).value, '0.00');
});

test('cw-mark-paid: a part payment refused because someone else saved one keeps the amount typed, still short', async () => {
  let first = true;
  const { ui, within, fireEvent } = await open({
    paid: (body) => {
      if (!first) return answer(body);
      first = false;
      step('part_paid', { amountPence: 10000, receivedOn: TODAY });
      return [409, { error: 'What’s owed has changed since you opened this. Refresh to see what’s owed now.', code: 'owed_changed' }];
    },
  });
  const box = within(await openMarkPaid(ui, fireEvent));
  typeAmount(box, fireEvent, '300.00');
  fireEvent.click(box.getByRole('button', { name: 'Save as part paid' }));
  await box.findByRole('alert');
  await ui.findByRole('region', { name: 'Next: the rest of the payment' });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(box.getByRole('textbox', { name: 'Amount received' }).value, '300.00');
  assert.ok(box.getByText('£360.00 less than expected.'));
  assert.ok(box.queryByRole('button', { name: 'Mark paid' }) === null);
  assert.ok(box.getByRole('button', { name: 'Save as part paid' }));
});

test('cw-mark-paid: if someone else marked it paid meanwhile, the popup offers nothing more to save', async () => {
  const { ui, within, fireEvent } = await open({
    paid: () => {
      step('paid', { amountPence: 76000, receivedOn: TODAY });
      return [409, { error: 'This order has moved on. Refresh to see where it is now.', code: 'wrong_stage' }];
    },
  });
  const box = within(await openMarkPaid(ui, fireEvent));
  fireEvent.click(box.getByRole('button', { name: 'Mark paid' }));
  await box.findByRole('alert');
  await ui.findByRole('region', { name: 'Paid' });
  await new Promise((r) => setTimeout(r, 10));
  for (const name of ['Mark paid', 'Save as part paid', 'Close with a reason…', 'Close it']) assert.ok(box.queryByRole('button', { name }) === null, name);
  assert.ok(box.getByRole('button', { name: 'Cancel' }));
});
