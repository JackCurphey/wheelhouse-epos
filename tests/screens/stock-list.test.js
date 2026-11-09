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
const product = (over) => ({ id: 1, sku: 'B05S-RX', barcode: '[barcode]', name: 'Shimano brake pads', category: '[Category]', pricePence: 2800, costPence: 1400, stockQty: 6, lowStockThreshold: 3, supplier: '[Supplier]', active: true, showOnline: false, description: '', photoUrl: null, vatRateBp: 2000, ...over });
const LIST = [
  product({}),
  product({ id: 2, sku: '[Supplier code 2]', name: '[Product running low]', pricePence: 1000, costPence: 500, stockQty: 2 }),
  product({ id: 3, sku: '[Supplier code 3]', name: '[Product below zero]', pricePence: 1500, costPence: 500, stockQty: -1 }),
];
// A product with sizes, and a size searched (st-list, st-search-size; stock control decision 4).
const JERSEY = { kind: 'group', groupId: 9, name: '[Product with sizes]', category: '[Category]', sizes: 2, colours: 2, stockQty: 5, sizesBelowZero: 1, sizesRunningLow: 1, priceLowPence: 3000, priceHighPence: 3500, costLowPence: 1000, costHighPence: 1000, active: true, vatRateBp: 2000 };
const GLOVES = { ...JERSEY, groupId: 10, name: '[Gloves]', sizes: 3, colours: 1, stockQty: 4, sizesBelowZero: 0, sizesRunningLow: 2, priceLowPence: 1200, priceHighPence: 1200, costLowPence: 500, costHighPence: 500 };
const SIZE_M = { ...product({ id: 21, sku: '[Supplier code]', barcode: '[barcode]', name: '[Product with sizes]', pricePence: 3500, stockQty: -1 }), kind: 'size', groupId: 9, size: 'M', colour: '[Colour 1]' };
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

async function open(path, { me = OWNER, page = { ...product({}), stockAtShops: [{ id: 7, name: 'North Street Cycles', qty: 6, here: true }], history: HISTORY }, noCosts = false, sized = false, extra = [] } = {}) {
  calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push(String(url));
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, me);
    if (u.pathname === '/api/stock-list') {
      const q = (u.searchParams.get('search') ?? '').toLowerCase();
      if (sized && q === '[product with sizes] m') return reply(200, { rows: [SIZE_M] });
      const rows = [...LIST.map((p) => ({ kind: 'product', ...p })), ...(sized ? [JERSEY, GLOVES] : []), ...extra]
        .filter((p) => !q || `${p.name} ${p.sku} ${p.supplier}`.toLowerCase().includes(q))
        .map((p) => (noCosts ? { ...p, costPence: null, costLowPence: null, costHighPence: null } : p));
      return reply(200, { rows });
    }
    if (u.pathname === '/api/products/1') return reply(200, { ...page, costPence: me.isOwner && !noCosts ? page.costPence : null });
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
  // The Owner adds a product (product-page-sizes, design 4).
  assert.ok(ui.getByRole('button', { name: '+ Add a product' }));
  // The Owner's tick boxes (st-list-ticked; bulk-price-change, design 4).
  assert.ok(ui.getByRole('checkbox', { name: 'Tick all 3 shown' }));
});

test('a product with sizes is one row: its sizes, colours and the size below zero, its total, and its prices lowest to highest', async () => {
  const { ui, within } = await open('/workshop/stock', { sized: true });
  await ui.findByRole('link', { name: /Shimano brake pads/ });
  const jersey = within(ui.getByText('[Product with sizes]').closest('[role="row"]'));
  assert.ok(jersey.getByText('[Category] · 2 sizes · 2 colours · 1 size below zero · 1 size running low'));
  assert.ok(jersey.getByText('5'));
  assert.ok(jersey.getByText('£30.00–£35.00'));
  assert.ok(jersey.queryByText('Below zero') === null, 'the line says which size; no tag on the row');
  // Prices differ, so no one margin.
  assert.ok(jersey.getByText('—'));
  // Its own page (product-page-sizes, design 3).
  assert.equal(jersey.getByRole('link').getAttribute('href'), '/workshop/stock/sizes/9');
  const gloves = within(ui.getByText('[Gloves]').closest('[role="row"]'));
  assert.ok(gloves.getByText('[Category] · 3 sizes · 1 colour · 2 sizes running low'));
  assert.ok(gloves.getByText('£12.00'));
  // £12.00 is £10.00 before 20% VAT; less £5.00 cost is 50% of it.
  assert.ok(gloves.getByText('50%'));
  assert.ok(ui.getByText('5 products'));
});

test('Below zero keeps a product with a size below zero; Running low one with a size running low, even with another below zero', async () => {
  const { ui, fireEvent } = await open('/workshop/stock', { sized: true });
  await ui.findByRole('link', { name: /Shimano brake pads/ });
  fireEvent.click(ui.getByRole('button', { name: 'Below zero' }));
  assert.ok(ui.getByText('[Product with sizes]'));
  assert.ok(ui.queryByText('[Gloves]') === null);
  fireEvent.click(ui.getByRole('button', { name: 'Running low' }));
  assert.ok(ui.getByText('[Gloves]'));
  assert.ok(ui.getByText('[Product with sizes]'));
});

test('a size searched is its own row: its size, colour and barcode, opening that size', async () => {
  const { ui, fireEvent, within } = await open('/workshop/stock', { sized: true });
  await ui.findByRole('link', { name: /Shimano brake pads/ });
  assert.equal(ui.getByRole('searchbox', { name: 'Search stock' }).getAttribute('placeholder'), 'Name, barcode, supplier code — or a measurement, like “bearing 30 mm”');
  fireEvent.change(ui.getByRole('searchbox', { name: 'Search stock' }), { target: { value: '[Product with sizes] M' } });
  const size = await ui.findByRole('link', { name: /Size M · \[Colour 1\] · \[barcode\]/ });
  assert.equal(size.getAttribute('href'), '/workshop/stock/21');
  const row = within(size.closest('[role="row"]'));
  assert.ok(row.getByText('−1'));
  assert.ok(row.getByText('Below zero'));
  assert.ok(ui.getByText('1 size and colour'));
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
  assert.ok(calls.some((c) => c.includes('/api/stock-list?search=B05S')), calls.join('\n'));
  assert.ok(ui.queryByRole('link', { name: /\[Product running low\]/ }) === null);
});

test('sorting by Price goes by the price, lowest first, then highest', async () => {
  const { ui, fireEvent } = await open('/workshop/stock');
  await ui.findByRole('link', { name: /Shimano brake pads/ });
  const order = () => ui.getAllByRole('link').map((a) => a.textContent).filter((t) => /Shimano|\[Product/.test(t));
  fireEvent.click(ui.getByRole('button', { name: 'Price' }));
  assert.match(order()[0], /running low/, '£10.00, ahead of the name order’s [Product below zero]');
  assert.match(order()[1], /below zero/);
  assert.match(order()[2], /Shimano/);
  fireEvent.click(ui.getByRole('button', { name: 'Price' }));
  assert.match(order()[0], /Shimano/);
  assert.match(order()[2], /running low/);
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
  // Edit is the Owner's (product-page-sizes); sending stock is its own piece.
  assert.ok(ui.getByRole('button', { name: 'Edit' }));
  assert.ok(ui.queryByRole('button', { name: 'Send to another shop' }) === null, 'Send to another shop: not built yet');
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

// At the Owner's till with Jo checked in the sign-in still says Owner; what the
// server sends decides (openspec/changes/product-costs-hidden).
test('no costs sent under the Owner’s sign-in: the list has no Margin column', async () => {
  const { ui } = await open('/workshop/stock', { noCosts: true });
  await ui.findByRole('link', { name: /Shimano brake pads/ });
  assert.ok(ui.queryByRole('columnheader', { name: 'Margin' }) === null);
  assert.ok(ui.queryByText('Margin: ') === null);
});

test('no costs sent under the Owner’s sign-in: a product’s page has no Cost or Margin, and no £0.00', async () => {
  const { ui, within } = await open('/workshop/stock/1', { noCosts: true });
  await ui.findByRole('heading', { level: 2, name: 'Shimano brake pads' });
  const price = within(ui.getByRole('region', { name: 'Price' }));
  assert.ok(price.getByText('£28.00'));
  assert.ok(price.queryByText('Cost') === null);
  assert.ok(price.queryByText('Margin') === null);
  assert.ok(ui.queryByText('£0.00') === null);
});

// A bike's page and line (openspec/changes/frame-numbers, design 5; st-product-bike, st-list;
// stock control decision 3). The Trek Domane AL 3 as drawn; frame numbers are placeholders.
const TREK = product({ id: 1, sku: '[Supplier code]', barcode: null, name: 'Trek Domane AL 3', category: 'Bikes', supplier: '[Supplier]', pricePence: 50000, costPence: 30000, stockQty: 2, lowStockThreshold: 0, isBike: true });
const FRAMES = [
  { id: 2, frameNumber: '[frame 2]', state: 'in_stock', bookedInAt: '2026-09-01T10:00:00.000Z', deliveryId: 77, supplierName: '[Supplier]' },
  { id: 1, frameNumber: '[frame 1]', state: 'in_stock', bookedInAt: '2026-09-01T10:00:00.000Z', deliveryId: 77, supplierName: '[Supplier]' },
];
const BIKE_HISTORY = [{ id: 21, type: 'intake', change: 2, note: 'Delivery from [Supplier], not on an order', who: 'Jo Taylor', at: '2026-09-01T10:00:00.000Z', delivery: { id: 77, supplierName: '[Supplier]' }, frames: 2 }];
const bikePage = (over = {}) => ({ ...TREK, stockAtShops: [{ id: 7, name: 'North Street Cycles', qty: 2, here: true }], history: BIKE_HISTORY, frames: FRAMES, ...over });

test('a bike’s page lists each frame number, in stock and booked in from its supplier, and its received line opens the delivery', async () => {
  const { ui, within } = await open('/workshop/stock/1', { page: bikePage() });
  const box = within(await ui.findByRole('region', { name: 'Bikes by frame number' }));
  const rows = box.getAllByRole('listitem').map((li) => li.textContent);
  assert.deepEqual(rows, ['Frame [frame 2]Booked in 1 Sep 2026 from [Supplier]In stock', 'Frame [frame 1]Booked in 1 Sep 2026 from [Supplier]In stock']);
  assert.ok(box.queryByText(/still be listed/) === null, 'no note while the frames and the stock agree');
  const history = within(ui.getByRole('region', { name: 'Stock history' }));
  const received = history.getByRole('link', { name: 'Booked in · delivery from [Supplier]' });
  assert.equal(received.getAttribute('href'), '/workshop/deliveries/delivery/77');
  assert.match(history.getAllByRole('listitem')[0].textContent, /2 frame numbers · Jo Taylor/);
});

test('a bike with none booked in says how frames are recorded', async () => {
  const { ui } = await open('/workshop/stock/1', { page: bikePage({ frames: [], history: [] }) });
  assert.ok(await ui.findByText('No bikes in stock yet. Each bike’s frame number is recorded when it’s booked in.'));
});

test('more frames in stock than bikes says why', async () => {
  const { ui } = await open('/workshop/stock/1', { page: bikePage({ stockQty: 1, stockAtShops: [{ id: 7, name: 'North Street Cycles', qty: 1, here: true }] }) });
  assert.ok(await ui.findByText('The till doesn’t pick a bike’s frame yet, so a bike sold or adjusted may still be listed here.'));
});

test('a part’s received line names its delivery too, and a product that isn’t a bike has no frames box', async () => {
  const { ui, within } = await open('/workshop/stock/1', { page: { ...product({}), stockAtShops: [{ id: 7, name: 'North Street Cycles', qty: 6, here: true }], history: [{ id: 11, type: 'po_receipt', change: 6, note: 'Booked in from PO #[n]', who: 'Jack Lewis', at: '2026-09-01T09:00:00.000Z', delivery: { id: 78, supplierName: '[Supplier]' }, frames: 0 }] } });
  await ui.findByRole('heading', { level: 2, name: 'Shimano brake pads' });
  assert.ok(ui.queryByRole('region', { name: 'Bikes by frame number' }) === null);
  const line = within(ui.getByRole('region', { name: 'Stock history' })).getAllByRole('listitem')[0];
  assert.ok(within(line).getByRole('link', { name: 'Received · delivery from [Supplier]' }));
  assert.match(line.textContent, /Booked in from PO #\[n\] · Jack Lewis/);
});

test('Stock: a bike’s line says how many bikes, each by frame number', async () => {
  const { ui } = await open('/workshop/stock', { extra: [{ kind: 'product', ...TREK, framesInStock: 2 }] });
  const link = await ui.findByRole('link', { name: /Trek Domane AL 3/ });
  assert.match(link.textContent, /Bikes · 2 bikes, each by frame number/);
});
