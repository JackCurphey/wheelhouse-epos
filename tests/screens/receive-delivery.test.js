// Receive a delivery (openspec/changes/receive-delivery; rs-receive and
// rs-problem in receiving.mjs; receiving decisions 3, 4 and 9). Example data
// from the drawing: Shimano brake pads B05S-RX; everything else stays a
// bracketed placeholder.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const JO = { ...OWNER, id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false };
const PADS = { id: 11, sku: 'B05S-RX', barcode: '4524667000001', name: 'Shimano brake pads', cost: 28 };
const TUBE = { id: 12, sku: '[Supplier code]', barcode: null, name: '[Product]', cost: 1.1 };
const OTHER = { id: 13, sku: '[Other code]', barcode: '5000000000002', name: '[Product 2]', cost: 1 };
const item = (p, ordered, received, id = p.id + 100) => ({ id, productId: p.id, name: p.name, sku: p.sku, qtyOrdered: ordered, qtyReceived: received, outstanding: ordered - received, unitCost: p.cost });
const order = (over) => ({ id: 7, supplierId: 1, supplierName: '[Supplier]', status: 'partially_received', reference: '', notes: '', orderedAt: '2026-09-01T10:00:00.000Z', createdAt: '2026-09-01T09:00:00.000Z', items: [item(PADS, 1, 0), item(TUBE, 3, 1)], totalCost: 31.3, ...over });
const ORDERS = [order(), order({ id: 8, supplierId: 2, supplierName: '[Supplier 2]', status: 'ordered', items: [item(TUBE, 2, 0, 301)] }), order({ id: 9, supplierName: '[Supplier 3]', status: 'draft', orderedAt: null })];

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let rendered = false;
afterEach(async () => {
  // Nothing drawn, nothing to clean (rtl-cleanup-before-dom).
  if (!rendered) return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
  rendered = false;
});

async function open(path, { me = OWNER, orders = ORDERS, receiveReply } = {}) {
  calls = [];
  const byId = new Map(orders.map((o) => [o.id, o]));
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: String(url), method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, me);
    if (u.pathname === '/api/products') {
      const q = (u.searchParams.get('search') ?? '').toLowerCase();
      return reply(200, [PADS, TUBE, OTHER].filter((p) => [p.name, p.sku, p.barcode].some((v) => v && v.toLowerCase().includes(q))));
    }
    if (u.pathname === '/api/purchase-orders' && method === 'GET') return reply(200, [...byId.values()]);
    const m = u.pathname.match(/^\/api\/purchase-orders\/(\d+)(?:\/(receive))?$/);
    if (m) {
      const o = byId.get(Number(m[1]));
      if (!o) return reply(404, { error: 'Purchase order not found' });
      if (m[2] === 'receive') {
        if (receiveReply) return reply(...receiveReply);
        const items = o.items.map((it) => {
          const got = (body.items ?? []).filter((r) => r.itemId === it.id).reduce((n, r) => n + r.qtyReceived, 0);
          return { ...it, qtyReceived: it.qtyReceived + got, outstanding: it.outstanding - got };
        });
        byId.set(o.id, { ...o, items, status: items.every((it) => it.outstanding === 0) ? 'received' : 'partially_received' });
      }
      return reply(200, byId.get(o.id));
    }
    if (u.pathname.startsWith('/api/')) return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom(`http://localhost${path}`);
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  rendered = true;
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui };
}
const receives = () => calls.filter((c) => c.method === 'POST' && c.url.endsWith('/receive'));

async function receivePage(options, path = '/workshop/deliveries/receive?order=7') {
  const r = await open(path, options);
  await r.ui.findByRole('heading', { level: 2, name: 'Scan the box' });
  await r.ui.findByRole('list', { name: 'Still to come on the order' });
  return r;
}
// A scanner types the code and presses Enter at once, before any search
// has come back, so Enter looks the code up itself.
function scan(r, code) {
  const box = r.ui.getByRole('searchbox', { name: 'Scan a barcode, or type to search' });
  r.fireEvent.change(box, { target: { value: code } });
  r.fireEvent.keyDown(box, { key: 'Enter' });
}

// What the page says after a scan, inside its own card (the shell has its own status lines).
const said = (ui, within) => within(ui.getByRole('region', { name: 'Scan the box' })).getByRole('status');

// ---- Ways in ----

for (const [who, me] of [['the Owner', OWNER], ['a staff member', JO]]) {
  test(`Deliveries and orders has "A delivery arrived?" with Receive a delivery, for ${who}`, async () => {
    const { ui } = await open('/workshop/deliveries', { me });
    await ui.findByRole('heading', { level: 2, name: 'A delivery arrived?' });
    assert.ok(ui.queryByText('Scan each item as it comes out of the box.') !== null);
    assert.equal(ui.getByRole('link', { name: 'Receive a delivery' }).getAttribute('href'), '/workshop/deliveries/receive');
  });
}

test('an order still to come has Receive against this order, for anyone', async () => {
  const { ui } = await open('/workshop/deliveries/orders/7', { me: JO });
  await ui.findByRole('heading', { level: 2, name: '[Supplier] · ordered Tue 1 Sep' });
  assert.equal(ui.getByRole('link', { name: 'Receive against this order' }).getAttribute('href'), '/workshop/deliveries/receive?order=7');
});

test('a draft has no Receive against this order', async () => {
  const { ui } = await open('/workshop/deliveries/orders/9');
  await ui.findByRole('heading', { level: 2, name: '[Supplier 3] · draft' });
  assert.ok(ui.queryByRole('link', { name: 'Receive against this order' }) === null);
});

// ---- Receive a delivery ----

test('Receive a delivery, as drawn: the way back, From with the orders still to come, the scan box and what is still to come', async () => {
  const { ui, within } = await receivePage();
  assert.equal(within(ui.getByRole('main')).getByRole('link', { name: 'Deliveries and orders' }).getAttribute('href'), '/workshop/deliveries');
  assert.equal(ui.getByRole('radio', { name: '[Supplier]' }).checked, true, 'the order asked for is picked');
  assert.ok(ui.getByRole('radio', { name: '[Supplier 2]' }));
  assert.ok(ui.queryByRole('radio', { name: '[Supplier 3]' }) === null, 'a draft is not awaiting a delivery');
  assert.ok(ui.getByRole('searchbox', { name: 'Scan a barcode, or type to search' }));
  const toCome = within(ui.getByRole('list', { name: 'Still to come on the order' })).getAllByRole('listitem');
  assert.ok(toCome[0].textContent.includes('Shimano brake pads') && toCome[0].textContent.includes('B05S-RX · ordered 1, arrived 0') && toCome[0].textContent.includes('1 to come'), toCome[0].textContent);
  assert.ok(toCome[1].textContent.includes('ordered 3, arrived 1') && toCome[1].textContent.includes('2 to come'), toCome[1].textContent);
  assert.ok(ui.getByRole('button', { name: 'Book in 0 items' }).disabled);
});

test('with no order asked for, the newest order still to come is picked', async () => {
  const { ui } = await receivePage({}, '/workshop/deliveries/receive');
  assert.equal(ui.getByRole('radio', { name: '[Supplier 2]' }).checked, true);
});

test('with no orders still to come, it says so', async () => {
  const { ui } = await open('/workshop/deliveries/receive', { orders: [order({ id: 9, status: 'draft', orderedAt: null })] });
  assert.ok((await ui.findByText('No orders are waiting for a delivery.')) !== null);
});

test('scanning the pads adds a line and says so; it leaves what is still to come; a second scan past what is to come adds nothing', async () => {
  const r = await receivePage();
  const { ui, within } = r;
  await scan(r, '4524667000001');
  const scanned = within(await ui.findByRole('list', { name: 'Scanned' }));
  const line = scanned.getAllByRole('listitem')[0];
  assert.ok(line.textContent.includes('Shimano brake pads') && line.textContent.includes('B05S-RX · on your order: 1'), line.textContent);
  assert.equal(scanned.getByRole('textbox', { name: 'How many: Shimano brake pads' }).value, '1');
  assert.ok(said(ui, within).textContent.includes('Added Shimano brake pads · 1'));
  assert.ok(!within(ui.getByRole('list', { name: 'Still to come on the order' })).queryByText('Shimano brake pads'), 'all the pads to come are scanned');
  await scan(r, '4524667000001');
  await r.waitFor(() => assert.ok(said(ui, within).textContent.includes('All 1 Shimano brake pads still to come are counted'), said(ui, within).textContent));
  assert.equal(scanned.getByRole('textbox', { name: 'How many: Shimano brake pads' }).value, '1');
  assert.ok(ui.getByRole('button', { name: 'Book in 1 items' }));
});

test('a product not on the order, and a barcode Wheelhouse doesn’t know, are said and not added', async () => {
  const r = await receivePage();
  await scan(r, '5000000000002');
  await r.waitFor(() => assert.ok(said(r.ui, r.within).textContent.includes('[Product 2] isn’t on this order'), said(r.ui, r.within).textContent));
  await scan(r, '9999');
  await r.waitFor(() => assert.ok(said(r.ui, r.within).textContent.includes('Nothing in Wheelhouse has the barcode 9999'), said(r.ui, r.within).textContent));
  assert.ok(r.ui.queryByRole('list', { name: 'Scanned' }) === null);
});

test('a count can be typed up to what is to come, stepped with + and −, and − at 1 takes the line off', async () => {
  const r = await receivePage();
  const { ui, within, fireEvent } = r;
  fireEvent.change(ui.getByRole('searchbox', { name: 'Scan a barcode, or type to search' }), { target: { value: '[Prod' } });
  fireEvent.click(await ui.findByRole('option', { name: /^\[Product\]/ }));
  const scanned = within(await ui.findByRole('list', { name: 'Scanned' }));
  fireEvent.change(scanned.getByRole('textbox', { name: 'How many: [Product]' }), { target: { value: '5' } });
  assert.equal(scanned.getByRole('textbox', { name: 'How many: [Product]' }).value, '2', 'a typed count stops at the 2 to come');
  fireEvent.click(scanned.getByRole('button', { name: 'One fewer: [Product]' }));
  assert.equal(scanned.getByRole('textbox', { name: 'How many: [Product]' }).value, '1');
  fireEvent.click(scanned.getByRole('button', { name: 'One more: [Product]' }));
  fireEvent.click(scanned.getByRole('button', { name: 'One more: [Product]' }));
  assert.equal(scanned.getByRole('textbox', { name: 'How many: [Product]' }).value, '2', '+ stops at what is to come');
  fireEvent.click(scanned.getByRole('button', { name: 'One fewer: [Product]' }));
  fireEvent.click(scanned.getByRole('button', { name: 'One fewer: [Product]' }));
  assert.ok(ui.queryByRole('list', { name: 'Scanned' }) === null);
});

test('Problem?: Something wrong? as drawn; one damaged is set aside and comes off what is booked in; Book in sends both', async () => {
  const r = await receivePage({ me: JO });
  const { ui, within, fireEvent } = r;
  fireEvent.change(ui.getByRole('searchbox', { name: 'Scan a barcode, or type to search' }), { target: { value: '[Prod' } });
  fireEvent.click(await ui.findByRole('option', { name: /^\[Product\]/ }));
  const scanned = within(await ui.findByRole('list', { name: 'Scanned' }));
  fireEvent.click(scanned.getByRole('button', { name: 'One more: [Product]' }));
  fireEvent.click(scanned.getByRole('button', { name: 'Problem with [Product]' }));
  const box = within(await ui.findByRole('dialog', { name: 'Something wrong?' }));
  assert.ok(box.queryByText('[Product] · [Supplier code] · 2 scanned') !== null);
  for (const kind of ['Damaged', 'Wrong item', 'Missing']) assert.ok(box.getByRole('radio', { name: kind }));
  assert.equal(box.getByRole('radio', { name: 'Damaged' }).checked, true);
  assert.ok(box.queryByText('Damaged items aren’t added to stock. They go on “To return to [Supplier]” in Deliveries and orders until they’re sent back.') !== null);
  fireEvent.click(box.getByRole('radio', { name: 'Missing' }));
  assert.ok(box.queryByText('Missing items stay “to come” on the order.') !== null);
  fireEvent.click(box.getByRole('radio', { name: 'Damaged' }));
  fireEvent.change(box.getByRole('textbox', { name: 'Note (optional)' }), { target: { value: 'box crushed' } });
  fireEvent.click(box.getByRole('button', { name: 'Mark as damaged' }));
  assert.ok(ui.queryByRole('dialog', { name: 'Something wrong?' }) === null);
  assert.ok(scanned.getAllByRole('listitem')[0].textContent.includes('Damaged · 1, set aside'), scanned.getAllByRole('listitem')[0].textContent);
  assert.ok(ui.getByText(/items to book in/).textContent.includes('1 items to book in · 1 set aside'));
  fireEvent.click(ui.getByRole('button', { name: 'Book in 1 items' }));
  await ui.findByText('1 items booked in · stock updated');
  assert.deepEqual(receives().map((c) => [c.url, c.body]), [['/api/purchase-orders/7/receive', { items: [{ itemId: 112, qtyReceived: 1 }], problems: [{ itemId: 112, kind: 'damaged', qty: 1, note: 'box crushed' }] }]]);
  assert.ok(ui.queryByRole('list', { name: 'Scanned' }) === null, 'the list empties');
  const toCome = within(ui.getByRole('list', { name: 'Still to come on the order' })).getAllByRole('listitem');
  assert.ok(toCome.some((li) => li.textContent.includes('ordered 3, arrived 2')), 'the order’s counts refresh');
});

test('Cancel in Something wrong? marks nothing', async () => {
  const r = await receivePage();
  const { ui, within, fireEvent } = r;
  await scan(r, '4524667000001');
  const scanned = within(await ui.findByRole('list', { name: 'Scanned' }));
  fireEvent.click(scanned.getByRole('button', { name: 'Problem with Shimano brake pads' }));
  fireEvent.click(within(await ui.findByRole('dialog', { name: 'Something wrong?' })).getByRole('button', { name: 'Cancel' }));
  assert.ok(!scanned.getAllByRole('listitem')[0].textContent.includes('set aside'));
  assert.ok(ui.getByRole('button', { name: 'Book in 1 items' }));
});

test('a booking the server refuses says why and keeps the list', async () => {
  const r = await receivePage({ receiveReply: [400, { error: 'Cannot receive 1 of "Shimano brake pads" - only 0 outstanding' }] });
  await scan(r, '4524667000001');
  await r.ui.findByRole('list', { name: 'Scanned' });
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Book in 1 items' }));
  assert.ok((await r.ui.findByRole('alert')).textContent.includes('Cannot receive 1 of "Shimano brake pads" - only 0 outstanding'));
  assert.ok(r.ui.queryByRole('list', { name: 'Scanned' }) !== null);
});
