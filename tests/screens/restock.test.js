// The restock list and Deliveries and orders' Restock list section (openspec/changes/restock-list;
// rs-restock, rs-restock-customers, rs-hub in receiving.mjs; receiving decision 2, audit M6,
// walk-through 3 M1). Example data from the drawings: Shimano brake pads B05S-RX, job WH-1042 for
// Maya Patel; everything else a bracketed placeholder. Counts are the test's own.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const JO = { ...OWNER, id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false };
const MAYA = { jobId: 42, ref: 'WH-1042', customer: 'Maya Patel', promised: '2026-09-19', qty: 1 };
const PADS = { productId: 11, name: 'Shimano brake pads', sku: 'B05S-RX', barcode: '', stock: 2, sold: 4, low: true, fast: false, suggested: 5, jobs: [MAYA] };
const FAST = { productId: 12, name: '[Product]', sku: '[Supplier code]', barcode: '', stock: 1, sold: 6, low: false, fast: true, suggested: 3, jobs: [] };
const OTHER = { productId: 13, name: '[Product 2]', sku: '[Supplier code 2]', barcode: '', stock: 0, sold: 0, low: true, fast: false, suggested: 2, jobs: [] };
const LIST = {
  days: 28,
  groups: [{ supplier: '[Supplier]', supplierId: 1, lines: [PADS, FAST] }, { supplier: '[Supplier 2]', supplierId: null, lines: [OTHER] }],
  counts: { low: 2, fast: 1, customers: 1 },
  newCount: 0, newForJobs: 0,
};

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

// Each test's first wait follows opening the page: the signed-in check, the page itself and its
// list all load first (the first test also starts everything cold). Testing Library's default 1 s
// ran out on a busy machine (CI on #678, inside test-files-exit, which runs five files at once).
// A passing run still goes on the moment the page shows.
const OPENED = { timeout: 5000 };

async function open(path, { me = OWNER, list = LIST } = {}) {
  calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: String(url), method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b, headers: new Map() });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, me);
    if (u.pathname === '/api/restock') return me.isOwner ? reply(200, list) : reply(403, { error: "Only the shop's owner can order stock" });
    if (u.pathname === '/api/restock/seen') return reply(200, { ok: true });
    if (u.pathname === '/api/restock/add-to-order') return reply(200, { orderId: 9 });
    if (u.pathname === '/api/restock/download') {
      return { status: 200, ok: true, headers: { get: (h) => (h === 'content-disposition' ? 'attachment; filename="restock-supplier-2026-09-01.csv"' : 'text/csv') }, blob: async () => new Blob(['x']) };
    }
    if (u.pathname === '/api/purchase-orders/9') {
      return reply(200, { id: 9, supplierId: 1, supplierName: '[Supplier]', status: 'draft', orderedAt: null, items: [{ id: 1, productId: 11, name: 'Shimano brake pads', sku: 'B05S-RX', qtyOrdered: 1, qtyReceived: 0, outstanding: 1, notComing: 0, forJob: { id: 42, ref: 'WH-1042' } }] });
    }
    if (u.pathname.startsWith('/api/')) return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom(`http://localhost${path}`);
  window.URL.createObjectURL = () => 'blob:restock';
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function click() { calls.push({ url: this.href, method: 'SAVE', body: this.download }); };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  rendered = true;
  const ui = rtl.render(createElement(shell.AppShell));
  // `screen` is bound to the first test's page; each test queries its own (ui).
  return { ...rtl, ui, screen: ui };
}
const posts = (end) => calls.filter((c) => c.method === 'POST' && c.url.endsWith(end));

test('the list: a group per supplier, its columns, every line ticked, and opening marks it seen', async () => {
  const { screen, waitFor, within } = await open('/workshop/deliveries/restock');
  const first = await screen.findByRole('region', { name: '[Supplier]' }, OPENED);
  assert.ok(screen.getByRole('heading', { name: 'Tick what to reorder' }));
  assert.ok(within(first).getByText('Shimano brake pads'));
  assert.ok(within(first).getByText(/B05S-RX · for job WH-1042/));
  assert.ok(within(first).getAllByText('2 · low').length > 0);
  assert.ok(within(first).getAllByText('6 · fast').length > 0);
  assert.equal(within(first).getByRole('checkbox', { name: 'Include Shimano brake pads' }).checked, true);
  assert.equal(within(first).getByRole('checkbox', { name: 'Include everything from [Supplier]' }).checked, true);
  assert.ok(within(first).getByText('2 ticked'));
  // On All, the pads' count is the stock suggestion plus the job's shortfall.
  assert.equal(within(first).getByRole('textbox', { name: 'How many: Reorder Shimano brake pads' }).value, '6');
  assert.ok(screen.getAllByText(/Sold, last 28 days/).length > 0);
  await waitFor(() => assert.equal(posts('/api/restock/seen').length, 1));
});

test('the pills, and ?show= picking one', async () => {
  const { screen, fireEvent, within } = await open('/workshop/deliveries/restock?show=fast');
  await screen.findByRole('region', { name: '[Supplier]' }, OPENED);
  assert.ok(screen.getByText('[Product]'));
  assert.ok(screen.queryByText('Shimano brake pads') === null, 'running low only: not on Selling fast');
  assert.ok(screen.queryByRole('region', { name: '[Supplier 2]' }) === null, 'a group with nothing shown goes');
  fireEvent.click(screen.getByRole('radio', { name: 'For customers' }));
  const g = screen.getByRole('region', { name: '[Supplier]' });
  assert.ok(within(g).getByText(/for job WH-1042 · Maya Patel · promised Sat 19 Sep/));
  assert.equal(within(g).getByRole('textbox', { name: 'How many: Reorder Shimano brake pads' }).value, '1');
  assert.ok(screen.getByText(/keeps who each line is for on the order line/));
});

test('unticking: the group’s count follows, and the group tick unticks them all', async () => {
  const { screen, fireEvent, within } = await open('/workshop/deliveries/restock');
  const g = await screen.findByRole('region', { name: '[Supplier]' }, OPENED);
  fireEvent.click(within(g).getByRole('checkbox', { name: 'Include [Product]' }));
  assert.ok(within(g).getByText('1 ticked'));
  assert.equal(within(g).getByRole('checkbox', { name: 'Include everything from [Supplier]' }).checked, false);
  fireEvent.click(within(g).getByRole('checkbox', { name: 'Include everything from [Supplier]' }));
  assert.ok(within(g).getByText('2 ticked'));
  fireEvent.click(within(g).getByRole('checkbox', { name: 'Include everything from [Supplier]' }));
  assert.ok(within(g).getByText('0 ticked'));
});

test('the count never goes below 1', async () => {
  const { screen, fireEvent, within } = await open('/workshop/deliveries/restock?show=customers');
  const g = await screen.findByRole('region', { name: '[Supplier]' }, OPENED);
  fireEvent.click(within(g).getByRole('button', { name: 'One fewer: Reorder Shimano brake pads' }));
  assert.equal(within(g).getByRole('textbox', { name: 'How many: Reorder Shimano brake pads' }).value, '1');
});

test('Download sends only the ticked lines, at their counts, and saves the file', async () => {
  const { screen, fireEvent, within, waitFor } = await open('/workshop/deliveries/restock');
  const g = await screen.findByRole('region', { name: '[Supplier]' }, OPENED);
  fireEvent.click(within(g).getByRole('checkbox', { name: 'Include [Product]' }));
  fireEvent.click(within(g).getByRole('button', { name: 'One more: Reorder Shimano brake pads' }));
  fireEvent.click(within(g).getByRole('button', { name: 'Download for [Supplier]’s basket' }));
  await waitFor(() => assert.equal(posts('/api/restock/download').length, 1));
  assert.deepEqual(posts('/api/restock/download')[0].body, { supplier: '[Supplier]', lines: [{ productId: 11, qty: 7 }] });
  await waitFor(() => assert.ok(calls.some((c) => c.method === 'SAVE' && c.body === 'restock-supplier-2026-09-01.csv')));
});

test('Add to an order sends a job’s line with its job, the rest plain, and opens the order', async () => {
  const { screen, fireEvent, within, waitFor } = await open('/workshop/deliveries/restock');
  const g = await screen.findByRole('region', { name: '[Supplier]' }, OPENED);
  fireEvent.click(within(g).getByRole('button', { name: 'Add to an order' }));
  await waitFor(() => assert.equal(posts('/api/restock/add-to-order').length, 1));
  assert.deepEqual(posts('/api/restock/add-to-order')[0].body, {
    supplierId: 1,
    lines: [{ productId: 11, qty: 1, forJobId: 42 }, { productId: 11, qty: 5 }, { productId: 12, qty: 3 }],
  });
  assert.ok(await screen.findByText(/for job WH-1042/), 'the order opens with the line’s job');
  assert.equal(window.location.pathname, '/workshop/deliveries/orders/9');
});

test('a supplier not in the suppliers list: no Add to an order, said why, still downloadable', async () => {
  const { screen, within } = await open('/workshop/deliveries/restock');
  const g = await screen.findByRole('region', { name: '[Supplier 2]' }, OPENED);
  assert.ok(within(g).queryByRole('button', { name: 'Add to an order' }) === null);
  assert.ok(within(g).getByText('[Supplier 2] isn’t in your suppliers yet'));
  assert.ok(within(g).getByRole('button', { name: 'Download for [Supplier 2]’s basket' }));
});

test('nothing to reorder', async () => {
  const { screen } = await open('/workshop/deliveries/restock', { list: { ...LIST, groups: [], counts: { low: 0, fast: 0, customers: 0 } } });
  assert.ok(await screen.findByText('Nothing to reorder.', {}, OPENED));
});

test('Jo is told it’s the owner’s', async () => {
  const { screen } = await open('/workshop/deliveries/restock', { me: JO });
  assert.ok(await screen.findByText('The restock list is for the shop’s owner for now.', {}, OPENED));
  assert.equal(calls.filter((c) => c.url.includes('/api/restock')).length, 0);
});

test('Deliveries and orders: the Restock list section, its counts and links', async () => {
  const { screen, within } = await open('/workshop/deliveries');
  const card = await screen.findByRole('region', { name: 'Restock list' }, OPENED);
  await within(card).findByText('2 products at or under their low-stock level');
  assert.ok(within(card).getByText('1 product sold more than usual in the last 28 days'));
  assert.ok(within(card).getByText('1 product a job is waiting for, or an online order is ordering in'));
  const links = within(card).getAllByRole('link').map((a) => [a.getAttribute('aria-label'), a.getAttribute('href')]);
  assert.deepEqual(links, [
    ['See the list of products running low', '/workshop/deliveries/restock?show=low'],
    ['See the list of products selling fast', '/workshop/deliveries/restock?show=fast'],
    ['See the list of products for customers', '/workshop/deliveries/restock?show=customers'],
  ]);
  const order = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
  assert.ok(order.indexOf('Restock list') < order.indexOf('Orders'), 'before Orders');
});

test('Jo’s Deliveries and orders has no Restock list', async () => {
  const { screen } = await open('/workshop/deliveries', { me: JO });
  await screen.findByRole('heading', { name: 'A delivery arrived?' }, OPENED);
  assert.ok(screen.queryByRole('region', { name: 'Restock list' }) === null);
});

test('a refused download shows the server’s words', async () => {
  const { screen, fireEvent, within } = await open('/workshop/deliveries/restock');
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => (String(url).endsWith('/api/restock/download')
    ? { status: 400, ok: false, headers: { get: () => null }, json: async () => ({ error: 'Product 11 not found' }) }
    : real(url, init));
  const g = await screen.findByRole('region', { name: '[Supplier]' }, OPENED);
  fireEvent.click(within(g).getByRole('button', { name: 'Download for [Supplier]’s basket' }));
  assert.equal((await within(g).findByRole('alert')).textContent, 'Product 11 not found');
});
