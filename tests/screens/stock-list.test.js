// Stockroom › Stock and a product's page (openspec/changes/stock-list; drawn as
// st-list, st-product, st-product-staff and st-product-bike in stock.mjs;
// stock control decisions 2, 3 and 11): one search box; All, Running low and
// Below zero; margin for the Owner only; each row opens the product's page,
// with its stock first and its history, and nothing on it changes anything.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const JO = { ...OWNER, id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false };
// Shimano brake pads B05S-RX £28.00 as drawn; the rest of each is a bracketed
// placeholder, or a number only the test needs (stock, cost, levels).
const product = (over) => ({ id: 1, sku: 'B05S-RX', barcode: '[barcode]', name: 'Shimano brake pads', category: '[Category]', price: 28, cost: 14, stockQty: 6, lowStockThreshold: 3, supplier: '[Supplier]', active: true, showOnline: false, description: '', photoUrl: null, vatRateBp: 2000, ...over });
const LIST = [
  product({}),
  product({ id: 2, sku: '[Supplier code 2]', name: '[Product running low]', price: 10, cost: 5, stockQty: 2 }),
  product({ id: 3, sku: '[Supplier code 3]', name: '[Product below zero]', price: 10, cost: 5, stockQty: -1 }),
];
const HISTORY = [
  { id: 13, type: 'till_sale', change: -2, note: 'Till sale B1-[0000]', at: '2026-09-01T14:00:00.000Z' },
  { id: 12, type: 'adjustment', change: -1, note: 'Damaged', at: '2026-09-01T12:00:00.000Z' },
  { id: 11, type: 'po_receipt', change: 6, note: 'Booked in from PO #[n]', at: '2026-09-01T09:00:00.000Z' },
];
const realFetch = globalThis.fetch;
let uninstall;
let shell;
let rendered = false;
let calls;
afterEach(async () => {
  // Nothing rendered: importing RTL now would load react-dom with no DOM.
  if (!rendered) return;
  rendered = false;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

async function open(path, { me = OWNER, page = { ...product({}), history: HISTORY } } = {}) {
  calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push(String(url));
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, me);
    if (u.pathname === '/api/products') {
      const q = (u.searchParams.get('search') ?? '').toLowerCase();
      return reply(200, LIST.filter((p) => !q || `${p.name} ${p.sku} ${p.supplier}`.toLowerCase().includes(q)));
    }
    if (u.pathname === '/api/products/1') return reply(200, { ...page, cost: me.isOwner ? page.cost : null });
    if (u.pathname === '/api/products/404') return reply(404, { error: 'Product not found' });
    if (u.pathname.startsWith('/api/')) return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom(`http://localhost${path}`);
  rendered = true;
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui };
}

test('the list as drawn: search, filters, each product with its stock, price and margin', async () => {
  const { ui, within } = await open('/workshop/stock');
  const pads = await ui.findByRole('link', { name: /Shimano brake pads/ });
  assert.equal(pads.getAttribute('href'), '/workshop/stock/1');
  assert.ok(ui.getByRole('searchbox', { name: 'Search stock' }));
  assert.equal(ui.getByRole('button', { name: 'All' }).getAttribute('aria-pressed'), 'true');
  assert.equal(ui.getByRole('button', { name: 'Running low' }).getAttribute('aria-pressed'), 'false');
  assert.ok(ui.getByText('3 products'));
  for (const h of ['Product', 'In stock', 'Price', 'Margin']) assert.ok(ui.getByRole('columnheader', { name: h }), h);
  const row = within(pads.closest('[role="row"]'));
  assert.ok(row.getByText('B05S-RX · [Category] · [Supplier]'));
  assert.ok(row.getByText('£28.00'));
  // £28.00 is £23.33 before 20% VAT; less £14.00 cost is 40% of it.
  assert.ok(row.getByText('40%'));
  assert.ok(row.getByText('6'));
  const low = within(ui.getByRole('link', { name: /\[Product running low\]/ }).closest('[role="row"]'));
  assert.ok(low.getByText('Running low'));
  const below = within(ui.getByRole('link', { name: /\[Product below zero\]/ }).closest('[role="row"]'));
  assert.ok(below.getByText('Below zero'));
  assert.ok(below.getByText('−1'));
  assert.ok(ui.queryByRole('button', { name: /Add a product/ }) === null, 'adding is a change: not in this piece');
  assert.ok(ui.queryByRole('checkbox') === null, 'tick boxes lead only to changes: not in this piece');
});

test('Staff see no margin on the list (stock decision 11)', async () => {
  const { ui } = await open('/workshop/stock', { me: JO });
  await ui.findByRole('link', { name: /Shimano brake pads/ });
  assert.ok(ui.queryByRole('columnheader', { name: 'Margin' }) === null);
  assert.ok(ui.queryByText('40%') === null);
});

test('Running low and Below zero show only those products', async () => {
  const { ui, fireEvent } = await open('/workshop/stock');
  await ui.findByRole('link', { name: /Shimano brake pads/ });
  fireEvent.click(ui.getByRole('button', { name: 'Below zero' }));
  assert.equal(ui.getByRole('button', { name: 'Below zero' }).getAttribute('aria-pressed'), 'true');
  assert.equal(ui.getByRole('button', { name: 'All' }).getAttribute('aria-pressed'), 'false');
  assert.ok(ui.getByRole('link', { name: /\[Product below zero\]/ }));
  assert.ok(ui.queryByRole('link', { name: /Shimano brake pads/ }) === null);
  assert.ok(ui.queryByRole('link', { name: /\[Product running low\]/ }) === null);
  assert.ok(ui.getByText('1 product'));
  fireEvent.click(ui.getByRole('button', { name: 'Running low' }));
  assert.ok(ui.getByRole('link', { name: /\[Product running low\]/ }));
  assert.ok(ui.queryByRole('link', { name: /\[Product below zero\]/ }) === null);
});

test('searching asks the server, by what was typed', async () => {
  const { ui, fireEvent } = await open('/workshop/stock');
  await ui.findByRole('link', { name: /Shimano brake pads/ });
  fireEvent.change(ui.getByRole('searchbox', { name: 'Search stock' }), { target: { value: 'B05S' } });
  await ui.findByText('1 product');
  assert.ok(calls.some((c) => c.includes('/api/products?search=B05S')), calls.join('\n'));
  assert.ok(ui.queryByRole('link', { name: /\[Product running low\]/ }) === null);
});

test('sorting by In stock puts the lowest first', async () => {
  const { ui, fireEvent } = await open('/workshop/stock');
  await ui.findByRole('link', { name: /Shimano brake pads/ });
  fireEvent.click(ui.getByRole('button', { name: 'In stock' }));
  const names = ui.getAllByRole('link').map((a) => a.textContent).filter((t) => /Shimano|\[Product/.test(t));
  assert.match(names[0], /below zero/);
  assert.match(names[2], /Shimano/);
  assert.equal(ui.getByRole('columnheader', { name: 'In stock' }).getAttribute('aria-sort'), 'ascending');
});

test('a product’s page as drawn for the Owner: stock first, price and cost, history', async () => {
  const { ui, within } = await open('/workshop/stock/1');
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'Shimano brake pads' }));
  assert.equal(ui.getByRole('main').querySelector('a[href="/workshop/stock"]')?.textContent.replace('‹', '').trim(), 'Stock', 'the back link');
  assert.ok(ui.getByText('B05S-RX · [Category] · [Supplier] · barcode [barcode]'));
  const stock = within(ui.getByRole('region', { name: 'In stock' }));
  assert.ok(stock.getByText('6'));
  assert.ok(stock.getByText('Low-stock level'));
  const price = within(ui.getByRole('region', { name: 'Price and cost' }));
  assert.ok(price.getByText('£28.00'));
  assert.ok(price.getByText('£14.00'));
  assert.ok(price.getByText('40%'));
  assert.ok(price.getByText('20%'));
  assert.ok(price.getByText('Show on website'));
  // Newest first: what each was, its note and when, and the change.
  const lines = within(ui.getByRole('region', { name: 'Stock history' })).getAllByRole('listitem').map((li) => li.textContent);
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^Sold.*Till sale B1-\[0000\].*−2$/);
  assert.match(lines[1], /^Adjusted.*Damaged.*−1$/);
  assert.match(lines[2], /^Received.*\+6$/);
  // Adjust stock came with openspec/changes/adjust-stock (tests/screens/adjust-stock.test.js).
  for (const b of ['Edit', 'Send to another shop']) assert.ok(ui.queryByRole('button', { name: b }) === null, `${b} changes things: not in this piece`);
});

test('Staff see Price and VAT, and no cost or margin (st-product-staff)', async () => {
  const { ui, within } = await open('/workshop/stock/1', { me: JO });
  await ui.findByRole('heading', { level: 2, name: 'Shimano brake pads' });
  const price = within(ui.getByRole('region', { name: 'Price' }));
  assert.ok(price.getByText('£28.00'));
  assert.ok(price.queryByText('Cost') === null);
  assert.ok(price.queryByText('Margin') === null);
  assert.ok(ui.queryByText('£14.00') === null);
});

test('the history’s Show: Sold leaves only what was sold', async () => {
  const { ui, within, fireEvent } = await open('/workshop/stock/1');
  await ui.findByRole('heading', { level: 2, name: 'Shimano brake pads' });
  const history = within(ui.getByRole('region', { name: 'Stock history' }));
  assert.equal(history.getByRole('radio', { name: 'Everything' }).getAttribute('aria-checked'), 'true');
  assert.ok(history.queryByRole('radio', { name: 'Price changes' }) === null, 'price changes aren’t recorded yet');
  fireEvent.click(history.getByRole('radio', { name: 'Sold' }));
  assert.ok(history.getByText('−2'));
  assert.ok(history.queryByText('+6') === null);
  assert.ok(history.queryByText('Adjusted') === null);
});

test('a product that isn’t there says so', async () => {
  const { ui } = await open('/workshop/stock/404');
  assert.ok(await ui.findByText('Product not found'));
});
