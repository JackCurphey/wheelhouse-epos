// Front desk › Cycle to Work › ordering the bike from the order and the list
// (openspec/changes/cycle-to-work tasks 6.3–6.4, PR 6c's second part; c2w.mjs
// cw-order-applied, cw-ordered, cw-order-on-order, and the history's "ordered"
// line). Example data from the drawing: North Street Cycles, Jo Taylor, Maya
// Patel. Bikes, suppliers and order numbers stay bracketed or are visibly test values.
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
  id: 9, stage: 'quote', quoteNumber: 1, quoteRef: 'CW-1', customerId: 5, customerName: 'Maya Patel', customerPhone: '07700 900 142', customerEmail: 'maya@example.test',
  providerId: 3, providerName: '[Provider]', productId: 21, bike: '[Bike] · [Size]', siteId: 1, siteName: 'Bolton', frameId: 40, onOrder: false,
  quoteGivenAt: `${day(0)}T10:00:00.000Z`, quoteRevisedAt: null, validUntil: day(30), holdUntil: day(1), holdWanted: true,
  accessories: [{ productId: 22, name: '[Accessory]', pricePence: 4000 }], totalPence: 104000, appliedAt: null, applicationReference: null,
  certificateNumber: null, certificatePence: null, certificateReceivedOn: null, differenceChoice: null, providerPaysPence: 104000, customerPaysPence: null, certificateLate: false,
  saleId: null, collectedAt: null, paidOn: null, closeReason: null, inStock: true, held: true, purchaseOrderId: null, orderedFrom: null, supplier: '[Supplier]', releasedAt: null,
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
async function open({ theOrder = order(), events = [QUOTE_EV], on = {}, settings = SETTINGS } = {}) {
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
    if (p === '/api/c2w/settings') return reply(200, { settings });
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


const APPLIED = order({ ...AWAY, stage: 'waiting', appliedAt: `${day(0)}T11:00:00.000Z`, applicationReference: '[reference]', next: 'order' });
const ORDERED_EV = { kind: 'ordered', by: 'Jo Taylor', at: `${day(0)}T12:00:00.000Z`, reason: null, detail: { purchaseOrderId: '77', supplier: '[Supplier]' } };
const onOrder = (over = {}) => ({ onOrder: true, purchaseOrderId: 77, orderedFrom: '[Supplier]', ...over });

test('cw-order-applied: applied under the applied rule, Order from the supplier and Add the certificate, and the note', async () => {
  const { ui, within } = await open({ theOrder: APPLIED });
  const next = await nextBox(ui, within, 'Next: order the bike');
  assert.ok(next.getByText(para('Maya has applied (reference [reference]). Your rule: order once the customer has applied.')));
  const buttons = next.getAllByRole('button').map((b) => b.textContent);
  assert.deepEqual(buttons, ['Order from [Supplier]', 'Add the certificate']);
  assert.ok(next.getByText('Ordering creates the supplier order in Deliveries and orders.'));
});

test('cw-ordered: Order from the supplier sends it, says so with Undo, and Undo takes it back', async () => {
  const on = {
    '/order': () => { state.order = { ...APPLIED, ...onOrder(), next: 'certificate' }; state.events = [QUOTE_EV, ORDERED_EV]; return [200, { order: state.order, purchaseOrderId: 77, supplier: '[Supplier]' }]; },
    '/order/undo': () => { state.order = APPLIED; state.events = [QUOTE_EV, ORDERED_EV, { ...ORDERED_EV, kind: 'order_undone', detail: {} }]; return [200, { order: APPLIED }]; },
  };
  const { ui, within, fireEvent } = await open({ theOrder: APPLIED, on });
  const next = await nextBox(ui, within, 'Next: order the bike');
  fireEvent.click(next.getByRole('button', { name: 'Order from [Supplier]' }));
  assert.ok(await ui.findByText('Ordered Maya Patel’s bike from [Supplier].'));
  assert.equal(posts('/order').length, 1);
  assert.deepEqual(posts('/order')[0].body, {});
  // Ordered before the certificate, as the applied rule allows: the certificate is next.
  const after = await nextBox(ui, within, 'Next: the certificate');
  assert.ok(after.getByText(para('The bike is ordered from [Supplier].')));
  assert.ok(after.getByRole('button', { name: 'Add the certificate' }));
  assert.ok(ui.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === 'Jo Taylor ordered the bike from [Supplier] · supplier order 77'));
  fireEvent.click(ui.getByRole('button', { name: 'Undo' }));
  assert.ok(await ui.findByText('Undone'));
  await nextBox(ui, within, 'Next: order the bike');
  assert.equal(posts('/order/undo').length, 1);
  assert.ok(ui.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === 'Jo Taylor undid the order from the supplier'));
});

test('cw-ordered: a refusal shows the server’s words and leaves the order as it was', async () => {
  const words = 'This bike’s supplier isn’t in Settings › Suppliers yet. Add it there, then order.';
  const { ui, within, fireEvent } = await open({ theOrder: { ...APPLIED, supplier: null }, on: { '/order': () => [409, { error: words, code: 'no_supplier' }] } });
  const next = await nextBox(ui, within, 'Next: order the bike');
  fireEvent.click(next.getByRole('button', { name: 'Order the bike' }));
  assert.ok(await ui.findByText(words));
  await nextBox(ui, within, 'Next: order the bike');
  assert.ok(ui.queryByText(/^Ordered /) === null);
});

test('cw-order-on-order: the certificate in and the bike on order, with the supplier order’s link and no made-up date', async () => {
  const got = order({ ...AWAY, ...onOrder(), stage: 'certificate', certificateNumber: '[certificate number]', certificatePence: 104000, certificateReceivedOn: day(0), next: 'ready' });
  const { ui, within } = await open({ theOrder: got, events: [QUOTE_EV, ORDERED_EV] });
  const next = await nextBox(ui, within, 'Next: the bike arrives');
  assert.ok(next.getByText(para('Certificate received. The bike is on order from [Supplier].')));
  assert.ok(next.getByText('When it’s booked in through Deliveries and orders, it’s put aside for Maya and this order moves to Ready to collect. Maya is emailed “Ready to collect” then.'));
  const link = next.getByRole('link', { name: 'Open the supplier order for Maya’s bike' });
  assert.equal(link.getAttribute('href'), '/workshop/deliveries/orders/77');
  assert.equal(link.textContent, 'Open the supplier order');
  assert.ok(next.queryByRole('button') === null);
});

test('the certificate rule: the certificate in and the bike not in stock, Order from the supplier comes first', async () => {
  const got = order({ ...AWAY, stage: 'certificate', certificateNumber: '[certificate number]', certificatePence: 104000, certificateReceivedOn: day(0), next: 'order' });
  const on = { '/order': () => { state.order = { ...got, ...onOrder(), next: 'ready' }; return [200, { order: state.order, purchaseOrderId: 77, supplier: '[Supplier]' }]; } };
  const { ui, within, fireEvent } = await open({ theOrder: got, on, settings: { ...SETTINGS, orderRule: 'certificate' } });
  const next = await nextBox(ui, within, 'Next: order the bike');
  assert.ok(next.getByText(para('Certificate received. Your rule: order once the certificate arrives.')));
  fireEvent.click(next.getByRole('button', { name: 'Order from [Supplier]' }));
  await nextBox(ui, within, 'Next: the bike arrives');
  assert.equal(posts('/order').length, 1);
});

// The applied rule with the certificate in before anyone ordered: the box names the shop's own rule.
test('the applied rule: the certificate in before ordering names the applied rule', async () => {
  const got = order({ ...AWAY, stage: 'certificate', certificateNumber: '[certificate number]', certificatePence: 104000, certificateReceivedOn: day(0), next: 'order' });
  const { ui, within } = await open({ theOrder: got });
  const next = await nextBox(ui, within, 'Next: order the bike');
  assert.ok(next.getByText(para('Certificate received. Your rule: order once the customer has applied.')));
  assert.ok(next.getByRole('button', { name: 'Order from [Supplier]' }));
});
