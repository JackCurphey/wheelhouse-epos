// Stock take, the counting half (openspec/changes/stock-take; tk-hub,
// tk-hub-staff, tk-start, tk-start-category, tk-count, tk-count-below in
// stock.mjs; stock control decisions 5, 9 and 11). Example data from the
// drawings: Shimano brake pads B05S-RX, Jack Lewis, Jo Taylor, Alex Morgan,
// Drivetrain › Derailleurs; everything else stays a bracketed placeholder.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const JO = { ...OWNER, id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false };
// A stock figure no counter should ever see.
const PADS = { id: 11, sku: 'B05S-RX', barcode: '4524667000001', name: 'Shimano brake pads', category: 'Brakes', stockQty: 4321 };
const CAT2 = { id: 16, sku: '[Supplier code 2]', barcode: null, name: '[Product 5]', category: 'Brakes', stockQty: 4321 };
const MECH = { id: 12, sku: '[Supplier code]', barcode: null, name: '[Product]', category: 'Drivetrain › Derailleurs', stockQty: -1 };
const STARTED = '2026-09-01T09:30:00.000Z';
const take = (over) => ({ id: 5, kind: 'area', target: '[Area]', label: '[Area]', startedAt: STARTED, startedBy: 'Jack Lewis', counting: ['Jo Taylor', 'Alex Morgan'], finished: [], itemsCounted: 3, everyoneFinished: false, ...over });
// Applied on the pinned day, as the drawings' "[date]".
const APPLIED = { ...take({ id: 6, kind: 'whole_shop', target: '', label: 'Whole shop' }), status: 'applied', appliedAt: STARTED, appliedBy: 'Jack Lewis', productsChanged: 1, valuePence: -2800 };
const ROW = (over) => ({ productId: 11, name: 'Shimano brake pads', sku: 'B05S-RX', expected: 6, counted: 3, difference: -3, costPence: 1400, valuePence: -4200, byCounter: [{ name: 'Jo Taylor', qty: 2 }, { name: 'Alex Morgan', qty: 1 }], allowedFor: [{ kind: 'sold', change: -1 }], ...over });
const CHECK = {
  productsCounted: 3, productsMatching: 1, productsDiffering: 2, valuePence: -2800,
  rows: [ROW(), ROW({ productId: 12, name: '[Product]', sku: '[Supplier code]', expected: -1, counted: 0, difference: 1, valuePence: 1400, byCounter: [{ name: 'Jo Taylor', qty: 0 }], allowedFor: [] })],
  recountAsked: [{ productId: 13, name: '[Product 2]', sku: null, askedBy: 'Jack Lewis' }],
  notCounted: { products: 2, expected: 5, list: [{ productId: 14, name: '[Product 3]', sku: null }, { productId: 15, name: '[Product 4]', sku: null }] },
};
const HUB = { canStart: true, areasUsed: ['[Area]', '[Area 2]'], inProgress: [take(), take({ id: 6, label: 'Whole shop', kind: 'whole_shop', target: '', counting: [], finished: ['Jo Taylor'], itemsCounted: 9, everyoneFinished: true })], finished: [APPLIED] };

let current;
afterEach(async () => {
  // Nothing drawn, nothing to clean (rtl-cleanup-before-dom).
  if (!current) return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current.shell?.queryClient.clear();
  current.uninstall?.();
  globalThis.fetch = current.realFetch;
  current = undefined;
});

// The server, pretended: a take's page holds this person's lines, and counts
// change them as the real one does.
async function open(path, { me = OWNER, hub = HUB, page, countReply, checked = CHECK, product } = {}) {
  const calls = [];
  const realFetch = globalThis.fetch;
  let mine = [...(page?.mine ?? [])];
  let stillToFind = page?.stillToFind ?? null;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: String(url), method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, me);
    const own = u.pathname.match(/^\/api\/stock-takes\/\d+\/products$/);
    if (own) {
      const q = (u.searchParams.get('search') ?? '').toLowerCase();
      return reply(200, [PADS, MECH, CAT2].filter((p) => q && [p.name, p.sku, p.barcode].some((v) => v && v.toLowerCase().includes(q)))
        .map((p) => ({ id: p.id, name: p.name, sku: p.sku, barcode: p.barcode })));
    }
    if (u.pathname === '/api/products') {
      const q = (u.searchParams.get('search') ?? '').toLowerCase();
      return reply(200, [PADS, MECH].filter((p) => [p.name, p.sku, p.barcode].some((v) => v && v.toLowerCase().includes(q))));
    }
    if (u.pathname === '/api/categories') return reply(200, ['Brakes', 'Drivetrain', 'Drivetrain › Derailleurs']);
    if (u.pathname === '/api/stock-takes' && method === 'GET') return reply(200, me.isOwner ? hub : { ...hub, canStart: false, finished: undefined });
    if (product && u.pathname === `/api/products/${product.id}`) return reply(200, product);
    if (u.pathname === '/api/stock-takes' && method === 'POST') return reply(201, take({ id: 8, kind: body.kind, target: body.target ?? '', label: body.target ?? 'Whole shop' }));
    const m = u.pathname.match(/^\/api\/stock-takes\/(\d+)(?:\/(\w+))?$/);
    if (m) {
      if (!m[2]) {
        const myItems = mine.reduce((n, l) => n + l.qty, 0);
        return reply(200, { ...take({ id: Number(m[1]) }), othersCounting: ['Alex Morgan'], ...page, stillToFind, mine, myItems });
      }
      if (m[2] === 'counts') {
        if (countReply) return reply(...countReply);
        const p = [PADS, MECH].find((x) => x.id === body.productId);
        const was = mine.find((l) => l.productId === p.id);
        const qty = body.add ? (was?.qty ?? 0) + 1 : body.qty;
        mine = qty === 0 ? mine.filter((l) => l.productId !== p.id) : was ? mine.map((l) => (l.productId === p.id ? { ...l, qty } : l)) : [{ productId: p.id, name: p.name, sku: p.sku, qty }, ...mine];
        if (stillToFind) stillToFind = stillToFind.filter((s) => s.productId !== p.id);
        return reply(200, { productId: p.id, name: p.name, sku: p.sku, qty });
      }
      if (m[2] === 'check') return reply(200, { ...take({ id: Number(m[1]) }), ...checked });
      if (m[2] === 'apply') return reply(200, { ...take({ id: Number(m[1]) }), status: 'applied', appliedAt: STARTED, appliedBy: 'Jack Lewis', productsChanged: 2, valuePence: -2800 });
      if (m[2] === 'undo') return reply(200, take({ id: Number(m[1]) }));
      return reply(200, { ok: true });
    }
    if (/^\/api\/stock-takes\/\d+\/products$/.test(u.pathname)) return reply(200, []);
    if (u.pathname.startsWith('/api/')) return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  const uninstall = installDom(`http://localhost${path}`);
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  current = { realFetch, uninstall };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  current.shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(current.shell.AppShell));
  return { ...rtl, ui, calls };
}
const posts = (calls, end) => calls.filter((c) => c.method === 'POST' && c.url.endsWith(end));
const scan = (r, code) => {
  const box = r.ui.getByRole('searchbox', { name: 'Scan each item, or type to find it' });
  r.fireEvent.change(box, { target: { value: code } });
  r.fireEvent.keyDown(box, { key: 'Enter' });
};
const waitFor = async (r, fn) => r.waitFor(() => assert.ok(fn()));

// ---- Stock take (tk-hub, tk-hub-staff) ----

test('the Owner sees Count stock with Start a count, and the counts in progress', async () => {
  const r = await open('/workshop/stocktake');
  const { ui, within } = r;
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Stock take' }));
  const count = within(await ui.findByRole('region', { name: 'Count stock' }));
  assert.ok(count.getByText('Count the whole shop, a category or an area. Staff join on their phones; the shop stays open.'));
  assert.ok(count.getByRole('button', { name: 'Start a count' }));
  const list = within(await ui.findByRole('list', { name: 'Counts in progress' }));
  const items = list.getAllByRole('listitem');
  assert.equal(items.length, 2);
  assert.match(items[0].textContent, /\[Area\]/);
  assert.match(items[0].textContent, /by Jack Lewis · 3 items counted · Jo Taylor and Alex Morgan counting/);
  assert.match(items[0].textContent, /Counting/);
  assert.equal(within(items[0]).getByRole('link', { name: 'Join the count of [Area]' }).getAttribute('href'), '/workshop/stocktake/5');
  assert.match(items[1].textContent, /Whole shop/);
  assert.match(items[1].textContent, /everyone has finished/);
  assert.match(items[1].textContent, /Ready to check/);
});

test('Staff see Join, not Start a count, and who starts and checks a count', async () => {
  const { ui } = await open('/workshop/stocktake', { me: JO });
  await ui.findByRole('list', { name: 'Counts in progress' });
  assert.ok(ui.queryByRole('button', { name: 'Start a count' }) === null);
  assert.ok(ui.queryByRole('region', { name: 'Count stock' }) === null);
  assert.ok(ui.getByRole('link', { name: 'Join the count of [Area]' }));
  assert.ok(ui.getByText('Starting a count, and checking and applying it, are for the shop’s owner for now.'));
});

test('no counts in progress says so', async () => {
  const { ui } = await open('/workshop/stocktake', { hub: { ...HUB, inProgress: [] } });
  assert.ok(await ui.findByText('No counts in progress.'));
});

// ---- Start a count (tk-start, tk-start-category) ----

test('Start a count: an area, picked from those used before, then counting', async () => {
  const r = await open('/workshop/stocktake');
  const { ui, within, fireEvent } = r;
  fireEvent.click(await ui.findByRole('button', { name: 'Start a count' }));
  const dialog = within(await ui.findByRole('dialog', { name: 'Start a count' }));
  assert.ok(dialog.getByText('Staff can join it from Stock take on any device'));
  assert.equal(dialog.getByRole('radio', { name: 'An area' }).checked, true, 'an area, as drawn');
  assert.ok(dialog.getByText('Only what’s scanned in this area is compared — products nobody scans are left as they are.'));
  assert.ok(dialog.getByText('Counters don’t see what Wheelhouse expects, so they count what’s really there. Anything sold, booked in or adjusted during the count is allowed for.'));
  const start = dialog.getByRole('button', { name: 'Start the count' });
  assert.equal(start.disabled, true, 'not until the area is named');
  fireEvent.click(dialog.getByRole('button', { name: '[Area 2]' }));
  assert.equal(dialog.getByLabelText('Which area').value, '[Area 2]');
  fireEvent.click(start);
  await waitFor(r, () => window.location.pathname === '/workshop/stocktake/8');
  assert.deepEqual(posts(r.calls, '/api/stock-takes').map((c) => c.body), [{ kind: 'area', target: '[Area 2]' }]);
  await ui.findByRole('searchbox', { name: 'Scan each item, or type to find it' });
});

test('Start a count: a category, picked by searching', async () => {
  const r = await open('/workshop/stocktake');
  const { ui, within, fireEvent } = r;
  fireEvent.click(await ui.findByRole('button', { name: 'Start a count' }));
  const dialog = within(await ui.findByRole('dialog', { name: 'Start a count' }));
  fireEvent.click(dialog.getByRole('radio', { name: 'A category' }));
  assert.ok(dialog.getByText('Everything in this category — and nothing else — is compared.'));
  fireEvent.change(dialog.getByRole('combobox', { name: 'Which category' }), { target: { value: 'derail' } });
  fireEvent.click(await dialog.findByRole('option', { name: 'Drivetrain › Derailleurs' }, { timeout: 5000 }));
  assert.equal(dialog.getByRole('combobox', { name: 'Which category' }).value, 'Drivetrain › Derailleurs');
  fireEvent.click(dialog.getByRole('button', { name: 'Start the count' }));
  await waitFor(r, () => posts(r.calls, '/api/stock-takes').length === 1);
  assert.deepEqual(posts(r.calls, '/api/stock-takes')[0].body, { kind: 'category', target: 'Drivetrain › Derailleurs' });
  await ui.findByRole('searchbox', { name: 'Scan each item, or type to find it' });
});

for (const [label, kind] of [['Whole shop', 'whole_shop'], ['Below zero', 'below_zero']]) {
  test(`Start a count: ${label} needs nothing more`, async () => {
    const r = await open('/workshop/stocktake');
    const { ui, within, fireEvent } = r;
    fireEvent.click(await ui.findByRole('button', { name: 'Start a count' }));
    const dialog = within(await ui.findByRole('dialog', { name: 'Start a count' }));
    fireEvent.click(dialog.getByRole('radio', { name: label }));
    fireEvent.click(dialog.getByRole('button', { name: 'Start the count' }));
    await waitFor(r, () => window.location.pathname === '/workshop/stocktake/8');
    assert.deepEqual(posts(r.calls, '/api/stock-takes').map((c) => c.body), [{ kind }]);
    // The counting page has loaded before the test ends.
    await ui.findByRole('searchbox', { name: 'Scan each item, or type to find it' });
  });
}

// ---- Counting (tk-count, tk-count-below) ----

test('counting: joins, a scan adds one, nothing shows the stock figure', async () => {
  const r = await open('/workshop/stocktake/5');
  const { ui, within } = r;
  const card = within(await ui.findByRole('region', { name: 'Counting [Area]' }));
  await waitFor(r, () => posts(r.calls, '/api/stock-takes/5/join').length === 1);
  assert.ok(card.getByRole('heading', { level: 3, name: 'Scan what’s here' }));
  assert.ok(card.getByText('Count what’s on the shelf. Anything sold, booked in or adjusted while you count is allowed for.'));
  scan(r, '4524667000001');
  await waitFor(r, () => card.queryByRole('group', { name: 'Shimano brake pads' }) !== null);
  assert.deepEqual(posts(r.calls, '/api/stock-takes/5/counts').map((c) => c.body), [{ productId: 11, add: 1 }]);
  assert.equal(card.getByRole('status').textContent, 'Added Shimano brake pads · 1');
  assert.equal(card.getByRole('textbox', { name: 'How many: Shimano brake pads' }).value, '1');
  scan(r, 'B05S-RX');
  await waitFor(r, () => card.getByRole('textbox', { name: 'How many: Shimano brake pads' }).value === '2');
  assert.ok(card.getByText('2 items counted by you · Alex Morgan is counting too'));
  assert.ok(!document.body.textContent.includes('4321'), 'blind');
  assert.ok(r.calls.some((c) => c.url.startsWith('/api/stock-takes/5/products?')), 'searched through the count');
  assert.ok(!r.calls.some((c) => c.url.startsWith('/api/products')), 'never the product list, which carries stock and cost');
  assert.equal(within(ui.getByRole('main')).getByRole('link', { name: 'Stock take' }).getAttribute('href'), '/workshop/stocktake');
});

test('counting: a typed number sets the count, and − at 1 takes the line off', async () => {
  const r = await open('/workshop/stocktake/5', { page: { mine: [{ productId: 11, name: 'Shimano brake pads', sku: 'B05S-RX', qty: 1 }] } });
  const { ui, fireEvent } = r;
  const box = await ui.findByRole('textbox', { name: 'How many: Shimano brake pads' });
  fireEvent.change(box, { target: { value: '7' } });
  await waitFor(r, () => posts(r.calls, '/counts').length === 1);
  assert.deepEqual(posts(r.calls, '/counts')[0].body, { productId: 11, qty: 7 });
  await waitFor(r, () => box.value === '7');
  fireEvent.change(box, { target: { value: '1' } });
  await waitFor(r, () => box.value === '1');
  fireEvent.click(ui.getByRole('button', { name: 'One fewer: Shimano brake pads' }));
  await waitFor(r, () => ui.queryByRole('group', { name: 'Shimano brake pads' }) === null);
  assert.deepEqual(posts(r.calls, '/counts').at(-1).body, { productId: 11, qty: 0 });
});

test('counting: a product outside the count is refused with the server’s words', async () => {
  const r = await open('/workshop/stocktake/5', { countReply: [400, { error: 'Shimano brake pads isn’t in Drivetrain › Derailleurs' }] });
  const { ui } = r;
  await ui.findByRole('searchbox', { name: 'Scan each item, or type to find it' });
  scan(r, 'B05S-RX');
  assert.equal((await ui.findByRole('alert')).textContent, 'Shimano brake pads isn’t in Drivetrain › Derailleurs');
});

test('I’ve finished my part goes back to Stock take', async () => {
  const r = await open('/workshop/stocktake/5');
  const { ui, fireEvent } = r;
  fireEvent.click(await ui.findByRole('button', { name: 'I’ve finished my part' }));
  await waitFor(r, () => window.location.pathname === '/workshop/stocktake');
  assert.equal(posts(r.calls, '/api/stock-takes/5/finish').length, 1);
  await ui.findByRole('list', { name: 'Counts in progress' });
});

test('below zero: what’s still to find, by name, until it’s counted', async () => {
  const r = await open('/workshop/stocktake/6', { page: { kind: 'below_zero', target: '', label: 'Below zero', stillToFind: [{ productId: 12, name: '[Product]', sku: '[Supplier code]' }, { productId: 13, name: '[Product 2]', sku: null }] } });
  const { ui, within } = r;
  const card = within(await ui.findByRole('region', { name: 'Counting: below zero' }));
  assert.ok(card.getByRole('heading', { level: 3, name: 'Find and scan these' }));
  assert.ok(card.getByRole('heading', { level: 3, name: 'Still to find · 2' }));
  const left = within(card.getByRole('list', { name: 'Still to find' }));
  assert.equal(left.getAllByRole('listitem').length, 2);
  assert.match(left.getAllByRole('listitem')[0].textContent, /\[Product\].*Not found yet/);
  assert.ok(card.getByText('Started by Jack Lewis. Staff can join from Stock take. Numbers aren’t shown — count what you find.'));
  scan(r, '[Supplier code]');
  await waitFor(r, () => card.queryByRole('heading', { level: 3, name: 'Still to find · 1' }) !== null);
  assert.ok(card.getByRole('heading', { level: 3, name: 'Counted' }));
  assert.ok(!document.body.textContent.includes('-1'), 'blind');
});

// ---- Checking and applying (tk-hub's Check it and Finished counts, tk-diff, tk-applied) ----

test('the Owner has Check it on a count in progress, and Finished counts with Open', async () => {
  const { ui, within } = await open('/workshop/stocktake');
  const list = within(await ui.findByRole('list', { name: 'Counts in progress' }));
  assert.equal(list.getByRole('link', { name: 'Check the count of [Area]' }).getAttribute('href'), '/workshop/stocktake/5/check');
  const done = within(ui.getByRole('list', { name: 'Finished counts' }));
  const [row] = done.getAllByRole('listitem');
  assert.match(row.textContent, /Whole shop/);
  assert.match(row.textContent, /Applied Tue 1 Sep by Jack Lewis · 1 product changed · £28\.00 under, at cost/);
  assert.equal(done.getByRole('link', { name: 'Open the whole-shop count from Tue 1 Sep' }).getAttribute('href'), '/workshop/stocktake/6/applied');
});

test('Staff have neither Check it nor Finished counts', async () => {
  const { ui } = await open('/workshop/stocktake', { me: JO });
  await ui.findByRole('list', { name: 'Counts in progress' });
  assert.ok(ui.queryByRole('link', { name: 'Check the count of [Area]' }) === null);
  assert.ok(ui.queryByRole('region', { name: 'Finished counts' }) === null);
});

test('Check the count: the summary, differences largest first, who counted, what was allowed for', async () => {
  const r = await open('/workshop/stocktake/5/check');
  const { ui, within } = r;
  const card = within(await ui.findByRole('region', { name: 'Check the count of [Area]' }));
  assert.ok(card.getByText((_, el) => el?.tagName === 'P' && el.textContent === '3 products counted · 1 match · 2 differ · £28.00 under, at cost, in all'));
  const table = within(card.getByRole('table', { name: 'Differences, largest value first' }));
  const rows = table.getAllByRole('row').slice(1);
  assert.equal(rows.length, 3, 'two differences and a recount asked');
  assert.match(rows[0].textContent, /Shimano brake pads/);
  assert.match(rows[0].textContent, /1 sold during the count, allowed for/);
  assert.match(rows[0].textContent, /Jo Taylor 2 \+ Alex Morgan 1/);
  assert.match(rows[0].textContent, /3 under · £42\.00/);
  assert.match(rows[1].textContent, /was below zero/);
  assert.match(rows[1].textContent, /1 over · £14\.00/);
  assert.match(rows[2].textContent, /\[Product 2\].*Recount asked/);
  assert.ok(card.getByText('Not counted · 2 products · expected 5 in all'));
  assert.ok(card.getByText('Products nobody scanned are left as they are.'));
  assert.ok(card.getByText('Anything sold, booked in or adjusted during the count is allowed for.'));
  assert.ok(card.queryByText(/held for online orders|used on a job|Cycle to Work/) === null, 'only what is true yet');
  assert.ok(card.getByRole('button', { name: 'Apply to 2 products' }));
});

test('Recount and Count them as none ask the server, then show the count again', async () => {
  const r = await open('/workshop/stocktake/5/check');
  const { ui, fireEvent } = r;
  fireEvent.click(await ui.findByRole('button', { name: 'Ask for Shimano brake pads to be recounted' }));
  await waitFor(r, () => posts(r.calls, '/recount').length === 1);
  assert.deepEqual(posts(r.calls, '/recount')[0].body, { productId: 11 });
  fireEvent.click(ui.getByRole('button', { name: 'Count them as none' }));
  await waitFor(r, () => posts(r.calls, '/none').length === 1);
  await waitFor(r, () => r.calls.filter((c) => c.url.endsWith('/check')).length >= 3);
});

test('an area count has no “not counted” list', async () => {
  const { ui } = await open('/workshop/stocktake/5/check', { checked: { ...CHECK, notCounted: null } });
  await ui.findByRole('button', { name: 'Apply to 2 products' });
  assert.ok(ui.queryByRole('button', { name: 'Count them as none' }) === null);
  assert.ok(ui.queryByText(/^Not counted/) === null);
});

test('Apply goes to Count applied, with Undo in its bar; Undo takes it back to checking', async () => {
  const r = await open('/workshop/stocktake/5/check');
  const { ui, within, fireEvent } = r;
  fireEvent.click(await ui.findByRole('button', { name: 'Apply to 2 products' }));
  await waitFor(r, () => window.location.pathname === '/workshop/stocktake/5/applied');
  const bar = await ui.findByText('Count applied · [Area] · 2 products corrected');
  const card = within(await ui.findByRole('region', { name: 'Count applied' }));
  assert.ok(card.getByText('[Area] · stock corrected for 2 products'));
  assert.ok(card.getByText(/^Each change is in its product’s stock history as “Counted”/));
  assert.equal(card.getByRole('link', { name: 'Download the count' }).getAttribute('href'), '/api/stock-takes/5/download');
  fireEvent.click(within(bar.closest('[role="status"]')).getByRole('button', { name: 'Undo' }));
  await waitFor(r, () => posts(r.calls, '/undo').length === 1);
  await waitFor(r, () => window.location.pathname === '/workshop/stocktake/5/check');
  await ui.findByRole('button', { name: 'Apply to 2 products' });
});

test('Count applied opened later has Download but no Undo bar', async () => {
  const { ui, within } = await open('/workshop/stocktake/6/applied', { page: { ...APPLIED } });
  const card = within(await ui.findByRole('region', { name: 'Count applied' }));
  assert.ok(card.getByText('Whole shop · stock corrected for 1 product'));
  assert.ok(ui.queryByRole('button', { name: 'Undo' }) === null);
});

test('counting: a recount asked shows with no number until it is counted', async () => {
  const r = await open('/workshop/stocktake/5', { page: { recountAsked: [{ productId: 11, name: 'Shimano brake pads', sku: 'B05S-RX', askedBy: 'Jack Lewis' }] } });
  const { ui, fireEvent } = r;
  assert.ok(await ui.findByText(/Recount asked by Jack Lewis/));
  const box = ui.getByRole('textbox', { name: 'How many: Shimano brake pads' });
  assert.equal(box.value, '');
  fireEvent.change(box, { target: { value: '5' } });
  await waitFor(r, () => posts(r.calls, '/counts').length === 1);
  assert.deepEqual(posts(r.calls, '/counts')[0].body, { productId: 11, qty: 5 });
});

test('counting: an applied count can’t be counted any more', async () => {
  const { ui } = await open('/workshop/stocktake/6', { page: { ...APPLIED } });
  assert.ok(await ui.findByText('This count has been applied.'));
  assert.ok(ui.queryByRole('searchbox', { name: 'Scan each item, or type to find it' }) === null);
});

test('a product’s history says Counted, and who applied it', async () => {
  const pads = { ...PADS, price: 28, cost: 14, active: true, history: [{ id: 1, type: 'count', change: -2, reason: null, note: 'Stock take of [Area] · counted 4, expected 6 · counted by Jo Taylor', who: 'Jack Lewis', at: STARTED }, { id: 2, type: 'count_undone', change: 2, reason: null, note: 'Undid the stock take of [Area]', who: 'Jack Lewis', at: STARTED }] };
  const { ui, within } = await open('/workshop/stock/11', { product: pads });
  const history = within(await ui.findByRole('region', { name: /history/i }));
  const lines = await history.findAllByRole('listitem');
  assert.match(lines[0].textContent, /^Counted/);
  assert.match(lines[0].textContent, /Stock take of \[Area\] · counted 4, expected 6 · counted by Jo Taylor · applied by Jack Lewis/);
  assert.match(lines[1].textContent, /^Count undone/);
  assert.match(lines[1].textContent, /Undid the stock take of \[Area\] · Jack Lewis/);
});

// ---- Keyboard (review, 28 Oct) ----

test('the category picker: arrow keys move through the matches and Enter picks one', async () => {
  const r = await open('/workshop/stocktake');
  const { ui, within, fireEvent } = r;
  fireEvent.click(await ui.findByRole('button', { name: 'Start a count' }));
  const dialog = within(await ui.findByRole('dialog', { name: 'Start a count' }));
  fireEvent.click(dialog.getByRole('radio', { name: 'A category' }));
  const box = dialog.getByRole('combobox', { name: 'Which category' });
  fireEvent.change(box, { target: { value: 'drive' } });
  await dialog.findByRole('option', { name: 'Drivetrain' }, { timeout: 5000 });
  assert.ok(box.getAttribute('aria-activedescendant') === null, 'nothing active until an arrow is pressed');
  fireEvent.keyDown(box, { key: 'ArrowDown' });
  fireEvent.keyDown(box, { key: 'ArrowDown' });
  const active = document.getElementById(box.getAttribute('aria-activedescendant'));
  assert.equal(active.textContent, 'Drivetrain › Derailleurs');
  assert.equal(active.getAttribute('aria-selected'), 'true');
  fireEvent.keyDown(box, { key: 'ArrowUp' });
  assert.equal(document.getElementById(box.getAttribute('aria-activedescendant')).textContent, 'Drivetrain');
  fireEvent.keyDown(box, { key: 'ArrowDown' });
  fireEvent.keyDown(box, { key: 'Enter' });
  assert.equal(box.value, 'Drivetrain › Derailleurs');
  assert.equal(dialog.getByRole('button', { name: 'Start the count' }).disabled, false);
});

test('the category picker: a category typed in full counts as picked', async () => {
  const r = await open('/workshop/stocktake');
  const { ui, within, fireEvent } = r;
  fireEvent.click(await ui.findByRole('button', { name: 'Start a count' }));
  const dialog = within(await ui.findByRole('dialog', { name: 'Start a count' }));
  fireEvent.click(dialog.getByRole('radio', { name: 'A category' }));
  await r.waitFor(() => assert.ok(r.calls.some((c) => c.url === '/api/categories')));
  fireEvent.change(dialog.getByRole('combobox', { name: 'Which category' }), { target: { value: 'brakes' } });
  await r.waitFor(() => assert.equal(dialog.getByRole('button', { name: 'Start the count' }).disabled, false));
  fireEvent.click(dialog.getByRole('button', { name: 'Start the count' }));
  await waitFor(r, () => posts(r.calls, '/api/stock-takes').length === 1);
  assert.deepEqual(posts(r.calls, '/api/stock-takes')[0].body, { kind: 'category', target: 'Brakes' });
  await ui.findByRole('searchbox', { name: 'Scan each item, or type to find it' });
});

test('counting: arrow keys and Enter pick from the matches', async () => {
  const r = await open('/workshop/stocktake/5');
  const { ui, fireEvent } = r;
  const box = await ui.findByRole('searchbox', { name: 'Scan each item, or type to find it' });
  fireEvent.change(box, { target: { value: 'product' } });
  await ui.findByRole('option', { name: /\[Product 5\]/ }, { timeout: 5000 });
  fireEvent.keyDown(box, { key: 'ArrowDown' });
  fireEvent.keyDown(box, { key: 'ArrowDown' });
  const active = document.getElementById(box.getAttribute('aria-activedescendant'));
  assert.match(active.textContent, /\[Product 5\]/);
  fireEvent.keyDown(box, { key: 'Enter' });
  await waitFor(r, () => posts(r.calls, '/counts').length === 1);
  assert.deepEqual(posts(r.calls, '/counts')[0].body, { productId: 16, add: 1 });
});
