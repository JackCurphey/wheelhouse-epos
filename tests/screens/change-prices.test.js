// Ticking on Stock and Change prices (openspec/changes/bulk-price-change, design 4 and 5;
// st-list-ticked, st-prices, st-prices-done; stock control decisions 7, 11 and 12): tick boxes
// and Tick all for the Owner, the ticked bar, the preview with Now, New and Margin, Change, and
// Undo. Shimano brake pads B05S-RX £28.00 as drawn; the rest are bracketed placeholders.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const JO = { ...OWNER, id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false };
const row = (over) => ({ kind: 'product', id: 1, sku: 'B05S-RX', barcode: null, name: 'Shimano brake pads', category: '[Category]', pricePence: 2800, costPence: 1250, stockQty: 6, lowStockThreshold: 0, supplier: '[Supplier]', active: true, vatRateBp: 2000, ...over });
const LIST = [
  row({}),
  row({ id: 2, sku: '[Supplier code 2]', name: '[Product 2]', pricePence: 1500 }),
  row({ id: 3, sku: '[Supplier code 3]', name: '[Product 3]', pricePence: 1000, supplier: '[Supplier 2]' }),
];
// The preview as the server works it out: +10%, ending .99; [Product 2] under its cost.
const PREVIEW = [
  { id: 1, name: 'Shimano brake pads', sku: 'B05S-RX', size: null, colour: null, nowPence: 2800, newPence: 3099, costPence: 1250, vatRateBp: 2000, belowCost: false, noCost: false },
  { id: 2, name: '[Product 2]', sku: '[Supplier code 2]', size: null, colour: null, nowPence: 1500, newPence: 1499, costPence: 1300, vatRateBp: 2000, belowCost: true, noCost: false },
];
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

async function open({ me = OWNER, preview = PREVIEW, undo = { undone: 2, leftAlone: 0 }, phone = false } = {}) {
  sent = [];
  globalThis.fetch = async (url, init = {}) => {
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    const body = init.body ? JSON.parse(init.body) : null;
    if (init.method === 'POST') sent.push({ path: u.pathname, body });
    if (u.pathname === '/api/auth/me') return reply(200, me);
    if (u.pathname === '/api/stock-list') {
      const q = (u.searchParams.get('search') ?? '').toLowerCase();
      return reply(200, { rows: LIST.filter((p) => !q || `${p.name} ${p.supplier}`.toLowerCase().includes(q)) });
    }
    if (u.pathname === '/api/stock/prices/preview') {
      if (body.how === 'percent' && body.value === 0) return reply(200, { products: preview.map((p) => ({ ...p, newPence: p.nowPence, belowCost: false })) });
      if (body.how === 'each') return reply(200, { products: preview.map((p) => ({ ...p, newPence: body.prices[p.id] ?? p.nowPence })) });
      return reply(200, { products: preview });
    }
    if (u.pathname === '/api/stock/prices') return reply(200, { batchId: 41, changed: 2 });
    if (u.pathname === '/api/stock/prices/41/undo') return reply(200, undo);
    if (u.pathname.startsWith('/api/')) return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom('http://localhost/workshop/stock');
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  if (phone) window.matchMedia = (q) => ({ matches: q.includes('max-width'), media: q, addEventListener() {}, removeEventListener() {} });
  rendered = true;
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByRole('link', { name: /Shimano brake pads/ });
  return { ...rtl, ui };
}

const tick = (rtl, ui, name) => rtl.fireEvent.click(ui.getByRole('checkbox', { name: `Tick ${name}` }));
async function openDialog(rtl, ui, names = ['Shimano brake pads', '[Product 2]']) {
  for (const n of names) tick(rtl, ui, n);
  rtl.fireEvent.click(ui.getByRole('button', { name: 'Change prices' }));
  return ui.findByRole('dialog', { name: 'Change prices' });
}

test('the Owner ticks products: a bar with "[n] ticked", Untick all and Change prices; Tick all ticks every one shown', async () => {
  const rtl = await open();
  const { ui } = rtl;
  assert.ok(ui.queryByRole('region', { name: 'Ticked products' }) === null, 'no bar with nothing ticked');
  tick(rtl, ui, 'Shimano brake pads');
  const bar = ui.getByRole('region', { name: 'Ticked products' });
  assert.match(bar.textContent, /1 ticked/);
  assert.ok(rtl.within(bar).getByRole('button', { name: 'Untick all' }));
  assert.ok(rtl.within(bar).getByRole('button', { name: 'Change prices' }));
  rtl.fireEvent.click(ui.getByRole('checkbox', { name: 'Tick all 3 shown' }));
  assert.match(ui.getByRole('region', { name: 'Ticked products' }).textContent, /3 ticked/);
  rtl.fireEvent.click(ui.getByRole('button', { name: 'Untick all' }));
  assert.ok(ui.queryByRole('region', { name: 'Ticked products' }) === null);
});

test('ticks stay while searching', async () => {
  const rtl = await open();
  const { ui } = rtl;
  tick(rtl, ui, 'Shimano brake pads');
  rtl.fireEvent.change(ui.getByRole('searchbox', { name: 'Search stock' }), { target: { value: '[Supplier 2]' } });
  await ui.findByRole('checkbox', { name: 'Tick [Product 3]' });
  await rtl.waitFor(() => assert.ok(ui.queryByRole('link', { name: /Shimano brake pads/ }) === null));
  tick(rtl, ui, '[Product 3]');
  assert.match(ui.getByRole('region', { name: 'Ticked products' }).textContent, /2 ticked/);
});

test('Jo sees no tick boxes and no Change prices', async () => {
  const { ui } = await open({ me: JO });
  assert.ok(ui.queryByRole('checkbox') === null);
  assert.ok(ui.queryByRole('button', { name: 'Change prices' }) === null);
});

test('Change prices: the title, the three ways, the ending, and the preview with Now, New, Below cost and Margin', async () => {
  const rtl = await open();
  const { ui } = rtl;
  const dialog = await openDialog(rtl, ui);
  const d = rtl.within(dialog);
  assert.ok(d.getByText('2 products from [Supplier]'));
  assert.equal(d.getByRole('radio', { name: 'Up or down by a percentage' }).getAttribute('aria-checked'), 'true');
  assert.ok(d.getByRole('radio', { name: 'A new price for each' }));
  assert.ok(d.getByRole('radio', { name: 'A target margin' }));
  assert.equal(d.getByRole('radio', { name: '.99' }).getAttribute('aria-checked'), 'true');
  rtl.fireEvent.change(d.getByRole('textbox', { name: 'Percentage change' }), { target: { value: '+10' } });
  await rtl.waitFor(() => assert.ok(sent.some((s) => s.path === '/api/stock/prices/preview' && s.body.value === 10 && s.body.ending === '99')));
  const table = await d.findByRole('table', { name: 'Prices before and after' });
  const pads = rtl.within(table).getByRole('row', { name: /Shimano brake pads/ });
  assert.match(pads.textContent, /£28\.00/);
  assert.match(pads.textContent, /£30\.99/);
  // 2800 ÷ 1.2 = 2333 net; 1250 cost: 46% now, (2582.5 − 1250) ÷ 2582.5 = 52% after.
  assert.match(pads.textContent, /46%\s*→\s*52%/);
  assert.match(rtl.within(table).getByRole('row', { name: /\[Product 2\]/ }).textContent, /Below cost/);
  assert.ok(d.getByText(/Nothing changes until you press Change\. You can undo it straight after; each change goes into the product’s history\./));
  assert.ok(d.getByRole('button', { name: 'Change 2 prices' }));
  assert.deepEqual(sent.filter((s) => s.path === '/api/stock/prices/preview').at(-1).body.productIds, [1, 2]);
});

test('A new price for each: no ending, a box for each new price, sent as pence', async () => {
  const rtl = await open();
  const { ui } = rtl;
  const d = rtl.within(await openDialog(rtl, ui));
  rtl.fireEvent.click(d.getByRole('radio', { name: 'A new price for each' }));
  assert.ok(d.queryByRole('radio', { name: '.99' }) === null);
  const box = await d.findByRole('textbox', { name: 'New price for Shimano brake pads' });
  rtl.fireEvent.change(box, { target: { value: '25.00' } });
  await rtl.waitFor(() => assert.ok(sent.some((s) => s.path === '/api/stock/prices/preview' && s.body.how === 'each' && s.body.prices['1'] === 2500)));
});

test('a rule that changes nothing: Change is greyed and says so', async () => {
  const rtl = await open();
  const { ui } = rtl;
  const d = rtl.within(await openDialog(rtl, ui));
  rtl.fireEvent.change(d.getByRole('textbox', { name: 'Percentage change' }), { target: { value: '0' } });
  await d.findByText('Nothing would change');
  const button = d.getByRole('button', { name: /^Change/ });
  assert.equal(button.getAttribute('aria-disabled'), 'true');
  assert.equal(button.getAttribute('aria-describedby'), 'pr-why');
  rtl.fireEvent.click(button);
  assert.ok(!sent.some((s) => s.path === '/api/stock/prices'), 'nothing sent');
});

test('Change sends the rule, clears the ticks and says "Prices changed · 2 products" with Undo; Undo puts them back', async () => {
  const rtl = await open({ undo: { undone: 1, leftAlone: 1 } });
  const { ui } = rtl;
  const d = rtl.within(await openDialog(rtl, ui));
  rtl.fireEvent.change(d.getByRole('textbox', { name: 'Percentage change' }), { target: { value: '10' } });
  rtl.fireEvent.click(await d.findByRole('button', { name: 'Change 2 prices' }));
  const done = await ui.findByText('Prices changed · 2 products');
  assert.deepEqual(sent.find((s) => s.path === '/api/stock/prices').body, { productIds: [1, 2], groupIds: [], how: 'percent', value: 10, ending: '99' });
  assert.ok(ui.queryByRole('dialog') === null);
  assert.ok(ui.queryByRole('region', { name: 'Ticked products' }) === null, 'the ticks clear');
  rtl.fireEvent.click(rtl.within(done.closest('[role="status"]')).getByRole('button', { name: 'Undo' }));
  await ui.findByText('Prices put back · 1 product · 1 changed since, left as they are');
  assert.ok(sent.some((s) => s.path === '/api/stock/prices/41/undo'));
});

test('on a phone each product stacks: Now → New, then Margin', async () => {
  const rtl = await open({ phone: true });
  const { ui } = rtl;
  const d = rtl.within(await openDialog(rtl, ui));
  rtl.fireEvent.change(d.getByRole('textbox', { name: 'Percentage change' }), { target: { value: '10' } });
  const list = await d.findByRole('list', { name: 'Prices before and after' });
  await d.findByText('£30.99');
  const pads = rtl.within(list).getAllByRole('listitem')[0];
  assert.match(pads.textContent, /Now £28\.00/);
  assert.match(pads.textContent, /New £30\.99/);
  assert.match(pads.textContent, /Margin 46%\s*→\s*52%/);
  assert.ok(d.queryByRole('table') === null);
});
