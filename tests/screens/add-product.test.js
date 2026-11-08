// Adding a product on Stock (openspec/changes/product-page-sizes, design 4; st-list draws
// "+ Add a product" beside the search for the Owner, not on a phone; st-list-none "+ Add
// “[what was typed]” as a product"; st-list-new "+ Add a product" and "Bring them from Citrus
// Lime"). Added, its page opens. Jack Lewis and Jo Taylor as drawn; the rest bracketed.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const JO = { ...OWNER, id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false };
const PADS = { kind: 'product', id: 1, sku: 'B05S-RX', barcode: null, name: 'Shimano brake pads', category: '[Category]', pricePence: 2800, costPence: 1400, stockQty: 6, lowStockThreshold: 3, supplier: '[Supplier]', active: true, vatRateBp: 2000 };
const realFetch = globalThis.fetch;
let uninstall;
let shell;
let rendered = false;
let posts;
afterEach(async () => {
  if (!rendered) return;
  rendered = false;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

async function open({ me = OWNER, rows = [PADS] } = {}) {
  posts = [];
  globalThis.fetch = async (url, init = {}) => {
    const answer = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return answer(200, me);
    if (u.pathname === '/api/stock-list') return answer(200, { rows: u.searchParams.get('search') ? [] : rows });
    if (u.pathname === '/api/product-categories') return answer(200, { categories: [] });
    if (u.pathname === '/api/products' && init.method === 'POST') {
      const body = JSON.parse(init.body);
      posts.push(body);
      return answer(201, { ...PADS, id: 42, name: body.name, pricePence: body.pricePence, details: [] });
    }
    if (u.pathname === '/api/products/42') return answer(200, { ...PADS, id: 42, name: posts[0]?.name ?? '[Product]', stockAtShops: [], history: [], details: [] });
    if (u.pathname.startsWith('/api/')) return answer(200, []);
    return answer(404, { error: 'Not found' });
  };
  uninstall = installDom('http://localhost/workshop/stock');
  rendered = true;
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui };
}

test('+ Add a product opens the box; added, its page opens', async () => {
  const t = await open();
  t.fireEvent.click(await t.ui.findByRole('button', { name: '+ Add a product' }));
  const box = t.within(await t.ui.findByRole('dialog', { name: 'Add a product' }));
  t.fireEvent.change(box.getByLabelText('Name'), { target: { value: '[Product]' } });
  t.fireEvent.change(box.getByLabelText('Price'), { target: { value: '12.50' } });
  t.fireEvent.click(box.getByRole('button', { name: 'Add' }));
  await t.waitFor(() => assert.equal(posts.length, 1));
  assert.equal(posts[0].pricePence, 1250);
  await t.ui.findByRole('heading', { level: 2, name: '[Product]' });
  assert.equal(window.location.pathname, '/workshop/stock/42');
});

test('staff get no + Add a product', async () => {
  const t = await open({ me: JO });
  await t.ui.findByText('Shimano brake pads');
  assert.ok(t.ui.queryByRole('button', { name: '+ Add a product' }) === null);
});

test('nothing matches: + Add “[what was typed]” as a product fills the name', async () => {
  const t = await open();
  await t.ui.findByText('Shimano brake pads');
  t.fireEvent.change(t.ui.getByRole('searchbox', { name: 'Search stock' }), { target: { value: '[what was typed]' } });
  t.fireEvent.click(await t.ui.findByRole('button', { name: '+ Add “[what was typed]” as a product' }, { timeout: 3000 }));
  const box = t.within(await t.ui.findByRole('dialog', { name: 'Add a product' }));
  assert.equal(box.getByLabelText('Name').value, '[what was typed]');
});

test('a new shop: + Add a product and Bring them from Citrus Lime', async () => {
  const t = await open({ rows: [] });
  const empty = await t.ui.findByRole('heading', { name: 'No products yet' });
  const card = t.within(empty.parentElement);
  assert.ok(card.getByText('Add your first product, or bring everything over from Citrus Lime (Office › Moving from Citrus Lime).'));
  assert.ok(card.getByRole('button', { name: '+ Add a product' }));
  assert.ok(card.getByRole('link', { name: 'Bring them from Citrus Lime' }));
});
