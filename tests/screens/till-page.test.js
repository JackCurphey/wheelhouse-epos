// The till (journey 11, piece 1; drawn by docs/design/user-journeys/generator/
// till.mjs): ring up a sale, change a line, take payment by card, cash or
// both, then Paid and the next sale.
// The Paid countdown is shortened for the tests (window.WH_TILL_TICK_MS).
// Spec: docs/superpowers/specs/2026-10-03-till-sale-design.md
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
let saleReply;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

function stubServer(employee) {
  calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ url, method, body: init.body ? JSON.parse(init.body) : undefined });
    const reply = (status, body) => ({ status, ok: status < 300, json: async () => body });
    const u = new URL(url, 'http://localhost');
    if (method === 'POST' && u.pathname === '/api/sales') return saleReply ?? reply(201, { id: 501 });
    if (u.pathname === '/api/auth/me') return reply(200, me(employee));
    if (u.pathname === '/api/employees') return reply(200, CASHIERS);
    if (u.pathname === '/api/workshop-services') return reply(200, SERVICES);
    if (u.pathname === '/api/products') return reply(200, [PADS]);
    return reply(404, { error: 'Not found' });
  };
}

async function openTill({ employee = JO } = {}) {
  saleReply = null;
  uninstall = installDom('http://localhost/workshop/till');
  window.WH_TILL_TICK_MS = 20;
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  stubServer(employee);
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  const sale = rtl.within(await ui.findByRole('region', { name: 'Sale' }));
  return { ...rtl, ui, sale };
}

const has = (q) => Boolean(q);
const sales = () => calls.filter((c) => c.method === 'POST' && c.url === '/api/sales').map((c) => c.body);

async function addService({ ui, fireEvent }) {
  fireEvent.click(await ui.findByRole('button', { name: /^Fit & adjust brakes/ }));
}
async function scanPads({ ui, fireEvent, waitFor, sale }) {
  const box = await ui.findByLabelText('Search products or services, or scan a barcode');
  fireEvent.change(box, { target: { value: '4524667' } });
  await ui.findByRole('button', { name: /^Shimano brake pads/ });
  fireEvent.keyDown(box, { key: 'Enter' });
  await waitFor(() => assert.ok(has(sale.queryByText('Part · B05S-RX'))));
}
async function openPay(t) {
  t.fireEvent.click(t.sale.getByRole('button', { name: /^Take payment/ }));
  return t.within(await t.ui.findByRole('dialog'));
}

test('an empty sale says so, and Take payment is off', async () => {
  const { sale } = await openTill();
  assert.ok(has(sale.queryByText('Nothing in the sale yet')));
  assert.equal(sale.getByRole('button', { name: 'Take payment' }).disabled, true);
});

test('the Workshop quick buttons are the shop’s active services, and one tap adds it', async () => {
  const t = await openTill();
  const quick = t.within(await t.ui.findByRole('group', { name: 'Workshop quick buttons' }));
  assert.ok(has(await quick.findByRole('button', { name: /^Fit & adjust brakes/ })));
  assert.equal(has(quick.queryByRole('button', { name: /Retired service/ })), false);
  await addService(t);
  assert.ok(has(t.sale.queryByText('Labour · 30 min')));
  assert.ok(has(t.sale.queryByRole('button', { name: 'Take payment · £18.00' })));
});

test('a scanned part shows its SKU; more than the stock says so but still sells', async () => {
  const t = await openTill();
  await scanPads(t);
  assert.equal(has(t.sale.queryByText(/sold anyway/)), false);
  t.fireEvent.click(t.sale.getByRole('button', { name: 'One more Shimano brake pads' }));
  assert.ok(has(await t.sale.findByText('Stock says 1 — sold anyway')));
  assert.ok(has(t.sale.queryByText('£28.00 each')));
  assert.ok(has(t.sale.queryByRole('button', { name: 'Take payment · £56.00' })));
  t.fireEvent.click(t.sale.getByRole('button', { name: 'One fewer Shimano brake pads' }));
  assert.equal(has(t.sale.queryByText(/sold anyway/)), false);
});

test('scanning the same part again makes it two, on one line', async () => {
  const t = await openTill();
  await scanPads(t);
  const box = t.ui.getByLabelText('Search products or services, or scan a barcode');
  t.fireEvent.keyDown(box, { key: 'Enter' });
  await t.waitFor(() => assert.ok(has(t.sale.queryByRole('button', { name: 'Take payment · £56.00' }))));
  assert.equal(t.sale.getAllByText('Part · B05S-RX').length, 1);
});

test('Clear empties the sale', async () => {
  const t = await openTill();
  await addService(t);
  t.fireEvent.click(t.sale.getByRole('button', { name: 'Clear' }));
  assert.ok(has(t.sale.queryByText('Nothing in the sale yet')));
});

test('tapping a line opens its price; a new price changes the total, and Remove takes it out', async () => {
  const t = await openTill();
  await scanPads(t);
  t.fireEvent.click(t.sale.getByRole('button', { name: /^Shimano brake pads/ }));
  let dlg = t.within(await t.ui.findByRole('dialog', { name: 'Shimano brake pads' }));
  assert.ok(has(dlg.queryByText('The usual price is £28.00.')));
  t.fireEvent.change(dlg.getByLabelText('Price each'), { target: { value: '25' } });
  t.fireEvent.click(dlg.getByRole('button', { name: 'Done' }));
  await t.waitFor(() => assert.ok(has(t.sale.queryByRole('button', { name: 'Take payment · £25.00' }))));
  t.fireEvent.click(t.sale.getByRole('button', { name: /^Shimano brake pads/ }));
  dlg = t.within(await t.ui.findByRole('dialog', { name: 'Shimano brake pads' }));
  t.fireEvent.click(dlg.getByRole('button', { name: 'Remove from sale' }));
  await t.waitFor(() => assert.ok(has(t.sale.queryByText('Nothing in the sale yet'))));
});

test('card: key it into the machine, then Card approved saves the sale and shows Paid', async () => {
  const t = await openTill();
  await addService(t);
  const pay = await openPay(t);
  assert.ok(has(pay.queryByText('Take payment · £18.00')));
  assert.ok(has(pay.queryByText('Jo Taylor serving · 1 item')));
  t.fireEvent.click(pay.getByRole('button', { name: /^Card · £18.00/ }));
  assert.ok(has(await pay.findByText('Key £18.00 into the card machine.')));
  t.fireEvent.click(pay.getByRole('button', { name: 'Card approved' }));
  assert.ok(has(await pay.findByText('Paid')));
  assert.deepEqual(sales(), [{
    items: [{ lineType: 'labour', serviceId: 1, name: 'Fit & adjust brakes', unitPrice: 18, minutes: 30 }],
    cashAmount: 0, cardAmount: 18, cashTendered: null, cashierId: 21, sellPastStock: true,
  }]);
  assert.ok(has(pay.queryByText('Card · £18.00')));
  t.fireEvent.click(pay.getByRole('button', { name: 'No receipt' }));
  await t.waitFor(() => assert.ok(has(t.sale.queryByText('Nothing in the sale yet'))));
});

test('cash: the note buttons, the change to give, and Cash taken', async () => {
  const t = await openTill();
  await scanPads(t);
  const pay = await openPay(t);
  t.fireEvent.click(pay.getByRole('button', { name: /^Cash/ }));
  const notes = t.within(await pay.findByRole('group', { name: 'Amount handed over' }));
  assert.deepEqual(notes.getAllByRole('button').map((b) => b.textContent), ['£28.00', '£30.00', '£40.00', '£50.00']);
  assert.equal(pay.getByRole('button', { name: 'Cash taken' }).disabled, true);
  t.fireEvent.click(notes.getByRole('button', { name: '£40.00' }));
  assert.ok(has(pay.queryByText('£12.00')));
  t.fireEvent.click(pay.getByRole('button', { name: 'Cash taken' }));
  assert.ok(has(await pay.findByText('Paid')));
  assert.deepEqual(sales(), [{
    items: [{ productId: 40, qty: 1, unitPrice: 28 }],
    cashAmount: 28, cardAmount: 0, cashTendered: 40, cashierId: 21, sellPastStock: true,
  }]);
  assert.ok(has(pay.queryByText('Change to give £12.00')));
});

test('typed cash short of the total can’t be taken', async () => {
  const t = await openTill();
  await scanPads(t);
  const pay = await openPay(t);
  t.fireEvent.click(pay.getByRole('button', { name: /^Cash/ }));
  t.fireEvent.change(await pay.findByLabelText('Or type the amount'), { target: { value: '20' } });
  assert.equal(pay.getByRole('button', { name: 'Cash taken' }).disabled, true);
  t.fireEvent.change(pay.getByLabelText('Or type the amount'), { target: { value: '28.50' } });
  assert.equal(pay.getByRole('button', { name: 'Cash taken' }).disabled, false);
});

test('split: part in cash, the rest by card', async () => {
  const t = await openTill();
  await scanPads(t);
  await addService(t);
  const pay = await openPay(t);
  t.fireEvent.click(pay.getByRole('button', { name: 'Split' }));
  t.fireEvent.change(await pay.findByLabelText('Cash part'), { target: { value: '20' } });
  assert.ok(has(pay.queryByText('£26.00')));
  t.fireEvent.click(pay.getByRole('button', { name: /^Card · £26.00/ }));
  assert.ok(has(await pay.findByText('Key £26.00 into the card machine.')));
  t.fireEvent.click(pay.getByRole('button', { name: 'Card approved' }));
  assert.ok(has(await pay.findByText('Paid')));
  assert.deepEqual(sales().map(({ cashAmount, cardAmount, cashTendered }) => ({ cashAmount, cardAmount, cashTendered })), [
    { cashAmount: 20, cardAmount: 26, cashTendered: 20 },
  ]);
});

test('Paid counts down, then the next sale starts by itself', async () => {
  const t = await openTill();
  await addService(t);
  const pay = await openPay(t);
  t.fireEvent.click(pay.getByRole('button', { name: /^Card · £18.00/ }));
  t.fireEvent.click(await pay.findByRole('button', { name: 'Card approved' }));
  assert.ok(has(await pay.findByText('Next sale starts in 5 seconds')));
  await t.waitFor(() => assert.ok(has(t.sale.queryByText('Nothing in the sale yet'))), { timeout: 2000 });
  assert.equal(has(t.ui.queryByRole('dialog')), false);
});

test('if the sale can’t be saved, staff are told and the sale stays', async () => {
  const t = await openTill();
  await addService(t);
  saleReply = { status: 400, ok: false, json: async () => ({ error: 'Payment amounts must add up to the total' }) };
  const pay = await openPay(t);
  t.fireEvent.click(pay.getByRole('button', { name: /^Card · £18.00/ }));
  t.fireEvent.click(await pay.findByRole('button', { name: 'Card approved' }));
  assert.ok(has(await pay.findByText('Payment amounts must add up to the total')));
  assert.equal(has(pay.queryByText('Paid')), false);
  assert.ok(has(t.sale.queryByText('Labour · 30 min')));
});

test('a login that isn’t a staff member who takes sales is asked who’s serving', async () => {
  const t = await openTill({ employee: null });
  await addService(t);
  const pay = await openPay(t);
  assert.ok(has(await pay.findByText('Who’s serving?')));
  t.fireEvent.click(await pay.findByRole('button', { name: 'Sam Lee' }));
  assert.ok(has(await pay.findByText('Sam Lee serving · 1 item')));
  t.fireEvent.click(pay.getByRole('button', { name: /^Card · £18.00/ }));
  t.fireEvent.click(await pay.findByRole('button', { name: 'Card approved' }));
  await pay.findByText('Paid');
  assert.equal(sales()[0].cashierId, 31);
  assert.ok(calls.some((c) => c.url === '/api/employees?role=cashier'));
});

// Fresh review of #111, 4 Oct: closing the window mid-save hid a sale that
// the server still saved, so Take payment again sold it twice.
test('while a card payment is saving, Escape can’t close the window, and Paid follows', async () => {
  const t = await openTill();
  await addService(t);
  let answer;
  saleReply = new Promise((resolve) => { answer = resolve; });
  const pay = await openPay(t);
  t.fireEvent.click(pay.getByRole('button', { name: /^Card · £18.00/ }));
  t.fireEvent.click(await pay.findByRole('button', { name: 'Card approved' }));
  const dialog = t.ui.getByRole('dialog');
  const escape = new window.Event('cancel', { cancelable: true });
  dialog.dispatchEvent(escape);
  assert.equal(escape.defaultPrevented, true);
  answer({ status: 201, ok: true, json: async () => ({ id: 501 }) });
  assert.ok(has(await pay.findByText('Paid')));
  assert.equal(sales().length, 1);
});

test('if the reply is lost, staff are told the sale may have saved', async () => {
  const t = await openTill();
  await addService(t);
  saleReply = Promise.reject(new TypeError('Failed to fetch'));
  saleReply.catch(() => {});
  const pay = await openPay(t);
  t.fireEvent.click(pay.getByRole('button', { name: /^Card · £18.00/ }));
  t.fireEvent.click(await pay.findByRole('button', { name: 'Card approved' }));
  assert.ok(has(await pay.findByText(/may have saved/)));
  assert.equal(has(pay.queryByText(/nothing was saved/)), false);
});

test('typed amounts are sent to the penny', async () => {
  const t = await openTill();
  await scanPads(t);
  const pay = await openPay(t);
  t.fireEvent.click(pay.getByRole('button', { name: /^Cash/ }));
  t.fireEvent.change(await pay.findByLabelText('Or type the amount'), { target: { value: '30.004' } });
  t.fireEvent.click(pay.getByRole('button', { name: 'Cash taken' }));
  assert.ok(has(await pay.findByText('Paid')));
  assert.equal(sales()[0].cashTendered, 30);
});

test('each step moves keyboard focus to its title', async () => {
  const t = await openTill();
  await addService(t);
  const pay = await openPay(t);
  t.fireEvent.click(pay.getByRole('button', { name: /^Card · £18.00/ }));
  await t.waitFor(() => assert.equal(document.activeElement?.textContent, 'Card · £18.00'));
  t.fireEvent.click(pay.getByRole('button', { name: 'Card approved' }));
  await t.waitFor(() => assert.equal(document.activeElement?.textContent, 'Paid'));
});

// A browser may close the window anyway (Chrome lets a second Escape through):
// mid-save it must come straight back, so the sale can't vanish.
test('if the browser closes the window mid-save, it comes back and shows Paid', async () => {
  const t = await openTill();
  await addService(t);
  let answer;
  saleReply = new Promise((resolve) => { answer = resolve; });
  const pay = await openPay(t);
  t.fireEvent.click(pay.getByRole('button', { name: /^Card · £18.00/ }));
  t.fireEvent.click(await pay.findByRole('button', { name: 'Card approved' }));
  t.act(() => { t.ui.getByRole('dialog').close(); });
  await t.waitFor(() => assert.equal(t.ui.getByRole('dialog').open, true));
  answer({ status: 201, ok: true, json: async () => ({ id: 501 }) });
  assert.ok(has(await t.within(t.ui.getByRole('dialog')).findByText('Paid')));
  assert.equal(sales().length, 1);
});

test('a typed split cash part is sent to the penny', async () => {
  const t = await openTill();
  await scanPads(t);
  await addService(t);
  const pay = await openPay(t);
  t.fireEvent.click(pay.getByRole('button', { name: 'Split' }));
  t.fireEvent.change(await pay.findByLabelText('Cash part'), { target: { value: '20.004' } });
  t.fireEvent.click(pay.getByRole('button', { name: /^Card · £26.00/ }));
  t.fireEvent.click(await pay.findByRole('button', { name: 'Card approved' }));
  assert.ok(has(await pay.findByText('Paid')));
  const [s] = sales();
  assert.deepEqual([s.cashAmount, s.cardAmount, s.cashTendered], [20, 26, 20]);
});
