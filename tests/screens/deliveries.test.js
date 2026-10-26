// Stockroom › Deliveries and orders, New order and an order
// (openspec/changes/deliveries-orders; rs-hub, rs-hub-empty, rs-hub-staff,
// rs-order, rs-order-ordered, rs-order-close in receiving.mjs; receiving
// decisions 2, 4 and 10). Example data from the drawing: Shimano brake pads
// B05S-RX £28.00; everything else stays a bracketed placeholder.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const JO = { ...OWNER, id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false };
const SUPPLIERS = [{ id: 1, name: '[Supplier]' }, { id: 2, name: '[Supplier 2]' }, { id: 3, name: '[Supplier 3]' }, { id: 4, name: '[Supplier 4]' }];
const PADS = { id: 11, sku: 'B05S-RX', barcode: '4524667000001', name: 'Shimano brake pads', cost: 28, stockQty: 0 };
const TUBE = { id: 12, sku: '[Supplier code]', barcode: null, name: '[Product]', cost: 1.1, stockQty: 0 };
const item = (p, ordered, received, id = p.id + 100) => ({ id, productId: p.id, name: p.name, sku: p.sku, qtyOrdered: ordered, qtyReceived: received, outstanding: ordered - received, unitCost: p.cost });
const order = (over) => ({ id: 7, supplierId: 1, supplierName: '[Supplier]', status: 'partially_received', reference: '', notes: '', orderedAt: '2026-09-01T10:00:00.000Z', createdAt: '2026-09-01T09:00:00.000Z', items: [item(PADS, 1, 0), item(TUBE, 3, 1)], totalCost: 31.3, ...over });

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let rendered = false;
afterEach(async () => {
  // Nothing drawn, nothing to clean: importing the testing library before a
  // render breaks fireEvent.change for the whole file (rtl-cleanup-before-dom).
  if (!rendered) return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
  rendered = false;
});

async function open(path, { me = OWNER, orders = [order(), order({ id: 8, supplierName: '[Supplier 2]', status: 'draft', orderedAt: null, items: [item(TUBE, 2, 0)] })], phone = false } = {}) {
  calls = [];
  const byId = new Map(orders.map((o) => [o.id, o]));
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: String(url), method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, me);
    if (u.pathname === '/api/suppliers') return reply(200, SUPPLIERS);
    if (u.pathname === '/api/products') {
      const q = (u.searchParams.get('search') ?? '').toLowerCase();
      return reply(200, [PADS, TUBE].filter((p) => [p.name, p.sku, p.barcode].some((v) => v && v.toLowerCase().includes(q))));
    }
    if (u.pathname === '/api/purchase-orders' && method === 'GET') return reply(200, orders);
    if (u.pathname === '/api/purchase-orders' && method === 'POST') {
      const made = order({ id: 9, supplierId: body.supplierId, status: 'draft', orderedAt: null, items: body.items.map((it, i) => item([PADS, TUBE].find((p) => p.id === it.productId), it.qty, 0, 200 + i)), totalCost: 56 });
      byId.set(9, made);
      return reply(201, made);
    }
    const m = u.pathname.match(/^\/api\/purchase-orders\/(\d+)(?:\/(mark-ordered|cancel))?$/);
    if (m) {
      const o = byId.get(Number(m[1]));
      if (!o) return reply(404, { error: 'Purchase order not found' });
      if (m[2] === 'mark-ordered') byId.set(o.id, { ...o, status: 'ordered', orderedAt: '2026-09-01T10:00:00.000Z' });
      if (m[2] === 'cancel') byId.set(o.id, { ...o, status: 'cancelled' });
      return reply(200, byId.get(o.id));
    }
    if (u.pathname.startsWith('/api/')) return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom(`http://localhost${path}`);
  if (phone) window.matchMedia = (q) => ({ matches: q.includes('max-width'), media: q, addEventListener() {}, removeEventListener() {} });
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  rendered = true;
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui };
}
const posts = (end) => calls.filter((c) => c.method === 'POST' && c.url.endsWith(end));

// ---- The hub ----

test('the Owner sees the open orders, as drawn: supplier and lines, when ordered, what is still to come, the tag and Open', async () => {
  const { ui, within } = await open('/workshop/deliveries');
  const orders = within(await ui.findByRole('list', { name: 'Orders' }));
  const first = orders.getAllByRole('listitem')[0];
  assert.ok(first.textContent.includes('[Supplier] · 2 lines'), first.textContent);
  assert.ok(first.textContent.includes('Ordered Tue 1 Sep · 3 still to come'), first.textContent);
  assert.ok(first.textContent.includes('Partly delivered'), first.textContent);
  assert.equal(orders.getByRole('link', { name: 'Open the order from [Supplier], ordered Tue 1 Sep' }).getAttribute('href'), '/workshop/deliveries/orders/7');
  const draft = orders.getAllByRole('listitem')[1];
  assert.ok(draft.textContent.includes('Draft · not ordered yet') && draft.textContent.includes('Draft'), draft.textContent);
  assert.equal(orders.getByRole('link', { name: 'Open the draft order for [Supplier 2]' }).getAttribute('href'), '/workshop/deliveries/orders/8');
  assert.equal(ui.getByRole('link', { name: '+ New order' }).getAttribute('href'), '/workshop/deliveries/new-order');
});

test('closed and fully delivered orders leave the list; with none open, the drawn empty note', async () => {
  const { ui } = await open('/workshop/deliveries', { orders: [order({ status: 'cancelled' }), order({ id: 8, status: 'received' })] });
  assert.ok((await ui.findByText('No orders. Shops that order on the supplier’s website can ignore this — deliveries are received the same way.')) !== null);
  assert.ok(ui.queryByRole('list', { name: 'Orders' }) === null);
  assert.ok(ui.getByRole('link', { name: '+ New order' }));
});

test('a staff member sees the page without orders or + New order (decision 4)', async () => {
  const { ui } = await open('/workshop/deliveries', { me: JO });
  assert.ok((await ui.findByText('Orders are for the shop’s owner for now.')) !== null);
  assert.ok(ui.queryByRole('list', { name: 'Orders' }) === null);
  assert.ok(ui.queryByRole('link', { name: '+ New order' }) === null);
  assert.ok(!calls.some((c) => c.url.includes('/api/purchase-orders')), 'orders are not even asked for');
});

// ---- New order ----

async function newOrder(options) {
  const r = await open('/workshop/deliveries/new-order', options);
  await r.ui.findByRole('heading', { level: 2, name: 'What to order' });
  await r.ui.findByRole('radio', { name: '[Supplier]' });
  return r;
}

test('New order, as drawn: the way back, supplier pills with the first picked and Other…, the scan box and the note', async () => {
  const { ui, fireEvent, within } = await newOrder();
  assert.equal(within(ui.getByRole('main')).getByRole('link', { name: 'Deliveries and orders' }).getAttribute('href'), '/workshop/deliveries');
  assert.equal(ui.getByRole('radio', { name: '[Supplier]' }).checked, true);
  assert.ok(ui.getByRole('radio', { name: '[Supplier 3]' }));
  assert.ok(ui.queryByRole('radio', { name: '[Supplier 4]' }) === null, 'the fourth waits behind Other…');
  fireEvent.click(ui.getByRole('button', { name: 'Other…' }));
  assert.ok(await ui.findByRole('radio', { name: '[Supplier 4]' }));
  assert.ok(ui.getByRole('searchbox', { name: 'Add a product: scan, or type to search' }));
  assert.ok(ui.queryByText('Order it however you usually do — on the supplier’s website or by phone — then mark it as ordered so deliveries can be checked against it.') !== null);
});

test('scanning the pads adds a line; scanning again adds one; the count, the cost and the total follow', async () => {
  const { ui, fireEvent, within } = await newOrder();
  const box = ui.getByRole('searchbox', { name: 'Add a product: scan, or type to search' });
  for (let i = 0; i < 2; i++) {
    fireEvent.change(box, { target: { value: '4524667000001' } });
    await ui.findByRole('option', { name: /Shimano brake pads/ });
    fireEvent.keyDown(box, { key: 'Enter' });
    await ui.findByRole('list', { name: 'Lines' });
  }
  const lines = within(ui.getByRole('list', { name: 'Lines' }));
  assert.equal(lines.getAllByRole('listitem').length, 1);
  assert.equal(lines.getByRole('textbox', { name: 'How many: Shimano brake pads' }).value, '2');
  assert.ok(lines.getAllByRole('listitem')[0].textContent.includes('B05S-RX'));
  assert.ok(lines.getAllByRole('listitem')[0].textContent.includes('£56.00'));
  assert.ok(ui.getByText(/Total cost/).textContent.includes('£56.00'));
  fireEvent.click(lines.getByRole('button', { name: 'One fewer: Shimano brake pads' }));
  assert.equal(lines.getByRole('textbox', { name: 'How many: Shimano brake pads' }).value, '1');
  assert.ok(ui.getByText(/Total cost/).textContent.includes('£28.00'));
});

test('a click adds a match from the search; its count sets the total (3 × £1.10 is £3.30); Remove takes it off', async () => {
  const { ui, fireEvent, within } = await newOrder();
  fireEvent.change(ui.getByRole('searchbox', { name: 'Add a product: scan, or type to search' }), { target: { value: '[Prod' } });
  fireEvent.click(await ui.findByRole('option', { name: /\[Product\]/ }));
  const lines = within(await ui.findByRole('list', { name: 'Lines' }));
  fireEvent.change(lines.getByRole('textbox', { name: 'How many: [Product]' }), { target: { value: '3' } });
  assert.ok(ui.getByText(/Total cost/).textContent.includes('£3.30'), ui.getByText(/Total cost/).textContent);
  fireEvent.click(lines.getByRole('button', { name: 'Remove [Product]' }));
  assert.ok(ui.queryByRole('list', { name: 'Lines' }) === null);
});

test('Mark as ordered makes the order with the picked supplier, marks it ordered and opens it', async () => {
  const { ui, fireEvent } = await newOrder();
  fireEvent.click(ui.getByRole('radio', { name: '[Supplier 2]' }));
  const box = ui.getByRole('searchbox', { name: 'Add a product: scan, or type to search' });
  fireEvent.change(box, { target: { value: 'B05S-RX' } });
  await ui.findByRole('option', { name: /Shimano brake pads/ });
  fireEvent.keyDown(box, { key: 'Enter' });
  await ui.findByRole('list', { name: 'Lines' });
  fireEvent.click(ui.getByRole('button', { name: 'Mark as ordered' }));
  await ui.findByRole('heading', { level: 2, name: /^\[Supplier\] · ordered/ });
  assert.deepEqual(posts('/api/purchase-orders').map((c) => c.body), [{ supplierId: 2, items: [{ productId: 11, qty: 1, unitCost: 28 }] }]);
  assert.equal(posts('/api/purchase-orders/9/mark-ordered').length, 1);
  assert.equal(window.location.pathname, '/workshop/deliveries/orders/9');
});

test('Save as draft makes the order and does not mark it ordered; with no lines it says so and makes nothing', async () => {
  const { ui, fireEvent } = await newOrder();
  fireEvent.click(ui.getByRole('button', { name: 'Save as draft' }));
  assert.ok((await ui.findByRole('alert')).textContent.includes('Add a product first.'));
  assert.equal(posts('/api/purchase-orders').length, 0);
  const box = ui.getByRole('searchbox', { name: 'Add a product: scan, or type to search' });
  fireEvent.change(box, { target: { value: 'B05S-RX' } });
  await ui.findByRole('option', { name: /Shimano brake pads/ });
  fireEvent.keyDown(box, { key: 'Enter' });
  await ui.findByRole('list', { name: 'Lines' });
  fireEvent.click(ui.getByRole('button', { name: 'Save as draft' }));
  await ui.findByRole('heading', { level: 2, name: '[Supplier] · draft' });
  assert.equal(posts('/api/purchase-orders').length, 1);
  assert.equal(calls.filter((c) => c.url.includes('mark-ordered')).length, 0);
});

test('a staff member opening New order is told it is for the owner, with nothing to fill in', async () => {
  const { ui } = await open('/workshop/deliveries/new-order', { me: JO });
  assert.ok((await ui.findByText('Orders are for the shop’s owner for now.')) !== null);
  assert.ok(ui.queryByRole('button', { name: 'Mark as ordered' }) === null);
});

// ---- An order ----

test('an order, as drawn: supplier and date, Partly delivered, each line ordered and arrived with its tag, the server’s total', async () => {
  const { ui, within } = await open('/workshop/deliveries/orders/7');
  await ui.findByRole('heading', { level: 2, name: '[Supplier] · ordered Tue 1 Sep' });
  assert.ok(ui.getByText('Partly delivered'));
  const lines = within(ui.getByRole('list', { name: 'Lines' })).getAllByRole('listitem');
  assert.ok(lines[0].textContent.includes('Shimano brake pads') && lines[0].textContent.includes('B05S-RX · ordered 1 · arrived 0') && lines[0].textContent.includes('1 to come'), lines[0].textContent);
  assert.ok(lines[1].textContent.includes('ordered 3 · arrived 1') && lines[1].textContent.includes('2 to come'), lines[1].textContent);
  assert.ok(ui.getByText(/Total cost/).textContent.includes('£31.30'));
  assert.ok(ui.queryByRole('button', { name: 'Close the order' }) === null, 'something has arrived: the server can’t close it yet');
});

test('a line that has all arrived says All arrived', async () => {
  const { ui, within } = await open('/workshop/deliveries/orders/7', { orders: [order({ status: 'partially_received', items: [item(PADS, 1, 1), item(TUBE, 3, 0)] })] });
  await ui.findByRole('list', { name: 'Lines' });
  const lines = within(ui.getByRole('list', { name: 'Lines' })).getAllByRole('listitem');
  assert.ok(lines[0].textContent.includes('All arrived'), lines[0].textContent);
});

test('Close the order asks first; Keep it open changes nothing; Close the order cancels it', async () => {
  const { ui, fireEvent, within } = await open('/workshop/deliveries/orders/7', { orders: [order({ status: 'ordered', items: [item(PADS, 1, 0), item(TUBE, 3, 0)] })] });
  fireEvent.click(await ui.findByRole('button', { name: 'Close the order' }));
  let box = within(await ui.findByRole('dialog', { name: 'Close the order?' }));
  assert.ok(box.queryByText('[Supplier] · ordered Tue 1 Sep · 4 still to come') !== null);
  assert.ok(box.queryByText('Closing drops everything still to come on this order.') !== null);
  fireEvent.click(box.getByRole('button', { name: 'Keep it open' }));
  assert.ok(ui.queryByRole('dialog', { name: 'Close the order?' }) === null);
  assert.equal(posts('/cancel').length, 0);
  fireEvent.click(ui.getByRole('button', { name: 'Close the order' }));
  box = within(await ui.findByRole('dialog', { name: 'Close the order?' }));
  fireEvent.click(box.getByRole('button', { name: 'Close the order' }));
  assert.ok((await ui.findByText('Closed')) !== null);
  assert.equal(posts('/api/purchase-orders/7/cancel').length, 1);
});

test('a draft: the Owner can mark it as ordered from its page', async () => {
  const { ui, fireEvent } = await open('/workshop/deliveries/orders/8');
  await ui.findByRole('heading', { level: 2, name: '[Supplier 2] · draft' });
  fireEvent.click(ui.getByRole('button', { name: 'Mark as ordered' }));
  await ui.findByRole('heading', { level: 2, name: '[Supplier 2] · ordered Tue 1 Sep' });
  assert.equal(posts('/api/purchase-orders/8/mark-ordered').length, 1);
});

test('a staff member can read an order but not close or order it', async () => {
  const { ui } = await open('/workshop/deliveries/orders/8', { me: JO });
  await ui.findByRole('heading', { level: 2, name: '[Supplier 2] · draft' });
  assert.ok(ui.queryByRole('button', { name: 'Mark as ordered' }) === null);
  assert.ok(ui.queryByRole('button', { name: 'Close the order' }) === null);
});

test('an order that isn’t there says so', async () => {
  const { ui } = await open('/workshop/deliveries/orders/99');
  assert.ok((await ui.findByRole('alert')).textContent.includes('Order not found'));
});
