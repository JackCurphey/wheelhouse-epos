// A product's page: Edit, its details, and its price and cost changes in the history (openspec/changes/product-page-sizes,
// design 1; st-product draws "Price changed · £28.00 → £[price]" and a Price changes pill).
// Shimano brake pads B05S-RX £28.00, Jack Lewis and Jo Taylor as drawn; the rest bracketed,
// or a number only the test needs.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const JO = { ...OWNER, id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false };
const PADS = { id: 1, sku: 'B05S-RX', barcode: '[barcode]', name: 'Shimano brake pads', category: '[Category]', pricePence: 2800, costPence: 1400, stockQty: 6, lowStockThreshold: 3, supplier: '[Supplier]', active: true, showOnline: false, description: '', photoUrl: null, vatRateBp: 2000, details: [] };
const SOLD = { id: 11, type: 'sale', change: -1, reason: null, note: '', who: 'Jo Taylor', at: '2026-09-01T09:00:00.000Z' };
const PRICE = { id: 'p3', type: 'price_change', field: 'price', was: 2800, now: 3000, who: 'Jack Lewis', at: '2026-09-01T12:00:00.000Z', delivery: null };
const COST = { id: 'p4', type: 'price_change', field: 'cost', was: 1400, now: 1500, who: 'Jack Lewis', at: '2026-09-01T13:00:00.000Z', delivery: { id: 9, supplierName: '[Supplier]' } };
const realFetch = globalThis.fetch;
let uninstall;
let shell;
let rendered = false;
afterEach(async () => {
  if (!rendered) return;
  rendered = false;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

async function open({ me = OWNER, history = [COST, PRICE, SOLD] } = {}) {
  const page = { ...PADS, stockAtShops: [{ id: 7, name: 'North Street Cycles', qty: 6, here: true }], history };
  globalThis.fetch = async (url) => {
    const answer = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return answer(200, me);
    if (u.pathname === '/api/products/1') return answer(200, page);
    if (u.pathname.startsWith('/api/')) return answer(200, []);
    return answer(404, { error: 'Not found' });
  };
  uninstall = installDom('http://localhost/workshop/stock/1');
  rendered = true;
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByRole('heading', { level: 2, name: 'Shimano brake pads' });
  return { ...rtl, ui };
}
const lines = (ui, within) => within(ui.getByRole('list', { name: 'Stock history' })).getAllByRole('listitem').map((li) => li.textContent);

test('a price change reads "Price changed · £28.00 → £30.00", a cost change names its delivery', async () => {
  const { ui, within } = await open();
  const [cost, price] = lines(ui, within);
  assert.match(cost, /^Cost changed · £14\.00 → £15\.00/);
  assert.match(cost, /delivery from \[Supplier\]/);
  assert.match(cost, /Jack Lewis/);
  assert.match(price, /^Price changed · £28\.00 → £30\.00/);
  assert.ok(!/[+−]\d/.test(price), 'no stock change on a price line');
});

test('Price changes narrows the history to them', async () => {
  const { ui, within, fireEvent } = await open();
  fireEvent.click(ui.getByRole('radio', { name: 'Price changes' }));
  assert.equal(lines(ui, within).length, 2);
  fireEvent.click(ui.getByRole('radio', { name: 'Sold' }));
  assert.equal(lines(ui, within).length, 1);
});

test('no Price changes pill when the history has none, as Jo is sent', async () => {
  const { ui } = await open({ me: JO, history: [SOLD] });
  ui.getByRole('radio', { name: 'Sold' });
  assert.ok(ui.queryByRole('radio', { name: 'Price changes' }) === null);
});

// Edit and the Details box (design 2; st-product draws Edit for the Owner, none for staff, and
// "Details · [Category]" with its own Edit). Bearings with Inner diameter, Outer diameter and
// Height in mm, as rs-add-product draws them.
const BEARINGS = { id: 5, name: 'Bearings', parentId: null, path: 'Bearings', details: [
  { id: 51, name: 'Inner diameter', kind: 'number', unit: 'mm', choices: [] },
  { id: 52, name: 'Outer diameter', kind: 'number', unit: 'mm', choices: [] },
  { id: 53, name: 'Height', kind: 'number', unit: 'mm', choices: [] },
] };
const BEARING = { ...PADS, name: '[Bearing]', category: 'Bearings', details: [
  { id: 51, name: 'Inner diameter', kind: 'number', unit: 'mm', choices: [], from: 'Bearings', value: null },
  { id: 52, name: 'Outer diameter', kind: 'number', unit: 'mm', choices: [], from: 'Bearings', value: 30 },
  { id: 53, name: 'Height', kind: 'number', unit: 'mm', choices: [], from: 'Bearings', value: null },
] };
let sent;
async function openEdit({ me = OWNER, product = PADS, refuse = null } = {}) {
  sent = [];
  let page = { ...product, stockAtShops: [{ id: 7, name: 'North Street Cycles', qty: 6, here: true }], history: [] };
  globalThis.fetch = async (url, init = {}) => {
    const answer = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return answer(200, me);
    if (u.pathname === '/api/product-categories') return answer(200, { categories: [BEARINGS] });
    if (init.method === 'PUT') {
      const body = JSON.parse(init.body);
      sent.push({ path: u.pathname, body });
      if (refuse) return answer(refuse.status, refuse.body);
      if (u.pathname === '/api/products/1') page = { ...page, ...body };
      return answer(200, page);
    }
    if (u.pathname === '/api/products/1') return answer(200, page);
    if (u.pathname.startsWith('/api/')) return answer(200, []);
    return answer(404, { error: 'Not found' });
  };
  uninstall = installDom('http://localhost/workshop/stock/1');
  rendered = true;
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByRole('heading', { level: 2, name: product.name });
  return { ...rtl, ui };
}
async function editBox(t, name = 'Edit') {
  t.fireEvent.click(t.ui.getByRole('button', { name }));
  return t.within(await t.ui.findByRole('dialog'));
}
const type = (t, box, label, value) => t.fireEvent.change(box.getByLabelText(label), { target: { value } });

test('Edit is the Owner’s: staff see Adjust stock and no Edit', async () => {
  const { ui } = await openEdit({ me: JO });
  ui.getByRole('button', { name: 'Adjust stock' });
  assert.ok(ui.queryByRole('button', { name: 'Edit' }) === null);
});

test('Edit opens the box filled in, money in pounds', async () => {
  const t = await openEdit();
  const box = await editBox(t);
  assert.equal(box.getByLabelText('Name').value, 'Shimano brake pads');
  assert.equal(box.getByLabelText('Supplier code').value, 'B05S-RX');
  assert.equal(box.getByLabelText('Price').value, '28.00');
  assert.equal(box.getByLabelText('Cost').value, '14.00');
  assert.equal(box.getByLabelText('Low-stock level').value, '3');
});

test('a new price is sent in whole pence, and the page shows it', async () => {
  const t = await openEdit();
  const box = await editBox(t);
  type(t, box, 'Price', '30');
  t.fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await t.waitFor(() => assert.equal(sent.length, 1));
  assert.equal(sent[0].path, '/api/products/1');
  assert.equal(sent[0].body.pricePence, 3000);
  assert.equal(sent[0].body.costPence, 1400);
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog') === null));
  await t.ui.findByText('£30.00');
});

test('a blank cost isn’t sent, so the cost stays', async () => {
  const t = await openEdit();
  const box = await editBox(t);
  type(t, box, 'Cost', '');
  t.fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await t.waitFor(() => assert.equal(sent.length, 1));
  assert.equal('costPence' in sent[0].body, false);
});

test('a price that isn’t money greys Save and says why', async () => {
  const t = await openEdit();
  const box = await editBox(t);
  type(t, box, 'Price', 'abc');
  const save = box.getByRole('button', { name: 'Save' });
  assert.equal(save.getAttribute('aria-disabled'), 'true');
  assert.equal(document.getElementById(save.getAttribute('aria-describedby')).textContent, 'Type a price in pounds, like 28.00');
  t.fireEvent.click(save);
  assert.equal(sent.length, 0);
});

test('the server’s words stay in the box', async () => {
  const t = await openEdit({ refuse: { status: 400, body: { error: 'Barcode "[barcode]" is already in use' } } });
  const box = await editBox(t);
  t.fireEvent.click(box.getByRole('button', { name: 'Save' }));
  assert.equal((await box.findByRole('alert')).textContent, 'Barcode "[barcode]" is already in use');
  assert.ok(t.ui.queryByRole('dialog') !== null);
});

test('Details · Bearings shows its answers; the box saves a changed one after the product', async () => {
  const t = await openEdit({ product: BEARING });
  const details = t.within(t.ui.getByRole('region', { name: 'Details · Bearings' }));
  assert.ok(details.getByText('30 mm'));
  assert.equal(details.getAllByText('—').length, 2);
  const box = await editBox(t, 'Edit details');
  await box.findByLabelText('Outer diameter');
  assert.equal(box.getByLabelText('Outer diameter').value, '30');
  type(t, box, 'Inner diameter', '10');
  t.fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await t.waitFor(() => assert.equal(sent.length, 2));
  assert.equal(sent[0].path, '/api/products/1');
  assert.deepEqual(sent[1], { path: '/api/products/1/details', body: { answers: [{ detailId: 51, value: '10' }] } });
});
