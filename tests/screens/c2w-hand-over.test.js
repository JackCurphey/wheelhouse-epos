// Front desk › Cycle to Work › Hand over, and the order at the till
// (openspec/changes/cycle-to-work task 7, PR 7b; c2w.mjs cw-order-ready and
// the handOver popup; till.mjs till-c2w, till-c2w-pay, till-c2w-extra,
// till-c2w-paid-cert, till-c2w-paid). Example data from the drawings: North
// Street Cycles, Bolton, Jo Taylor, Maya Patel. Providers, bikes, frame and
// certificate numbers stay bracketed; prices are visibly test values.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const JO = { id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false, shopName: 'North Street Cycles', shopSlug: 'north-street', employee: { id: 21, name: 'Jo Taylor', isCashier: true } };
const CHECK_1 = '[Line 1 of the shop’s note for this provider]';
const CHECK_2 = '[Line 2 of the shop’s note for this provider]';
const PROVIDER = { id: 3, name: '[Provider]', paysInDays: 30, accessoriesInside: true, handoverNote: `${CHECK_1}\n${CHECK_2}`, handoverChecks: [CHECK_1, CHECK_2], retiredAt: null };
const SETTINGS = { holdDays: 7, remindDays: 2, quoteValidDays: 30, orderRule: 'applied', depositKind: 'percent', depositValue: null, depositOnCertificate: 'refund', depositOnPullOut: 'refund', howToApply: '[The shop’s own words]', todayLines: false, noCertificateDays: null, paymentLateDays: null };
const PADS = { id: 40, sku: 'B05S-RX', barcode: '4524667', name: 'Shimano brake pads', price: 28, stockQty: 1, active: true };
const TODAY = '2026-09-14';
const order = (over = {}) => ({
  supplier: '[Supplier]',
  id: 9, stage: 'ready', quoteNumber: 1, quoteRef: 'CW-1', customerId: 5, customerName: 'Maya Patel', customerPhone: '07700 900 142', customerEmail: 'maya@example.test',
  providerId: 3, providerName: '[Provider]', productId: 21, bike: '[Bike] · [Size]', siteId: 1, siteName: 'Bolton', frameId: 40, frameNumber: '[frame number]', onOrder: false,
  quoteGivenAt: '2026-09-14T10:00:00.000Z', quoteRevisedAt: null, validUntil: '2026-10-14', holdUntil: '2026-09-21', holdWanted: true,
  accessories: [{ productId: 22, name: '[Accessory]', pricePence: 4000 }, { productId: 23, name: '[Accessory]', pricePence: 2000 }], totalPence: 106000,
  appliedAt: null, applicationReference: null, certificateNumber: '[certificate number]', certificatePence: 106000, certificateReceivedOn: TODAY, differenceChoice: null,
  providerPaysPence: 106000, customerPaysPence: null, certificateLate: false, saleId: null, collectedAt: null, paidOn: null, closeReason: null,
  inStock: true, held: true, purchaseOrderId: null, orderedFrom: null, releasedAt: null, expectedPence: null, expectedBy: null, paidPence: null, providerReference: null, next: 'hand-over', ...over,
});
// What the server answers a hand-over: the sale with both payments (serializeSale).
const sale = (body) => {
  const counter = (body.items ?? []).reduce((n, it) => n + (it.unitPrice ?? 0) * (it.qty ?? 1), 0);
  const share = Math.min(state.order.providerPaysPence / 100, state.order.totalPence / 100 + counter);
  const extra = [{ tenderType: 'Cycle to Work · [Provider]', amount: share }];
  return { id: 601, createdAt: '2026-09-14T11:00:00.000Z', subtotal: state.order.totalPence / 100 + counter, discount: 0, groupDiscountAmount: 0, groupDiscountName: '',
    total: state.order.totalPence / 100 + counter, paymentMethod: body.cardAmount > 0 ? 'Card' : 'Other', cashAmount: body.cashAmount, cardAmount: body.cardAmount, cashTendered: body.cashTendered, extraPayments: extra,
    items: [{ id: 1, name: '[Bike] · [Size]', qty: 1, unitPrice: 1000, lineTotal: 1000 }] };
};

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

/** `onSale` answers POST /api/sales with [status, body]. */
async function open(path, { theOrder = order(), onSale, tick = 100000 } = {}) {
  calls = [];
  state = { order: theOrder };
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: String(url), method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    const p = u.pathname;
    if (p === '/api/auth/me') return reply(200, JO);
    if (p === '/api/till-checkin') return reply(200, { serving: { id: 21, name: 'Jo Taylor' }, checkedInToday: [] });
    if (p === '/api/c2w/count') return reply(200, { count: 1 });
    if (p === '/api/c2w/settings') return reply(200, { settings: SETTINGS });
    if (p === '/api/c2w/providers') return reply(200, { providers: [PROVIDER] });
    if (p === '/api/products') return reply(200, [PADS]);
    if (p === '/api/workshop-services') return reply(200, []);
    if (p === '/api/shop-details') return reply(200, { name: 'North Street Cycles', address: '[Shop address]', phone: '[shop phone]', email: null, vatNumber: '[VAT number]' });
    if (method === 'POST' && p === '/api/sales') {
      if (onSale) { const [status, b] = onSale(body); return reply(status, b); }
      state.order = { ...state.order, stage: 'collected', saleId: 601 };
      return reply(201, sale(body));
    }
    if (p === '/api/c2w/orders/9') return reply(200, { order: { ...state.order, events: [] }, today: TODAY });
    if (p.startsWith('/api/')) return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom(`http://localhost${path}`);
  window.WH_TILL_TICK_MS = tick;
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  rendered = true;
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui };
}
const sales = () => calls.filter((c) => c.method === 'POST' && c.url === '/api/sales').map(({ body: { requestKey, ...rest } }) => rest);
const openTill = async (opts) => {
  const t = await open('/workshop/till?c2w=9', opts);
  const sale = t.within(await t.ui.findByRole('region', { name: 'Sale' }));
  await sale.findByText('[Bike] · [Size]');
  return { ...t, sale };
};
const payDialog = async (t) => {
  const take = t.sale.getByRole('button', { name: /^Take payment/ });
  await t.waitFor(() => assert.equal(take.disabled, false));
  t.fireEvent.click(take);
  return t.within(await t.ui.findByRole('dialog'));
};
async function scanPads({ ui, fireEvent, waitFor, sale }) {
  const box = await ui.findByLabelText('Search products or services, or scan a barcode');
  fireEvent.change(box, { target: { value: '4524667' } });
  await ui.findByRole('button', { name: /^Shimano brake pads/ });
  fireEvent.keyDown(box, { key: 'Enter' });
  await waitFor(() => assert.ok(sale.queryByText('Part · B05S-RX · added at the counter') !== null));
}

// ---- The order page: Hand over (cw-order-ready, the handOver popup) ----

test('cw-order-ready: the ready step has Hand over, which opens the popup as drawn', async () => {
  const { ui, within, fireEvent } = await open('/workshop/c2w/9');
  const next = within((await ui.findByRole('heading', { level: 3, name: 'Next: hand over' })).closest('section'));
  fireEvent.click(next.getByRole('button', { name: 'Hand over' }));
  const dialog = within(await ui.findByRole('dialog', { name: 'Hand over to Maya Patel' }));
  assert.ok(dialog.getByText('[Bike] · [Size] · certificate [certificate number]'));
  const checks = within(dialog.getByRole('group', { name: '[Provider]’s checks, from your note in Settings' }));
  assert.equal(checks.getAllByRole('checkbox').length, 2);
  assert.ok(checks.getByRole('checkbox', { name: CHECK_1 }) && checks.getByRole('checkbox', { name: CHECK_2 }));
  assert.ok(dialog.getByText('Order total') && dialog.getByText('[Provider] pays (the certificate)') && dialog.getByText('Maya pays at collection'));
  assert.equal(dialog.getAllByText('£1,060.00').length, 2, 'the order total and the provider’s share');
  assert.ok(dialog.getByText('£0.00'));
  assert.ok(dialog.getByText('“Hand over at the till” opens the till with Maya’s order in the basket: the bike, with its held frame number, and the order’s accessories, marked “on the order”. “Cycle to Work · [Provider]” is the first way to pay. Anything Maya adds at the counter goes on the same sale, for Maya to pay. The ticked checks go in the order’s history.'));
  fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
  assert.ok(ui.queryByRole('dialog') === null);
});

test('the handOver popup: a provider with no checks shows no checks group', async () => {
  PROVIDER.handoverChecks = [];
  try {
    const { ui, within, fireEvent } = await open('/workshop/c2w/9');
    fireEvent.click(await ui.findByRole('button', { name: 'Hand over' }));
    const dialog = within(await ui.findByRole('dialog', { name: 'Hand over to Maya Patel' }));
    assert.ok(dialog.queryByRole('group') === null);
    assert.ok(dialog.queryByRole('checkbox') === null);
  } finally {
    PROVIDER.handoverChecks = [CHECK_1, CHECK_2];
  }
});

test('Hand over at the till opens the till with the order, and the ticked checks go with the sale', async () => {
  const t = await open('/workshop/c2w/9');
  t.fireEvent.click(await t.ui.findByRole('button', { name: 'Hand over' }));
  const dialog = t.within(await t.ui.findByRole('dialog', { name: 'Hand over to Maya Patel' }));
  t.fireEvent.click(dialog.getByRole('checkbox', { name: CHECK_2 }));
  t.fireEvent.click(dialog.getByRole('button', { name: 'Hand over at the till' }));
  await t.waitFor(() => assert.equal(window.location.pathname, '/workshop/till'));
  assert.equal(window.location.search, '?c2w=9');
  const sale = t.within(await t.ui.findByRole('region', { name: 'Sale' }));
  await sale.findByText('[Bike] · [Size]');
  const pay = await payDialog({ ...t, sale });
  t.fireEvent.click(pay.getByRole('button', { name: /^Cycle to Work · \[Provider\]/ }));
  await t.waitFor(() => assert.equal(sales().length, 1));
  assert.deepEqual(sales()[0].c2wChecks, [CHECK_2]);
});

// ---- The till (till-c2w) ----

test('till-c2w: the order’s lines are locked and marked “on the order”, the bike with its held frame', async () => {
  const t = await openTill();
  assert.ok(t.sale.getByText('Maya Patel · Cycle to Work · quote CW-1'));
  assert.ok(t.sale.getByText('Frame [frame number] · the one held · on the order'));
  assert.equal(t.sale.getAllByText('Accessory · on the order').length, 2);
  assert.equal(t.sale.getAllByText('[Accessory]').length, 2);
  assert.ok(t.sale.getByText('£1,000.00') && t.sale.getByText('£40.00') && t.sale.getByText('£20.00'));
  // Locked: no quantity buttons and no tap to change.
  assert.ok(t.sale.queryByRole('button', { name: /^(Less|More|Remove|Change)/ }) === null);
  const pill = t.sale.getByRole('button', { name: 'Bike collected when paid' });
  assert.equal(pill.getAttribute('aria-pressed'), 'true');
  assert.equal(pill.disabled, true, 'handing over is collecting the bike');
  assert.ok(t.sale.getByRole('button', { name: 'Take payment · £1,060.00' }));
});

test('till-c2w: a counter line goes under the order’s, marked “added at the counter”, and adds to the total', async () => {
  const t = await openTill();
  await scanPads(t);
  assert.ok(t.sale.getByRole('button', { name: 'Take payment · £1,088.00' }));
});

test('till-c2w: an order no longer ready to hand over says so, with no payment to take', async () => {
  const t = await open('/workshop/till?c2w=9', { theOrder: order({ stage: 'collected', saleId: 601 }) });
  const sale = t.within(await t.ui.findByRole('region', { name: 'Sale' }));
  assert.ok(await sale.findByText('Maya Patel’s order isn’t ready to hand over: it’s already been handed over, or its stage has changed.'));
  assert.ok(sale.queryByRole('button', { name: /^Take payment/ }) === null);
  t.fireEvent.click(sale.getByRole('button', { name: 'Start a new sale instead' }));
  await t.waitFor(() => assert.equal(window.location.search, ''));
});

// ---- Take payment (till-c2w-pay, till-c2w-paid-cert) ----

test('till-c2w-pay: the provider is the first, one-tap way to pay; paid by the certificate alone', async () => {
  const t = await openTill();
  const pay = await payDialog(t);
  assert.ok(pay.getByRole('heading', { name: 'Take payment · £1,060.00' }));
  assert.ok(pay.getByText('Jo Taylor serving · Maya Patel’s Cycle to Work order'));
  const first = pay.getByRole('button', { name: /^Cycle to Work · \[Provider\] · £1,060\.00/ });
  assert.ok(pay.getByText('The certificate · owed by [Provider], not in the drawer · certificate [certificate number]'));
  for (const name of ['Card', 'Cash', 'Split']) assert.equal(pay.getByRole('button', { name }).disabled, true, `${name}: nothing left for Maya to pay`);
  assert.ok(pay.getByText('Anything the certificate doesn’t cover is taken from Maya as a second payment.'));
  t.fireEvent.click(first);
  assert.ok(await pay.findByRole('heading', { name: 'Paid' }));
  assert.deepEqual(sales(), [{ items: [], c2wOrderId: 9, c2wChecks: [], cashAmount: 0, cardAmount: 0, cashTendered: null, cashierId: 21, sellPastStock: true }]);
  assert.ok(pay.getByText('Cycle to Work · [Provider] · Sale 601'));
  assert.ok(pay.getByText('The certificate · owed by [Provider], not in the drawer'));
  const collected = pay.getAllByRole('status').find((s) => s.textContent.includes('collected'));
  assert.equal(collected.textContent, '[Bike] · [Size] collected, frame [frame number], on Maya’s bike record. Maya’s order is now Collected, with sale 601 in its history.');
  assert.ok(pay.queryByText('The receipt shows both payments.') === null);
  assert.ok(pay.getByRole('timer'), 'the next sale still starts by itself');
});

test('till-c2w-extra: with something added at the counter, the provider pays its share and Maya the rest by card', async () => {
  const t = await openTill();
  await scanPads(t);
  const pay = await payDialog(t);
  t.fireEvent.click(pay.getByRole('button', { name: /^Cycle to Work · \[Provider\] · £1,060\.00/ }));
  assert.ok(await pay.findByText('Maya pays'));
  assert.equal(sales().length, 0, 'nothing is saved until Maya has paid');
  assert.ok(pay.getByText('Shimano brake pads, added at the counter'));
  assert.ok(pay.getByText('£28.00'));
  t.fireEvent.click(pay.getByRole('button', { name: /^Card · £28\.00/ }));
  t.fireEvent.click(await pay.findByRole('button', { name: 'Card approved' }));
  assert.ok(await pay.findByRole('heading', { name: 'Paid' }));
  assert.deepEqual(sales(), [{ items: [{ productId: 40, qty: 1, unitPrice: 28 }], c2wOrderId: 9, c2wChecks: [], cashAmount: 0, cardAmount: 28, cashTendered: null, cashierId: 21, sellPastStock: true }]);
  assert.ok(pay.getByText('Cycle to Work · [Provider] and card · Sale 601'));
  assert.ok(pay.getByText('Card · Maya Patel'));
  assert.ok(pay.getByText('The receipt shows both payments.'));
});

test('till-c2w-extra: a certificate for less than the order leaves Maya the difference, even with nothing added', async () => {
  const t = await openTill({ theOrder: order({ certificatePence: 100000, providerPaysPence: 100000 }) });
  const pay = await payDialog(t);
  t.fireEvent.click(pay.getByRole('button', { name: /^Cycle to Work · \[Provider\] · £1,000\.00/ }));
  assert.ok(await pay.findByText('Maya pays'));
  assert.ok(pay.getByText('What the certificate doesn’t cover'));
  t.fireEvent.click(pay.getByRole('button', { name: 'Cash' }));
  t.fireEvent.change(await pay.findByLabelText('Or type the amount'), { target: { value: '60' } });
  t.fireEvent.click(pay.getByRole('button', { name: 'Cash taken' }));
  assert.ok(await pay.findByRole('heading', { name: 'Paid' }));
  assert.deepEqual(sales(), [{ items: [], c2wOrderId: 9, c2wChecks: [], cashAmount: 60, cardAmount: 0, cashTendered: 60, cashierId: 21, sellPastStock: true }]);
  assert.ok(pay.getByText('Cycle to Work · [Provider] and cash · Sale 601'));
});

test('a refused hand-over shows the server’s words and says no sale was recorded', async () => {
  const onSale = () => [409, { error: 'This order isn’t at that stage any more. Reload to see where it is.', code: 'wrong_stage' }];
  const t = await openTill({ theOrder: order({ certificatePence: 100000, providerPaysPence: 100000 }), onSale });
  const pay = await payDialog(t);
  t.fireEvent.click(pay.getByRole('button', { name: /^Cycle to Work · \[Provider\]/ }));
  t.fireEvent.click(await pay.findByRole('button', { name: /^Card · £60\.00/ }));
  t.fireEvent.click(await pay.findByRole('button', { name: 'Card approved' }));
  assert.equal((await pay.findByRole('alert')).textContent, 'This order isn’t at that stage any more. Reload to see where it is. No sale was recorded: if the card machine took the payment, reverse it on the machine.');
});

test('after Paid, the next sale is an empty till, not the order again', async () => {
  const t = await openTill({ tick: 5 });
  const pay = await payDialog(t);
  t.fireEvent.click(pay.getByRole('button', { name: /^Cycle to Work · \[Provider\]/ }));
  await t.waitFor(() => assert.equal(window.location.search, ''));
  await t.waitFor(() => assert.ok(t.ui.queryByText('[Bike] · [Size]') === null));
  assert.ok(t.ui.getByRole('button', { name: /^Take payment/ }).disabled);
});
