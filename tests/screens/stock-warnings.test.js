// Today's stock warnings, the screens (openspec/changes/stock-warnings-on-today;
// drawn as st-today-adjust, st-today-below and st-setting-adjust in stock.mjs,
// opening.mjs `today` and settings-frame.mjs `stockFolds`; stock control
// decisions 6, 9 and 11): Settings › Stockroom › Stock adjustments, a big
// adjustment on Today cleared by Seen, and products below zero with See them
// and Count them.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const JACK = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const JO = { ...JACK, id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false };
// Shimano brake pads, as drawn; the numbers are the test's own.
const ADJUSTED = { kind: 'stock_adjusted', movementId: 31, productId: 12, productName: 'Shimano brake pads', change: -2, valuePence: 2800, reason: 'damaged', note: '', byName: 'Jo Taylor', at: new Date().toISOString() };
const BELOW = { kind: 'below_zero', count: 2, takeId: null };
const product = (over) => ({ id: 1, sku: 'B05S-RX', barcode: '[barcode]', name: 'Shimano brake pads', category: '[Category]', price: 28, cost: 14, stockQty: 6, lowStockThreshold: 3, supplier: '[Supplier]', active: true, showOnline: false, description: '', photoUrl: null, vatRateBp: 2000, ...over });

const realFetch = globalThis.fetch;
let current;
let calls;
let server;
afterEach(async () => {
  if (!current) return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current?.shell.queryClient.clear();
  current?.uninstall();
  globalThis.fetch = realFetch;
  current = undefined;
});

// `next`: what Needs attention says from its second read on (a count finished
// meanwhile); `seenStatus`: 409 when Seen was pressed already in another tab.
async function open(path, { me = JACK, items = [ADJUSTED, BELOW], over = null, startStatus = 201, next = null, seenStatus = 200 } = {}) {
  calls = [];
  server = { items, over, next };
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, me);
    if (u.pathname === '/api/stockroom-settings' && method === 'PUT') { server.over = body.adjustTodayOverPence; return reply(200, { adjustTodayOverPence: server.over }); }
    if (u.pathname === '/api/stockroom-settings') return reply(200, { adjustTodayOverPence: server.over });
    if (u.pathname === '/api/stock-adjustments/31/seen') {
      server.items = server.items.filter((i) => i.kind !== 'stock_adjusted');
      return seenStatus === 200 ? reply(200, { ok: true }) : reply(seenStatus, { error: 'That adjustment isn’t waiting to be seen.', code: 'not_to_see' });
    }
    if (u.pathname === '/api/needs-attention' && server.next) { const first = server.items; server.items = server.next; server.next = null; return reply(200, { items: first }); }
    if (u.pathname === '/api/stock-takes' && method === 'POST') return startStatus === 201 ? reply(201, { id: 77, kind: 'below_zero' }) : reply(startStatus, { error: 'Nothing is below zero' });
    if (u.pathname === '/api/needs-attention') return me.isOwner ? reply(200, { items: server.items }) : reply(403, { error: 'no', code: 'owner_only' });
    if (u.pathname === '/api/products') return reply(200, [product({}), product({ id: 3, sku: '[Supplier code 3]', name: '[Product below zero]', stockQty: -1 })]);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/shop-details') return reply(200, { name: 'North Street Cycles' });
    if (u.pathname === '/api/workshop-jobs') return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  const uninstall = installDom(`http://localhost${path}`);
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  const shell = await importFresh(SHELL);
  current = { shell, uninstall };
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui };
}
const row = async (t, text) => (await t.ui.findByText(text)).closest('li');

test('Settings › Stockroom › Stock adjustments: the amount, at cost, saved in whole pence when the box is left', async () => {
  const t = await open('/workshop/settings?room=stockroom');
  await t.ui.findByRole('heading', { level: 2, name: 'Stockroom' });
  // The room sits after Workshop and before Office, as drawn.
  const rooms = t.within(t.ui.getByRole('navigation', { name: 'Settings' })).getAllByRole('link').map((a) => a.textContent);
  assert.deepEqual(rooms.slice(rooms.indexOf('Workshop'), rooms.indexOf('Office') + 1), ['Workshop', 'Stockroom', 'Office']);
  const fold = await t.ui.findByRole('button', { name: /^Stock adjustments/ });
  await t.waitFor(() => assert.match(fold.textContent, /Not set yet/));
  assert.equal(fold.getAttribute('aria-expanded'), 'true');
  const box = await t.ui.findByLabelText(/Show on Today when an adjustment is worth more than/);
  assert.ok(t.ui.queryByText('At cost · for owners and managers'));
  assert.ok(t.ui.queryByText('Every adjustment is in its product’s stock history, whatever its value.'));
  t.fireEvent.change(box, { target: { value: '12.345' } });
  t.fireEvent.blur(box);
  assert.ok(await t.ui.findByText('Pounds and pence, like 50.00'));
  t.fireEvent.change(box, { target: { value: '£50' } });
  t.fireEvent.blur(box);
  await t.waitFor(() => assert.deepEqual(calls.filter((c) => c.method === 'PUT').map((c) => c.body), [{ adjustTodayOverPence: 5000 }]));
  assert.ok(await t.ui.findByText('Saved.'));
  await t.waitFor(() => assert.match(fold.textContent, /Show on Today over £50\.00/));
});

test('Today: a big adjustment, with its product, value, reason and who, cleared by Seen', async () => {
  const t = await open('/workshop/today');
  const line = await row(t, /^Stock adjusted:/);
  assert.match(line.textContent, /Stock adjusted: Shimano brake pads −2 · £28\.00/);
  assert.equal(t.within(line).getByRole('link', { name: 'Shimano brake pads' }).getAttribute('href'), '/workshop/stock/12');
  assert.match(line.textContent, /Damaged · by Jo Taylor at \d\d:\d\d/);
  t.fireEvent.click(t.within(line).getByRole('button', { name: 'Seen' }));
  await t.waitFor(() => assert.ok(calls.some((c) => c.method === 'POST' && c.url === '/api/stock-adjustments/31/seen')));
  await t.waitFor(() => assert.ok(t.ui.queryByText(/^Stock adjusted:/) === null));
});

test('Today: going up shows a plus; a note follows the reason; an earlier day gives its day', async () => {
  const t = await open('/workshop/today', { items: [{ ...ADJUSTED, change: 4, reason: 'other', note: '[note]', at: '2026-09-01T09:15:00Z' }] });
  const line = await row(t, /^Stock adjusted:/);
  assert.match(line.textContent, /Shimano brake pads \+4 · £28\.00/);
  assert.match(line.textContent, /Other · “\[note\]” · by Jo Taylor at Tue 1 Sept?, \d\d:15/);
});

test('Today: products below zero, with See them and Count them, which starts a count of them', async () => {
  const t = await open('/workshop/today', { items: [BELOW] });
  const line = await row(t, '2 products below zero');
  assert.match(line.textContent, /Sold more than Wheelhouse thought were here · Count them starts a count straight away/);
  assert.equal(t.within(line).getByRole('link', { name: 'See them' }).getAttribute('href'), '/workshop/stock?show=below-zero');
  t.fireEvent.click(t.within(line).getByRole('button', { name: 'Count them' }));
  await t.waitFor(() => assert.deepEqual(calls.filter((c) => c.method === 'POST').map((c) => [c.url, c.body]), [['/api/stock-takes', { kind: 'below_zero' }]]));
  await t.waitFor(() => assert.equal(window.location.pathname, '/workshop/stocktake/77'));
});

test('Today: Count them opens the below-zero count already counting, and one product reads in the singular', async () => {
  const t = await open('/workshop/today', { items: [{ ...BELOW, count: 1, takeId: 5 }] });
  const line = await row(t, '1 product below zero');
  t.fireEvent.click(t.within(line).getByRole('button', { name: 'Count them' }));
  await t.waitFor(() => assert.equal(window.location.pathname, '/workshop/stocktake/5'));
  // The counting page joins the count it opens; no second count is started.
  assert.deepEqual(calls.filter((c) => c.method === 'POST' && c.url === '/api/stock-takes'), [], 'no second count started');
});

// Review, 29 Oct: Today is read again before Count them opens a count, so a
// count finished since the page loaded isn't reopened; a new one starts.
test('Today: Count them starts a new count when the remembered one has finished', async () => {
  const t = await open('/workshop/today', { items: [{ ...BELOW, takeId: 5 }], next: [{ ...BELOW, takeId: null }] });
  const line = await row(t, '2 products below zero');
  t.fireEvent.click(t.within(line).getByRole('button', { name: 'Count them' }));
  await t.waitFor(() => assert.equal(window.location.pathname, '/workshop/stocktake/77'));
  assert.deepEqual(calls.filter((c) => c.method === 'POST' && c.url === '/api/stock-takes').map((c) => c.body), [{ kind: 'below_zero' }]);
});

// Review, 29 Oct: Seen pressed already in another tab is done, not a failure.
test('Today: Seen already pressed elsewhere drops the line quietly', async () => {
  const t = await open('/workshop/today', { items: [ADJUSTED], seenStatus: 409 });
  const line = await row(t, /^Stock adjusted:/);
  t.fireEvent.click(t.within(line).getByRole('button', { name: 'Seen' }));
  await t.waitFor(() => assert.ok(t.ui.queryByText(/^Stock adjusted:/) === null));
  assert.ok(t.ui.queryByText('Wheelhouse couldn’t record that. Try again in a moment.') === null);
  // Nothing alarming in Needs attention (the fake server has no tills, so Tills says so).
  assert.ok(t.within(t.ui.getByRole('region', { name: /^Needs attention/ })).queryByRole('alert') === null);
});

// Review, 29 Oct: emptying the box clears the amount.
test('Settings › Stockroom: an emptied box clears the amount, back to Not set yet', async () => {
  const t = await open('/workshop/settings?room=stockroom', { over: 5000 });
  const fold = await t.ui.findByRole('button', { name: /^Stock adjustments/ });
  await t.waitFor(() => assert.match(fold.textContent, /Show on Today over £50\.00/));
  const box = await t.ui.findByLabelText(/Show on Today when an adjustment is worth more than/);
  t.fireEvent.change(box, { target: { value: '  ' } });
  t.fireEvent.blur(box);
  await t.waitFor(() => assert.deepEqual(calls.filter((c) => c.method === 'PUT').map((c) => c.body), [{ adjustTodayOverPence: null }]));
  await t.waitFor(() => assert.match(fold.textContent, /Not set yet/));
  assert.ok(t.ui.queryByText('Pounds and pence, like 50.00') === null);
  assert.equal(box.value, '');
});

test('Today: a count the server refuses says why', async () => {
  const t = await open('/workshop/today', { items: [BELOW], startStatus: 400 });
  const line = await row(t, '2 products below zero');
  t.fireEvent.click(t.within(line).getByRole('button', { name: 'Count them' }));
  assert.ok(await t.ui.findByText('Nothing is below zero'));
  assert.equal(window.location.pathname, '/workshop/today');
});

test('Staff see neither line', async () => {
  const t = await open('/workshop/today', { me: JO });
  await t.ui.findByRole('heading', { name: 'Workshop today' });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(t.ui.queryByText(/below zero|Stock adjusted/) === null);
});

test('Stock opened from See them has Below zero picked and lists only those', async () => {
  const t = await open('/workshop/stock?show=below-zero');
  await t.ui.findByText('[Product below zero]');
  assert.equal(t.ui.getByRole('button', { name: 'Below zero' }).getAttribute('aria-pressed'), 'true');
  assert.ok(t.ui.queryByText('Shimano brake pads') === null);
});
