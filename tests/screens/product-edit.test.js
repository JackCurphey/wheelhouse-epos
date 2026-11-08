// A product's page: its price and cost changes in the history (openspec/changes/product-page-sizes,
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
