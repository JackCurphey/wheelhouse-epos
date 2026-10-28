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
const MECH = { id: 12, sku: '[Supplier code]', barcode: null, name: '[Product]', category: 'Drivetrain › Derailleurs', stockQty: -1 };
const STARTED = '2026-09-01T09:30:00.000Z';
const take = (over) => ({ id: 5, kind: 'area', target: '[Area]', label: '[Area]', startedAt: STARTED, startedBy: 'Jack Lewis', counting: ['Jo Taylor', 'Alex Morgan'], finished: [], itemsCounted: 3, everyoneFinished: false, ...over });
const HUB = { canStart: true, areasUsed: ['[Area]', '[Area 2]'], inProgress: [take(), take({ id: 6, label: 'Whole shop', kind: 'whole_shop', target: '', counting: [], finished: ['Jo Taylor'], itemsCounted: 9, everyoneFinished: true })] };

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
async function open(path, { me = OWNER, hub = HUB, page, countReply } = {}) {
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
    if (u.pathname === '/api/products') {
      const q = (u.searchParams.get('search') ?? '').toLowerCase();
      return reply(200, [PADS, MECH].filter((p) => [p.name, p.sku, p.barcode].some((v) => v && v.toLowerCase().includes(q))));
    }
    if (u.pathname === '/api/categories') return reply(200, ['Brakes', 'Drivetrain', 'Drivetrain › Derailleurs']);
    if (u.pathname === '/api/stock-takes' && method === 'GET') return reply(200, { ...hub, canStart: me.isOwner });
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
      return reply(200, { ok: true });
    }
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
  assert.ok(dialog.getByText(/^Counters don’t see what Wheelhouse expects, so they count what’s really there\./));
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
  fireEvent.click(await dialog.findByRole('option', { name: 'Drivetrain › Derailleurs' }));
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
  assert.ok(card.getByText('Count what’s on the shelf. Anything sold, booked in, used or sent while you count is allowed for.'));
  scan(r, '4524667000001');
  await waitFor(r, () => card.queryByRole('group', { name: 'Shimano brake pads' }) !== null);
  assert.deepEqual(posts(r.calls, '/api/stock-takes/5/counts').map((c) => c.body), [{ productId: 11, add: 1 }]);
  assert.equal(card.getByRole('status').textContent, 'Added Shimano brake pads · 1');
  assert.equal(card.getByRole('textbox', { name: 'How many: Shimano brake pads' }).value, '1');
  scan(r, 'B05S-RX');
  await waitFor(r, () => card.getByRole('textbox', { name: 'How many: Shimano brake pads' }).value === '2');
  assert.ok(card.getByText('2 items counted by you · Alex Morgan is counting too'));
  assert.ok(!document.body.textContent.includes('4321'), 'blind');
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
