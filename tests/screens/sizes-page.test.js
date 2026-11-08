// A product with sizes' page (openspec/changes/product-page-sizes, design 3; st-product-sizes;
// stock control decision 4): sizes across and colours down, each cell its stock and opening
// that size; + Add a size or colour and Edit for the Owner; one history saying each line's
// size and colour. Sizes S, M, L, XL, two colours and size M in [Colour 1] below zero as drawn
// (audit M14); Jack Lewis and Jo Taylor as drawn; numbers only the test needs.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const JO = { ...OWNER, id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false };
const SIZES = ['S', 'M', 'L', 'XL'];
const QTY = { '[Colour 1]': [4, -1, 3, 2], '[Colour 2]': [5, 6, 0, 1] };
let n = 20;
const ITEMS = Object.entries(QTY).flatMap(([colour, qtys]) => qtys.map((q, i) => ({
  kind: 'product', id: n++, name: `[Product with sizes] ${SIZES[i]} ${colour}`, sku: null, barcode: null, category: '[Category]', supplier: null,
  stockQty: q, lowStockThreshold: 1, pricePence: 3000, costPence: 1500, active: true, vatRateBp: 2000, size: SIZES[i], colour,
})));
const GROUP = {
  id: 9, name: '[Product with sizes]', category: '[Category]', description: '', photoUrl: null, sizes: SIZES, colours: ['[Colour 1]', '[Colour 2]'],
  items: ITEMS, vatRateBp: 2000, stockAtShops: [{ id: 7, name: 'North Street Cycles', qty: 20, here: true }],
  history: [{ id: 3, type: 'sale', change: -1, reason: null, note: '', who: 'Jo Taylor', at: '2026-09-01T12:00:00.000Z', size: 'M', colour: '[Colour 1]' }],
};
const realFetch = globalThis.fetch;
let uninstall;
let shell;
let rendered = false;
let sent;
afterEach(async () => {
  if (!rendered) return;
  rendered = false;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

async function open({ me = OWNER } = {}) {
  sent = [];
  globalThis.fetch = async (url, init = {}) => {
    const answer = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return answer(200, me);
    if (u.pathname === '/api/product-categories') return answer(200, { categories: [{ id: 1, name: '[Category]', parentId: null, path: '[Category]', details: [] }] });
    if (u.pathname === '/api/product-groups/9' && init.method === 'PUT') { sent.push(JSON.parse(init.body)); return answer(200, { id: 9 }); }
    if (u.pathname === '/api/product-groups/9') return answer(200, GROUP);
    if (u.pathname.startsWith('/api/')) return answer(200, []);
    return answer(404, { error: 'Not found' });
  };
  uninstall = installDom('http://localhost/workshop/stock/sizes/9');
  rendered = true;
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByRole('heading', { level: 2, name: '[Product with sizes]' });
  return { ...rtl, ui };
}

test('the grid: sizes across, colours down, each cell opening its size; below zero said', async () => {
  const { ui, within } = await open();
  const grid = within(ui.getByRole('table', { name: 'Stock by size and colour' }));
  assert.deepEqual(grid.getAllByRole('columnheader').map((h) => h.textContent), ['Colour', ...SIZES]);
  assert.deepEqual(grid.getAllByRole('rowheader').map((h) => h.textContent), ['[Colour 1]', '[Colour 2]']);
  const m1 = grid.getByRole('link', { name: '[Colour 1], size M: −1, below zero' });
  assert.equal(m1.getAttribute('href'), `/workshop/stock/${ITEMS[1].id}`);
  assert.ok(grid.getByRole('link', { name: '[Colour 2], size L: none in stock' }));
  assert.ok(grid.getByRole('link', { name: '[Colour 1], size S: 4 in stock' }));
});

test('its codes, its total at each shop and its history line naming the size', async () => {
  const { ui, within } = await open();
  assert.ok(ui.getByText('[Category] · 4 sizes · 2 colours'));
  assert.ok(within(ui.getByRole('region', { name: 'In stock' })).getByText('20'));
  const [line] = within(ui.getByRole('list', { name: 'Stock history' })).getAllByRole('listitem');
  assert.match(line.textContent, /^Sold/);
  assert.match(line.textContent, /Size M · \[Colour 1\] · Jo Taylor/);
});

test('+ Add a size or colour sends one new size, its price from the first size', async () => {
  const t = await open();
  t.fireEvent.click(t.ui.getByRole('button', { name: '+ Add a size or colour' }));
  const box = t.within(await t.ui.findByRole('dialog', { name: 'Add a size or colour' }));
  assert.equal(box.getByLabelText('Price').value, '30.00');
  t.fireEvent.change(box.getByLabelText('Size'), { target: { value: 'XXL' } });
  t.fireEvent.change(box.getByLabelText('Colour'), { target: { value: '[Colour 2]' } });
  t.fireEvent.change(box.getByLabelText('Barcode'), { target: { value: '[barcode]' } });
  t.fireEvent.change(box.getByLabelText('Starting stock'), { target: { value: '2' } });
  t.fireEvent.click(box.getByRole('button', { name: 'Add' }));
  await t.waitFor(() => assert.equal(sent.length, 1));
  assert.deepEqual(sent[0], { sizes: [{ size: 'XXL', colour: '[Colour 2]', barcode: '[barcode]', sku: '', pricePence: 3000, stockQty: 2 }] });
});

test('Edit sends its name and category', async () => {
  const t = await open();
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Edit' }));
  const box = t.within(await t.ui.findByRole('dialog', { name: 'Edit product' }));
  t.fireEvent.change(box.getByLabelText('Name'), { target: { value: '[Renamed]' } });
  t.fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await t.waitFor(() => assert.equal(sent.length, 1));
  assert.deepEqual(sent[0], { name: '[Renamed]', category: '[Category]' });
});

test('Jo sees the grid and history, with no Edit and no adding', async () => {
  const { ui } = await open({ me: JO });
  ui.getByRole('table', { name: 'Stock by size and colour' });
  assert.ok(ui.queryByRole('button', { name: 'Edit' }) === null);
  assert.ok(ui.queryByRole('button', { name: '+ Add a size or colour' }) === null);
});
