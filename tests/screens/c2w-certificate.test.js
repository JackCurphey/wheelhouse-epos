// Front desk › Cycle to Work › the order: Mark as applied, Add the certificate
// and Mark ready to collect (openspec/changes/cycle-to-work tasks 6.5–6.6, PR 6c;
// c2w.mjs cw-applied, cw-order-applied, cw-certificate, -diff, -match, -more,
// -late, cw-order-get-ready, cw-marked-ready, cw-order-ready). Example data from
// the drawing: North Street Cycles, Bolton, Jo Taylor, Maya Patel. Providers,
// bikes, suppliers and certificate numbers stay bracketed; prices and dates are
// visibly test values.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const JO = { id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const BIKE = { id: 21, name: '[Bike] · [Size]', sku: null, pricePence: 100000, price: 1000, supplier: '[Supplier]' };
const PROVIDER = { id: 3, name: '[Provider]', paysInDays: 30, accessoriesInside: true, handoverNote: '', handoverChecks: [], retiredAt: null };
const SETTINGS = { holdDays: 7, remindDays: 2, quoteValidDays: 30, orderRule: 'applied', depositKind: 'percent', depositValue: null, depositOnCertificate: 'refund', depositOnPullOut: 'refund', howToApply: '[The shop’s own words]', todayLines: false, noCertificateDays: null, paymentLateDays: null };

const TODAY = '2026-09-14';
const day = (n) => { const d = new Date(`${TODAY}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const long = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const order = (over = {}) => ({
  supplier: '[Supplier]',
  id: 9, stage: 'quote', quoteNumber: 1, quoteRef: 'CW-1', customerId: 5, customerName: 'Maya Patel', customerPhone: '07700 900 142', customerEmail: 'maya@example.test',
  providerId: 3, providerName: '[Provider]', productId: 21, bike: '[Bike] · [Size]', siteId: 1, siteName: 'Bolton', frameId: 40, onOrder: false,
  quoteGivenAt: `${day(0)}T10:00:00.000Z`, quoteRevisedAt: null, validUntil: day(30), holdUntil: day(1), holdWanted: true,
  accessories: [{ productId: 22, name: '[Accessory]', pricePence: 4000 }], totalPence: 104000, appliedAt: null, applicationReference: null,
  certificateNumber: null, certificatePence: null, certificateReceivedOn: null, differenceChoice: null, providerPaysPence: 104000, customerPaysPence: null, certificateLate: false,
  saleId: null, collectedAt: null, paidOn: null, closeReason: null, inStock: true, held: true, purchaseOrderId: null, orderedFrom: null, releasedAt: null,
  expectedPence: null, expectedBy: null, paidPence: null, providerReference: null, next: 'certificate', ...over,
});
const AWAY = { holdUntil: null, inStock: false, held: false, frameId: null };
const QUOTE_EV = { kind: 'quote_given', by: 'Jo Taylor', at: `${day(0)}T10:00:00.000Z`, reason: null, detail: { quoteRef: 'CW-1', closing: `This quote is valid until ${long(day(30))}.` } };

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

/** `on` answers a POST to /api/c2w/orders/9<end> with [status, body]; it may change `state.order`, which the page then reloads. */
async function open({ theOrder = order(), events = [QUOTE_EV], on = {} } = {}) {
  calls = [];
  state = { order: theOrder, events };
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: String(url), method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const p = new URL(url, 'http://localhost').pathname;
    if (p === '/api/auth/me') return reply(200, JO);
    if (p === '/api/c2w/count') return reply(200, { count: 1 });
    if (p === '/api/c2w/settings') return reply(200, { settings: SETTINGS });
    if (p === '/api/c2w/providers') return reply(200, { providers: [PROVIDER] });
    if (p === '/api/products/21') return reply(200, BIKE);
    if (method === 'POST' && p.startsWith('/api/c2w/orders/9/')) {
      const end = p.slice('/api/c2w/orders/9'.length);
      if (on[end]) { const [status, b] = on[end](body); return reply(status, b); }
      return reply(404, { error: 'Not found' });
    }
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
const posts = (end) => calls.filter((c) => c.method === 'POST' && c.url.endsWith(`/api/c2w/orders/9${end}`));
const nextBox = async (ui, within, name) => within((await ui.findByRole('heading', { level: 3, name })).closest('section'));
const para = (text) => (_, el) => el?.tagName === 'P' && el.textContent === text;
const type = (fireEvent, el, value) => fireEvent.change(el, { target: { value } });

// ---- The next step's buttons ----

test('cw-order-held: the held bike’s next step has Add the certificate', async () => {
  const { ui, within } = await open();
  const next = await nextBox(ui, within, 'Next: the certificate');
  assert.ok(next.getByRole('button', { name: 'Add the certificate' }));
});

test('cw-applied: a bike not in stock has Mark as applied and Add the certificate', async () => {
  const { ui, within } = await open({ theOrder: order(AWAY) });
  const next = await nextBox(ui, within, 'Next: Maya applies');
  assert.ok(next.getByRole('button', { name: 'Mark as applied' }));
  assert.ok(next.getByRole('button', { name: 'Add the certificate' }));
});

// ---- Mark as applied (cw-applied, cw-order-applied) ----

test('cw-applied: the popup’s title, fields and rule; Save sends them, and the order shows it’s time to order', async () => {
  const on = {
    '/applied': (body) => {
      state.order = order({ ...AWAY, stage: 'waiting', appliedAt: `${body.appliedOn}T12:00:00Z`, applicationReference: body.reference, next: 'order' });
      state.events = [QUOTE_EV, { kind: 'applied', by: 'Jo Taylor', at: `${day(0)}T11:00:00.000Z`, reason: null, detail: { appliedOn: body.appliedOn, employer: body.employer, reference: body.reference } }];
      return [200, { order: state.order }];
    },
  };
  const { ui, within, fireEvent } = await open({ theOrder: order(AWAY), on });
  fireEvent.click(await ui.findByRole('button', { name: 'Mark as applied' }));
  const dialog = within(await ui.findByRole('dialog', { name: 'Maya has applied' }));
  assert.ok(dialog.getByText('Quote CW-1 · [Provider]'));
  assert.equal(dialog.getByLabelText('Applied on').value, TODAY, 'today, from the server');
  assert.ok(dialog.getByText('Optional') && dialog.getByText('Optional — if Maya has one'));
  assert.ok(dialog.getByText('Your rule: order once the customer has applied. The order will show “Order from [Supplier]” next.'));
  type(fireEvent, dialog.getByLabelText('Employer'), '[Employer]');
  type(fireEvent, dialog.getByLabelText('Application reference'), '[reference]');
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  const next = await nextBox(ui, within, 'Next: order the bike');
  assert.deepEqual(posts('/applied').map((c) => c.body), [{ appliedOn: TODAY, employer: '[Employer]', reference: '[reference]' }]);
  assert.ok(ui.queryByRole('dialog') === null, 'the popup closes');
  assert.ok(next.getByText(para('Maya has applied (reference [reference]). Your rule: order once the customer has applied.')));
  assert.ok(next.getByRole('button', { name: 'Add the certificate' }));
  assert.ok(ui.getByText(/marked Maya as applied · employer \[Employer\] · reference \[reference\]/));
});

test('cw-applied: the optional fields left empty aren’t sent; a refusal shows the server’s words and keeps the popup', async () => {
  const on = { '/applied': () => [400, { error: 'Applied on is a date on or after the day the quote was given' }] };
  const { ui, within, fireEvent } = await open({ theOrder: order(AWAY), on });
  fireEvent.click(await ui.findByRole('button', { name: 'Mark as applied' }));
  const dialog = within(await ui.findByRole('dialog', { name: 'Maya has applied' }));
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  assert.equal((await dialog.findByRole('alert')).textContent, 'Applied on is a date on or after the day the quote was given');
  assert.deepEqual(posts('/applied').map((c) => c.body), [{ appliedOn: TODAY }]);
  fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
  assert.ok(ui.queryByRole('dialog') === null);
});

// ---- Add the certificate (cw-certificate, -late) ----

function certificateSaved(body) {
  const ready = body.ready === true;
  state.order = order({ stage: ready ? 'ready' : 'certificate', certificateNumber: body.number, certificatePence: body.amountPence, certificateReceivedOn: body.receivedOn, holdUntil: null, next: ready ? 'handover' : 'ready' });
  state.events = [QUOTE_EV, { kind: 'certificate', by: 'Jo Taylor', at: `${day(0)}T12:00:00.000Z`, reason: null, detail: { number: body.number, certificatePence: body.amountPence, quotePence: 104000, ...(ready ? { ready: true } : {}) } }];
  return [200, { order: state.order }];
}

async function openCertificate(opts = {}) {
  const r = await open({ on: { '/certificate': certificateSaved }, ...opts });
  r.fireEvent.click(await r.ui.findByRole('button', { name: 'Add the certificate' }));
  const dialog = r.within(await r.ui.findByRole('dialog', { name: 'Add the certificate' }));
  return { ...r, dialog };
}

test('cw-certificate: the fields, They match, the tick ticked, and Save sends it all; the order is Ready to collect', async () => {
  const { ui, within, fireEvent, dialog } = await openCertificate();
  assert.ok(dialog.getByText('Maya Patel · [Provider]'));
  assert.equal(dialog.getByLabelText('Received').value, TODAY);
  type(fireEvent, dialog.getByLabelText('Certificate number'), '[certificate number]');
  type(fireEvent, dialog.getByLabelText('Amount on the certificate'), '1040.00');
  assert.ok(dialog.getByText(para('Certificate £1,040.00 · quote £1,040.00. They match.')));
  const tick = dialog.getByRole('checkbox', { name: /The bike is ready — tell Maya they can collect it/ });
  assert.equal(tick.checked, true);
  assert.ok(dialog.getByText('Leave it ticked if the bike can go now. Untick it if it needs work first: Maya is sent “Certificate received” now, and “Ready to collect” when you mark it ready.'));
  assert.ok(dialog.getByText('[Bike] · [Size] stays put aside until Maya collects it. With the tick, the order moves to Ready to collect and Maya is sent one message, “Ready to collect”, which says the certificate arrived.'));
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  const next = await nextBox(ui, within, 'Next: hand over');
  assert.deepEqual(posts('/certificate').map((c) => c.body), [{ number: '[certificate number]', amountPence: 104000, receivedOn: TODAY, ready: true }]);
  assert.ok(next.getByText(para('Ready to collect. Certificate [certificate number] · [Bike] · [Size] put aside.')));
  assert.ok(next.queryByRole('button', { name: 'Hand over' }) === null, 'Hand over comes with pull request 7');
  assert.ok(ui.getByText(/added certificate \[certificate number\] · certificate £1,040.00 · quote £1,040.00 · and marked the bike ready to collect/));
});

test('cw-certificate: unticked, it saves as Certificate received, and the order asks to get the bike ready', async () => {
  const { ui, within, fireEvent, dialog } = await openCertificate();
  type(fireEvent, dialog.getByLabelText('Certificate number'), '[certificate number]');
  type(fireEvent, dialog.getByLabelText('Amount on the certificate'), '£1,040');
  fireEvent.click(dialog.getByRole('checkbox', { name: /The bike is ready/ }));
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  await nextBox(ui, within, 'Next: get the bike ready');
  assert.equal(posts('/certificate')[0].body.ready, false);
});

test('cw-certificate: nothing is sent without a number and an amount', async () => {
  const { fireEvent, dialog } = await openCertificate();
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  assert.equal((await dialog.findByRole('alert')).textContent, 'Give the certificate number');
  type(fireEvent, dialog.getByLabelText('Certificate number'), '[certificate number]');
  type(fireEvent, dialog.getByLabelText('Amount on the certificate'), 'lots');
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  assert.equal((await dialog.findByRole('alert')).textContent, 'Pounds and pence, like 5.00');
  assert.equal(posts('/certificate').length, 0);
});

test('cw-certificate-late: a quote that ran out says so, with the tick and the shorter note', async () => {
  const { fireEvent, dialog } = await openCertificate({ theOrder: order({ validUntil: day(-1) }) });
  type(fireEvent, dialog.getByLabelText('Amount on the certificate'), '1040');
  assert.ok(dialog.getByText(para(`Quote ran out on ${long(day(-1))} — check the price. Certificate £1,040.00 · quote £1,040.00. The amounts match.`)));
  assert.ok(dialog.getByRole('checkbox', { name: /The bike is ready/ }));
  assert.ok(dialog.getByText('[Bike] · [Size] stays put aside until Maya collects it.'));
});

// ---- A certificate for less or more (cw-certificate-diff, -match, -more) ----

test('cw-certificate-diff: less than the quote: the warning, What to do with Change to match chosen, and no tick', async () => {
  const { within, fireEvent, dialog } = await openCertificate();
  type(fireEvent, dialog.getByLabelText('Amount on the certificate'), '1000');
  assert.ok(dialog.getByText(para('Certificate £1,000.00 · quote £1,040.00. £40.00 less than the quote.')));
  const [match, keep] = within(dialog.getByRole('group', { name: 'What to do' })).getAllByRole('radio');
  assert.equal(match.checked, true);
  assert.equal(keep.checked, false);
  assert.ok(dialog.getByText('Take something off so the total is the certificate amount. Maya is emailed “Certificate received” with the revised quote.'));
  assert.ok(dialog.getByText('Keep the order; Maya pays the £40.00 difference'));
  assert.ok(dialog.getByText('At collection, as a second payment at the till. Maya is told “You pay £40.00 when you collect”.'));
  assert.ok(dialog.getByText('What’s expected from [Provider] follows the order either way.'));
  assert.ok(dialog.queryByRole('checkbox', { name: /The bike is ready/ }) === null);
  assert.ok(dialog.getByRole('button', { name: 'Next: what to take off' }));
});

test('cw-certificate-diff: Keep the order saves the difference for Maya to pay', async () => {
  const { ui, within, fireEvent, dialog } = await openCertificate();
  type(fireEvent, dialog.getByLabelText('Certificate number'), '[certificate number]');
  type(fireEvent, dialog.getByLabelText('Amount on the certificate'), '1000');
  fireEvent.click(dialog.getByRole('radio', { name: /Keep the order; Maya pays/ }));
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  await nextBox(ui, within, 'Next: get the bike ready');
  assert.deepEqual(posts('/certificate').map((c) => c.body), [{ number: '[certificate number]', amountPence: 100000, receivedOn: TODAY, ready: false, difference: 'keep' }]);
});

test('cw-certificate-match: tick what comes off, the new total against the certificate, Back keeps what was typed, and Save and email Maya', async () => {
  const { ui, within, fireEvent, dialog } = await openCertificate();
  type(fireEvent, dialog.getByLabelText('Certificate number'), '[certificate number]');
  type(fireEvent, dialog.getByLabelText('Amount on the certificate'), '1000');
  fireEvent.click(dialog.getByRole('button', { name: 'Next: what to take off' }));
  let lines = within(await ui.findByRole('dialog', { name: 'Change the order to match' }));
  assert.ok(lines.getByText('Maya Patel · certificate £1,000.00 · quote £1,040.00'));
  assert.ok(lines.getByRole('group', { name: 'Tick what to take off' }));
  assert.ok(lines.getByText('[Bike] · [Size]') && lines.getByText('£1,000.00', { selector: '[data-line="bike"] *' }));
  assert.ok(lines.getByText('To change the bike or size, use More on the order.'));
  const total = () => lines.getByText('New total (includes VAT)').nextElementSibling.textContent;
  assert.equal(total(), '£1,040.00');
  assert.equal(lines.getByText('Certificate').nextElementSibling.textContent, '£1,000.00');
  assert.ok(lines.queryByText(/They match/) === null);
  fireEvent.click(lines.getByRole('button', { name: 'Back' }));
  const again = within(await ui.findByRole('dialog', { name: 'Add the certificate' }));
  assert.equal(again.getByLabelText('Amount on the certificate').value, '1000', 'Back keeps what was typed');
  fireEvent.click(again.getByRole('button', { name: 'Next: what to take off' }));
  lines = within(await ui.findByRole('dialog', { name: 'Change the order to match' }));
  fireEvent.click(lines.getByRole('checkbox', { name: /\[Accessory\]/ }));
  assert.equal(total(), '£1,000.00');
  assert.ok(lines.getByText(para('They match. The revised quote goes to Maya with the “Certificate received” email.')));
  fireEvent.click(lines.getByRole('button', { name: 'Save and email Maya' }));
  await nextBox(ui, within, 'Next: get the bike ready');
  assert.deepEqual(posts('/certificate').map((c) => c.body), [{ number: '[certificate number]', amountPence: 100000, receivedOn: TODAY, ready: false, difference: 'match', accessoryIds: [] }]);
});

test('cw-certificate-more: more than the quote: Keep the order as quoted is chosen, and Save keeps it', async () => {
  const { ui, within, fireEvent, dialog } = await openCertificate();
  type(fireEvent, dialog.getByLabelText('Certificate number'), '[certificate number]');
  type(fireEvent, dialog.getByLabelText('Amount on the certificate'), '1100');
  assert.ok(dialog.getByText(para('Certificate £1,100.00 · quote £1,040.00. £60.00 more than the quote.')));
  const keep = dialog.getByRole('radio', { name: /Keep the order as quoted/ });
  assert.equal(keep.checked, true);
  assert.ok(dialog.getByText('Maya pays nothing at collection. [Provider] is expected to pay the order’s total, £1,040.00.'));
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  await nextBox(ui, within, 'Next: get the bike ready');
  assert.deepEqual(posts('/certificate')[0].body, { number: '[certificate number]', amountPence: 110000, receivedOn: TODAY, ready: false, difference: 'keep' });
});

// ---- Get it ready, and Mark ready to collect (cw-order-get-ready, cw-marked-ready) ----

test('cw-order-get-ready and cw-marked-ready: Mark ready to collect, the note with Undo, and Undo puts it back', async () => {
  const got = order({ stage: 'certificate', certificateNumber: '[certificate number]', certificatePence: 104000, certificateReceivedOn: day(0), holdUntil: null, next: 'ready' });
  const on = {
    '/ready': () => { state.order = { ...got, stage: 'ready', next: 'handover' }; state.events = [QUOTE_EV, { kind: 'ready', by: 'Jo Taylor', at: `${day(0)}T13:00:00.000Z`, reason: null, detail: {} }]; return [200, { order: state.order }]; },
    '/ready/undo': () => { state.order = got; return [200, { order: got }]; },
  };
  const { ui, within, fireEvent } = await open({ theOrder: got, on });
  const next = await nextBox(ui, within, 'Next: get the bike ready');
  assert.ok(next.getByText(para('Certificate received. [Bike] · [Size] is put aside for Maya. Maya has been sent “Certificate received”.')));
  assert.ok(next.getByText('One press, with Undo. Maya is sent “Ready to collect”.'));
  const stages = within(ui.getByRole('list', { name: 'Stages' })).getAllByRole('listitem');
  assert.equal(stages[2].getAttribute('aria-current'), 'step');
  fireEvent.click(next.getByRole('button', { name: 'Mark Maya Patel’s bike ready to collect' }));
  assert.ok(await ui.findByText('Marked ready to collect. Maya is sent “Ready to collect”.'));
  await nextBox(ui, within, 'Next: hand over');
  assert.ok(ui.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === 'Jo Taylor marked the bike ready to collect'));
  assert.equal(posts('/ready').length, 1);
  fireEvent.click(ui.getByRole('button', { name: 'Undo' }));
  await nextBox(ui, within, 'Next: get the bike ready');
  assert.equal(posts('/ready/undo').length, 1);
});

// ---- From the review: the cases the drawings leave between them ----

test('cw-certificate-late: late is judged on the Received date, as the server does', async () => {
  const { fireEvent, dialog } = await openCertificate({ theOrder: order({ validUntil: day(-1) }) });
  type(fireEvent, dialog.getByLabelText('Amount on the certificate'), '1040');
  type(fireEvent, dialog.getByLabelText('Received'), day(-2));
  assert.ok(dialog.queryByText(/Quote ran out/) === null);
  assert.ok(dialog.getByText(para('Certificate £1,040.00 · quote £1,040.00. They match.')));
});

test('cw-certificate-late with a different amount: the late warning and the difference both show', async () => {
  const { fireEvent, dialog } = await openCertificate({ theOrder: order({ validUntil: day(-1) }) });
  type(fireEvent, dialog.getByLabelText('Amount on the certificate'), '1000');
  assert.ok(dialog.getByText(para(`Quote ran out on ${long(day(-1))} — check the price.`)));
  assert.ok(dialog.getByText(para('Certificate £1,000.00 · quote £1,040.00. £40.00 less than the quote.')));
  assert.ok(dialog.queryByRole('checkbox', { name: /The bike is ready/ }) === null);
});

test('cw-certificate: with no bike put aside there is no ready tick, and ready is not sent as true', async () => {
  const { waitFor, fireEvent, dialog } = await openCertificate({ theOrder: order({ held: false, holdUntil: null }) });
  type(fireEvent, dialog.getByLabelText('Certificate number'), '[certificate number]');
  type(fireEvent, dialog.getByLabelText('Amount on the certificate'), '1040');
  assert.ok(dialog.queryByRole('checkbox', { name: /The bike is ready/ }) === null);
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.equal(posts('/certificate').length, 1));
  assert.equal(posts('/certificate')[0].body.ready, false);
});

test('cw-certificate-match: Save and email stays off until the new total is the certificate', async () => {
  const { ui, within, fireEvent, dialog } = await openCertificate();
  type(fireEvent, dialog.getByLabelText('Certificate number'), '[certificate number]');
  type(fireEvent, dialog.getByLabelText('Amount on the certificate'), '1000');
  fireEvent.click(dialog.getByRole('button', { name: 'Next: what to take off' }));
  const lines = within(await ui.findByRole('dialog', { name: 'Change the order to match' }));
  const save = lines.getByRole('button', { name: 'Save and email Maya' });
  assert.equal(save.disabled, true);
  fireEvent.click(save);
  assert.equal(posts('/certificate').length, 0);
  fireEvent.click(lines.getByRole('checkbox', { name: /\[Accessory\]/ }));
  assert.equal(lines.getByRole('button', { name: 'Save and email Maya' }).disabled, false);
});

test('cw-certificate-more with Change the order to match: the order’s accessories are kept', async () => {
  const { waitFor, fireEvent, dialog } = await openCertificate();
  type(fireEvent, dialog.getByLabelText('Certificate number'), '[certificate number]');
  type(fireEvent, dialog.getByLabelText('Amount on the certificate'), '1100');
  fireEvent.click(dialog.getByRole('radio', { name: /Change the order to match/ }));
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.equal(posts('/certificate').length, 1));
  assert.deepEqual(posts('/certificate')[0].body, { number: '[certificate number]', amountPence: 110000, receivedOn: TODAY, ready: false, difference: 'match', accessoryIds: [22] });
});

test('cw-applied: a bike already on order has no rule line in the popup', async () => {
  const { ui, within, fireEvent } = await open({ theOrder: order({ ...AWAY, onOrder: true }) });
  fireEvent.click(await ui.findByRole('button', { name: 'Mark as applied' }));
  const dialog = within(await ui.findByRole('dialog', { name: 'Maya has applied' }));
  assert.ok(dialog.queryByText(/Your rule/) === null);
});

test('cw-marked-ready: a refusal shows the server’s words and leaves the order as it was', async () => {
  const got = order({ stage: 'certificate', certificateNumber: '[certificate number]', certificatePence: 104000, certificateReceivedOn: day(0), holdUntil: null, next: 'ready' });
  const on = { '/ready': () => [409, { error: 'No bike is put aside for this order.', code: 'not_held' }] };
  const { ui, within, fireEvent } = await open({ theOrder: got, on });
  const next = await nextBox(ui, within, 'Next: get the bike ready');
  fireEvent.click(next.getByRole('button', { name: 'Mark Maya Patel’s bike ready to collect' }));
  assert.ok(await ui.findByText('No bike is put aside for this order.'));
  assert.ok(ui.queryByRole('button', { name: 'Undo' }) === null);
  await nextBox(ui, within, 'Next: get the bike ready');
});

// ---- The bike was released (cw-certificate-released) ----

const RELEASED = { ...AWAY, releasedAt: `${day(-3)}T10:00:00.000Z`, releasedSold: true, next: 'order' };
/** The certificate saves; the order still has no bike, as the server leaves a released order with no frame free. */
const releasedSaved = (over = {}) => (body) => {
  state.order = order({ ...RELEASED, stage: 'certificate', certificateNumber: body.number, certificatePence: body.amountPence, certificateReceivedOn: body.receivedOn, ...over });
  return [200, { order: state.order }];
};
async function saveReleased({ over = {}, on = {} } = {}) {
  const r = await openCertificate({ theOrder: order({ ...RELEASED, ...over }), on: { '/certificate': releasedSaved(over), ...on } });
  type(r.fireEvent, r.dialog.getByLabelText('Certificate number'), '[certificate number]');
  type(r.fireEvent, r.dialog.getByLabelText('Amount on the certificate'), '1040');
  r.fireEvent.click(r.dialog.getByRole('button', { name: 'Save' }));
  const popup = r.within(await r.ui.findByRole('dialog', { name: 'The bike was released' }));
  return { ...r, popup };
}

test('cw-certificate-released: a released bike since sold; Order one from the supplier is chosen and Save orders it', async () => {
  const on = { '/order': () => { state.order = order({ ...RELEASED, stage: 'certificate', onOrder: true, next: null }); return [200, { order: state.order, supplier: '[Supplier]' }]; } };
  const { ui, waitFor, fireEvent, popup } = await saveReleased({ on });
  assert.equal(posts('/certificate').length, 1);
  assert.ok(popup.getByText('Maya Patel · certificate [certificate number] saved'));
  assert.ok(popup.getByText(para(`[Bike] · [Size] was released on ${long(day(-3))} and has since been sold.`)));
  assert.ok(popup.getByText('What to do for Maya'));
  assert.equal(popup.getByRole('radio', { name: /Order one from \[Supplier\]/ }).checked, true);
  assert.ok(popup.queryByRole('radio', { name: /Hold another/ }) === null, 'Hold another waits for Jack (question 8)');
  fireEvent.click(popup.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.equal(posts('/order').length, 1));
  assert.deepEqual(posts('/order')[0].body, {});
  await waitFor(() => assert.ok(ui.queryByRole('dialog') === null));
});

test('cw-certificate-released: not sold yet says only when it was released; Decide later orders nothing', async () => {
  const { ui, waitFor, fireEvent, popup } = await saveReleased({ over: { releasedSold: false } });
  assert.ok(popup.getByText(para(`[Bike] · [Size] was released on ${long(day(-3))}.`)));
  fireEvent.click(popup.getByRole('button', { name: 'Decide later' }));
  await waitFor(() => assert.ok(ui.queryByRole('dialog') === null));
  assert.equal(posts('/order').length, 0);
});

test('cw-certificate-released: a refusal to order shows the server’s words and keeps the popup open', async () => {
  const on = { '/order': () => [409, { error: '[The server’s reason]', code: 'no_supplier' }] };
  const { fireEvent, popup } = await saveReleased({ on });
  fireEvent.click(popup.getByRole('button', { name: 'Save' }));
  assert.ok(await popup.findByText('[The server’s reason]'));
  assert.ok(popup.getByRole('button', { name: 'Decide later' }));
});

test('cw-certificate: a released order already on order closes on Save with no popup', async () => {
  const over = { onOrder: true, next: null };
  const { ui, waitFor, fireEvent, dialog } = await openCertificate({ theOrder: order({ ...RELEASED, ...over }), on: { '/certificate': releasedSaved(over) } });
  type(fireEvent, dialog.getByLabelText('Certificate number'), '[certificate number]');
  type(fireEvent, dialog.getByLabelText('Amount on the certificate'), '1040');
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.ok(ui.queryByRole('dialog') === null));
  assert.equal(posts('/certificate').length, 1);
});

test('cw-certificate: a released order the shop’s rule doesn’t order yet closes on Save with no popup', async () => {
  const over = { next: 'ready' };
  const { ui, waitFor, fireEvent, dialog } = await openCertificate({ theOrder: order({ ...RELEASED, ...over }), on: { '/certificate': releasedSaved(over) } });
  type(fireEvent, dialog.getByLabelText('Certificate number'), '[certificate number]');
  type(fireEvent, dialog.getByLabelText('Amount on the certificate'), '1040');
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.ok(ui.queryByRole('dialog') === null));
  assert.equal(posts('/certificate').length, 1);
});

test('cw-certificate-released: with no supplier matched in Settings the choice is Order the bike', async () => {
  const { popup } = await saveReleased({ over: { supplier: null } });
  assert.equal(popup.getByRole('radio', { name: 'Order the bike' }).checked, true);
  assert.ok(popup.queryByText(/\[supplier\]/) === null);
});

test('cw-certificate: a released order that holds a bike again closes on Save with no popup', async () => {
  const over = { held: true, frameId: 41, inStock: true, next: 'ready' };
  const { ui, waitFor, fireEvent, dialog } = await openCertificate({ theOrder: order({ ...RELEASED, ...over }), on: { '/certificate': releasedSaved(over) } });
  type(fireEvent, dialog.getByLabelText('Certificate number'), '[certificate number]');
  type(fireEvent, dialog.getByLabelText('Amount on the certificate'), '1040');
  fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.ok(ui.queryByRole('dialog') === null));
  assert.equal(posts('/certificate').length, 1);
});
