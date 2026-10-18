// Paying a workshop job's order at the till (Jack, 18 Oct,
// docs/decisions/2026-10-18-till-job-payment.md; drawn as till-job in
// docs/design/user-journeys/generator/till.mjs): the till opens with the job's
// agreed lines locked and "Bike collected when paid" on; paying pays the
// whole order (POST /api/sale-documents/:id/convert), then records the bike
// as collected (POST /api/workshop-jobs/:id/collect) unless the pill is off.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const JO = { id: 21, name: 'Jo Taylor', isCashier: true };
const me = (employee) => ({ id: 1, name: 'Jo Taylor', email: 'jo@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street', employee });
const SERVICES = [
  { id: 1, name: 'Fit & adjust brakes', price: 18, minutes: 30, active: true },
  { id: 2, name: 'Retired service', price: 5, minutes: 10, active: false },
];
const PADS = { id: 40, sku: 'B05S-RX', barcode: '4524667', name: 'Shimano brake pads', price: 28, stockQty: 1, active: true };
const CASHIERS = [{ id: 31, name: 'Sam Lee', isMechanic: false, isCashier: true, workingDays: [1, 2, 3, 4, 5], active: true }];

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let JOB;
let ORDER;
let convertReply;
let DUE;
// What paying the order returns: the whole sale (serializeSale).
const SALE = { id: 601, createdAt: '2026-10-06T10:45:00.000Z', subtotal: 83, discount: 0, groupDiscountAmount: 0, groupDiscountName: '', total: 83, paymentMethod: 'Card', cashAmount: 0, cardAmount: 83, cashTendered: null, extraPayments: [],
  items: [{ id: 1, name: 'Standard service', qty: 1, unitPrice: 65, lineTotal: 65 }, { id: 2, name: 'Shimano brake pads', qty: 1, unitPrice: 18, lineTotal: 18 }] };
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

function job(over = {}) {
  return { id: 1, title: 'Standard service', reference: 'WH-1042', customerId: 5, customerName: 'Maya Patel', bikeLabel: 'Trek Domane AL 3',
    mechanicId: 11, jobDate: '2026-10-06', startTime: '10:00', endTime: '11:00', bookingState: 'scheduled', custodyState: 'in_shop',
    workState: 'complete', version: 7, orderId: 40, orderStatus: 'open', orderTotal: 83, requested: null, ...over };
}
function order(over = {}) {
  return { id: 40, kind: 'order', status: 'open', customerId: 5, customerName: 'Maya Patel', subtotal: 83, discount: 0, total: 83, workshopJobId: 1,
    items: [
      { id: 1, productId: null, name: 'Standard service', unitPrice: 65, qty: 1, lineTotal: 65, lineType: 'labour', serviceId: 3, minutes: 60 },
      { id: 2, productId: 7, name: 'Shimano brake pads', sku: 'B05S-RX', unitPrice: 18, qty: 1, lineTotal: 18, lineType: 'product', serviceId: null, minutes: null },
    ], ...over };
}

function stubServer(employee) {
  calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ url, method, body: init.body ? JSON.parse(init.body) : undefined });
    const reply = (status, body) => ({ status, ok: status < 300, json: async () => body });
    const u = new URL(url, 'http://localhost');
    if (method === 'POST' && u.pathname === '/api/sale-documents/40/convert') {
      if (convertReply) return convertReply;
      JOB = { ...JOB, workState: 'complete', version: JOB.version + 1, orderStatus: 'converted' };
      return reply(201, SALE);
    }
    if (method === 'POST' && u.pathname === '/api/workshop-jobs/1/collect') return reply(200, { ...JOB, custodyState: 'collected', version: JOB.version + 1 });
    if (u.pathname === '/api/auth/me') return reply(200, me(employee));
    if (u.pathname === '/api/employees') return reply(200, CASHIERS);
    if (u.pathname === '/api/workshop-services') return reply(200, SERVICES);
    if (u.pathname === '/api/products') return reply(200, [PADS]);
    if (u.pathname === '/api/workshop-jobs/1') return reply(200, JOB);
    if (u.pathname === '/api/sale-documents/40') return reply(200, ORDER);
    if (u.pathname === '/api/sale-documents/40/due') return DUE.error ? reply(DUE.status ?? 400, DUE) : reply(200, DUE);
    return reply(404, { error: 'Not found' });
  };
}

async function openJobTill({ jobOver = {}, orderOver = {}, dueOver = {} } = {}) {
  JOB = job(jobOver);
  ORDER = order(orderOver);
  convertReply = null;
  DUE = { subtotal: 83, discount: 0, groupDiscount: 0, groupName: '', total: 83, stock: { 7: 5 }, ...dueOver };
  uninstall = installDom('http://localhost/workshop/till?job=1');
  window.WH_TILL_TICK_MS = 20;
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  stubServer(JO);
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  const sale = rtl.within(await ui.findByRole('region', { name: 'Sale' }));
  return { ...rtl, ui, sale };
}
const has = (q) => Boolean(q);
const posts = (path) => calls.filter((c) => c.method === 'POST' && c.url === path).map((c) => c.body);
async function payByCard(t) {
  const take = await t.sale.findByRole('button', { name: /^Take payment/ });
  // It waits for the amount due to arrive.
  await t.waitFor(() => assert.equal(take.disabled, false));
  t.fireEvent.click(take);
  const dlg = t.within(await t.ui.findByRole('dialog'));
  t.fireEvent.click(dlg.getByRole('button', { name: /^Card · / }));
  t.fireEvent.click(await dlg.findByRole('button', { name: 'Card approved' }));
  return dlg;
}

test('the job\'s agreed lines load locked, with the customer and job, and Bike collected when paid on', async () => {
  const { sale } = await openJobTill();
  assert.ok(has(await sale.findByText('Maya Patel · workshop job WH-1042')));
  assert.ok(has(await sale.findByText('Standard service')));
  assert.ok(has(sale.queryByText(/Labour · 60 min · agreed on the job/)));
  assert.equal(sale.queryAllByText(/agreed on the job/).length, 2);
  assert.equal(sale.queryAllByRole('button', { name: /^One more / }).length, 0);
  assert.equal(sale.getByRole('button', { name: 'Bike collected when paid' }).getAttribute('aria-pressed'), 'true');
  assert.ok(has(sale.queryByRole('button', { name: 'Take payment · £83.00' })));
});

test('paying pays the whole order, then records the bike as collected', async () => {
  const t = await openJobTill();
  await t.sale.findByText('Maya Patel · workshop job WH-1042');
  await payByCard(t);
  await t.waitFor(() => assert.equal(posts('/api/sale-documents/40/convert').length, 1));
  assert.deepEqual(posts('/api/sale-documents/40/convert')[0], { cashAmount: 0, cardAmount: 83, cashTendered: null, cashierId: 21, sellPastStock: true });
  await t.waitFor(() => assert.deepEqual(posts('/api/workshop-jobs/1/collect'), [{ version: 8 }]));
  assert.equal(posts('/api/sales').length, 0);
});

test('with Bike collected when paid off, the bike stays in', async () => {
  const t = await openJobTill();
  t.fireEvent.click(await t.sale.findByRole('button', { name: 'Bike collected when paid' }));
  await payByCard(t);
  await t.waitFor(() => assert.equal(posts('/api/sale-documents/40/convert').length, 1));
  assert.equal(posts('/api/workshop-jobs/1/collect').length, 0);
});

test('a bike not in the shop has no Bike collected when paid', async () => {
  const { sale } = await openJobTill({ jobOver: { custodyState: 'expected' } });
  await sale.findByText('Maya Patel · workshop job WH-1042');
  assert.equal(has(sale.queryByRole('button', { name: 'Bike collected when paid' })), false);
});

test('an order already paid says so, with nothing to take', async () => {
  const { sale } = await openJobTill({ jobOver: { orderStatus: 'converted' }, orderOver: { status: 'converted' } });
  assert.ok(has(await sale.findByText('This job’s order is already paid.')));
  assert.equal(has(sale.queryByRole('button', { name: /^Take payment/ })), false);
});

test('work not started can\'t be paid yet', async () => {
  const { sale } = await openJobTill({ jobOver: { workState: 'not_started' } });
  assert.ok(has(await sale.findByText('The work isn’t finished, so this job can’t be paid yet.')));
  assert.equal((await sale.findByRole('button', { name: /^Take payment/ })).disabled, true);
});

test('a refused payment says why in plain words', async () => {
  const t = await openJobTill();
  convertReply = { status: 409, ok: false, json: async () => ({ error: 'cannot finish a job that is on_hold; from here you can resume', code: 'illegal' }) };
  await t.sale.findByText('Maya Patel · workshop job WH-1042');
  const dlg = await payByCard(t);
  assert.ok(has(await dlg.findByText('The work isn’t finished, so this job can’t be paid yet. No sale was recorded: if the card machine took the payment, reverse it on the machine.')));
  assert.equal(posts('/api/workshop-jobs/1/collect').length, 0);
});

// Fresh review, 18 Oct.
test('if the job didn\'t finish while paying, the bike isn\'t handed over, and Paid says why and waits', async () => {
  const t = await openJobTill();
  convertReply = { status: 201, ok: true, json: async () => ({ id: 601, jobWarning: 'The order was paid but the job could not be marked finished: someone changed it.' }) };
  const dlg = await payByCard(t);
  assert.ok(has(await dlg.findByText(/could not be marked finished/)));
  assert.equal(posts('/api/workshop-jobs/1/collect').length, 0);
  // With a note, Paid waits for No receipt rather than counting down.
  await new Promise((r) => setTimeout(r, 200));
  assert.ok(has(dlg.queryByRole('button', { name: 'No receipt' })));
  assert.equal(has(dlg.queryByRole('timer')), false);
});

test('a cancelled order is not called paid', async () => {
  const { sale } = await openJobTill({ jobOver: { orderStatus: 'cancelled' }, orderOver: { status: 'cancelled' } });
  assert.ok(has(await sale.findByText('This job’s order was cancelled, so there’s nothing to pay here.')));
  assert.equal(has(sale.queryByText('This job’s order is already paid.')), false);
});

// Jack, 18 Oct (answer 3): the till pays the amount due, with the order's and
// the customer's discounts taken off, and sells past zero stock, warning.
test('a customer group and an order discount come off, and the card is asked for what is due', async () => {
  const t = await openJobTill({ dueOver: { discount: 2, groupDiscount: 8.1, groupName: 'Blue Light (10%)', total: 72.9 } });
  assert.ok(has(await t.sale.findByText('Blue Light (10%)')));
  assert.ok(has(t.sale.queryByText('−£8.10')));
  assert.ok(has(t.sale.queryByText('−£2.00')));
  assert.ok(has(await t.sale.findByRole('button', { name: 'Take payment · £72.90' })));
  await payByCard(t);
  await t.waitFor(() => assert.equal(posts('/api/sale-documents/40/convert')[0]?.cardAmount, 72.9));
});

test('a part out of stock is sold anyway, and says so', async () => {
  const { sale } = await openJobTill({ dueOver: { stock: { 7: 0 } } });
  assert.ok(has(await sale.findByText('Stock says 0 — sold anyway')));
});

// Fresh re-review, 18 Oct: the card must never be taken for a sale the server
// would refuse, and if it is refused after the card step, say to reverse it.
test('an order the server won\'t pay (a retired part) says why, and Take payment stays off', async () => {
  const { sale } = await openJobTill({ dueOver: { error: 'Product 7 not found or inactive' } });
  assert.ok(has(await sale.findByText('This job can’t be paid here yet: Product 7 not found or inactive. Change it in the job’s Work and parts.')));
  assert.equal((await sale.findByRole('button', { name: /^Take payment/ })).disabled, true);
});

test('any refusal after the card step says no sale was recorded and to reverse the card', async () => {
  const t = await openJobTill();
  convertReply = { status: 400, ok: false, json: async () => ({ error: 'This order is already converted' }) };
  const dlg = await payByCard(t);
  assert.ok(has(await dlg.findByText('This order is already converted. No sale was recorded: if the card machine took the payment, reverse it on the machine.')));
});

test('a server fault on the amount due says try again, not change the job, and Take payment stays off', async () => {
  const { sale } = await openJobTill({ dueOver: { error: 'Internal error', status: 500 } });
  assert.ok(has(await sale.findByText('Wheelhouse couldn’t work out the amount due. Try again in a moment.', {}, { timeout: 15000 })));
  assert.equal(has(sale.queryByText(/Change it in the job’s Work and parts/)), false);
  assert.equal((await sale.findByRole('button', { name: /^Take payment/ })).disabled, true);
});

// Printing a receipt (Jack, 18 Oct, docs/decisions/2026-10-18-print-receipt.md):
// a job's receipt names the job and bike.
test('Print on Paid prints the job’s receipt, with the job and bike, then the next sale', async () => {
  const t = await openJobTill();
  let printed = null;
  window.print = () => { printed = document.getElementById('wh-print')?.textContent ?? null; };
  const dlg = await payByCard(t);
  assert.ok(has(await dlg.findByText('Card · £83.00 · Sale 601')));
  t.fireEvent.click(await dlg.findByRole('button', { name: 'Print' }));
  assert.ok(printed !== null, 'nothing was printed');
  for (const want of ['North Street Cycles', 'Sale 601', 'WH-1042 · Trek Domane AL 3', 'Standard service£65.00', 'Total£83.00', 'Paid by card£83.00']) assert.ok(printed.includes(want), `missing "${want}" in: ${printed}`);
  await t.waitFor(() => assert.equal(has(t.ui.queryByRole('dialog')), false));
});
