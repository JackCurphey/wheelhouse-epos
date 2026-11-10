// A bike's brand and warranty on its product page (openspec/changes/finish-customers, design 6;
// questions 17 and 18). Not drawn on st-product: a box of its own, in the page's Box and kv
// pattern (logged). The Trek Domane AL 3, Trek and Cube, Jack Lewis and Jo Taylor as named.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const JO = { ...OWNER, id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false };
const TREKS = { own: false, brand: 'Trek', lines: [{ part: 'frame', years: null }, { part: 'components', years: 2 }] };
const BIKE = { id: 1, sku: '[Supplier code]', barcode: null, name: 'Trek Domane AL 3', category: 'Bikes', pricePence: 100000, costPence: 60000, stockQty: 1, lowStockThreshold: 0, supplier: '[Supplier]', active: true, showOnline: false, description: '', photoUrl: null, vatRateBp: 2000, details: [], isBike: true, isEbike: false, brand: 'Trek', frames: [], warranty: TREKS };
const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
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

async function open({ me = OWNER, product = {} } = {}) {
  let page = { ...BIKE, stockAtShops: [{ id: 7, name: 'North Street Cycles', qty: 1, here: true }], history: [], ...product };
  calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const answer = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return answer(200, me);
    if (u.pathname === '/api/products/1' && method === 'GET') return answer(200, page);
    if (u.pathname === '/api/products/1' && method === 'PUT') { page = { ...page, ...body }; return answer(200, page); }
    if (u.pathname === '/api/products/1/warranty') {
      page = { ...page, warranty: body.lines ? { own: true, brand: 'Trek', lines: body.lines } : TREKS };
      return answer(200, { warranty: page.warranty });
    }
    if (u.pathname === '/api/bike-warranties') return answer(200, { brands: [{ id: 2, brand: 'Cube', lines: [] }, { id: 1, brand: 'Trek', lines: TREKS.lines }] });
    if (u.pathname === '/api/product-categories') return answer(200, { categories: [{ id: 1, name: 'Bikes', parentId: null, path: 'Bikes', products: 1, details: [], bikeKind: 'bikes' }] });
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
  await ui.findByRole('heading', { level: 2, name: 'Trek Domane AL 3' });
  return { ...rtl, ui };
}
const box = (t) => t.within(t.ui.getByRole('region', { name: 'Brand and warranty' }));
const writes = () => calls.filter((c) => c.method !== 'GET').map((c) => [c.method, c.url, c.body]);

test('a bike’s page: Brand Trek, E-bike from its category, and the warranty it gets from Trek’s lines', async () => {
  const t = await open();
  const b = box(t);
  assert.ok(b.getByText('Brand'));
  assert.ok(b.getByText('Trek'));
  assert.ok(b.getByText('E-bike'));
  assert.ok(b.getByText('No'));
  assert.ok(b.getByText('Warranty: Frame lifetime · Components 2 years'));
  assert.ok(b.getByRole('button', { name: 'Give this model its own lines' }));
});

test('a model’s own lines say so, and go back to its brand’s', async () => {
  const t = await open({ product: { warranty: { own: true, brand: 'Trek', lines: [{ part: 'frame', years: null }] } } });
  assert.ok(box(t).getByText('Warranty (this model’s own): Frame lifetime'));
  t.fireEvent.click(box(t).getByRole('button', { name: 'Use Trek’s lines' }));
  await t.waitFor(() => assert.deepEqual(writes(), [['PUT', '/api/products/1/warranty', { lines: null }]]));
  assert.ok(await box(t).findByText('Warranty: Frame lifetime · Components 2 years'));
});

test('the Owner gives this model its own lines, starting at Trek’s', async () => {
  const t = await open();
  t.fireEvent.click(box(t).getByRole('button', { name: 'Give this model its own lines' }));
  const dlg = t.within(await t.ui.findByRole('dialog', { name: 'Trek Domane AL 3’s own lines' }));
  assert.equal(t.within(dlg.getByRole('radiogroup', { name: 'Frame' })).getByRole('radio', { name: 'Lifetime' }).getAttribute('aria-checked'), 'true');
  assert.equal(dlg.getByLabelText('Components, years').value, '2');
  t.fireEvent.change(dlg.getByLabelText('Components, years'), { target: { value: '3' } });
  t.fireEvent.click(dlg.getByRole('button', { name: 'Save' }));
  await t.waitFor(() => assert.deepEqual(writes(), [['PUT', '/api/products/1/warranty', { lines: [{ part: 'frame', years: null }, { part: 'components', years: 3 }] }]]));
  assert.ok(await box(t).findByText('Warranty (this model’s own): Frame lifetime · Components 3 years'));
});

test('a brand not in Bike warranties: the brand and no warranty; an e-bike says Yes', async () => {
  const t = await open({ product: { brand: '[Brand not listed]', warranty: null, isEbike: true } });
  assert.ok(box(t).getByText('[Brand not listed]'));
  assert.ok(box(t).getByText('Yes'));
  assert.ok(box(t).queryByText(/^Warranty/) === null);
});

test('Jo sees the brand and warranty and can’t change the lines', async () => {
  const t = await open({ me: JO, product: { costPence: null } });
  assert.ok(box(t).getByText('Warranty: Frame lifetime · Components 2 years'));
  assert.ok(box(t).queryByRole('button') === null);
});

test('Edit’s Brand starts at the product’s, offers Bike warranties’ brands, and saves', async () => {
  const t = await open();
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Edit' }));
  const dlg = t.within(await t.ui.findByRole('dialog'));
  const brand = dlg.getByLabelText('Brand');
  assert.equal(brand.value, 'Trek');
  const list = t.ui.container.ownerDocument.getElementById(brand.getAttribute('list'));
  await t.waitFor(() => assert.deepEqual([...list.querySelectorAll('option')].map((o) => o.value), ['Cube', 'Trek']));
  t.fireEvent.change(brand, { target: { value: 'Cube' } });
  t.fireEvent.click(dlg.getByRole('button', { name: /^Save/ }));
  await t.waitFor(() => assert.equal(writes().filter((w) => w[1] === '/api/products/1').length, 1));
  assert.equal(writes().find((w) => w[1] === '/api/products/1')[2].brand, 'Cube');
});
