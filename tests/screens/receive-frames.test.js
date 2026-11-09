// Receiving a bike by its frame number (openspec/changes/frame-numbers, design 5; rs-frame,
// rs-frame-dup, rs-receive-marked; receiving decision 5 and its audit). Real example data from
// the drawings: the Trek Domane AL 3. Frame numbers and everything else are placeholders.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const JO = { id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const TREK = { id: 21, sku: '[Supplier code]', barcode: '[bike barcode]', name: 'Trek Domane AL 3', isBike: true };
const PADS = { id: 11, sku: 'B05S-RX', barcode: '[pads barcode]', name: 'Shimano brake pads', isBike: false };
const SUPPLIERS = [{ id: 1, name: '[Supplier]' }];
// An order of 3 bikes, to set one aside.
const ORDER = { id: 7, supplierId: 1, supplierName: '[Supplier]', status: 'ordered', reference: '', notes: '', orderedAt: '2026-09-01T10:00:00.000Z', createdAt: '2026-09-01T09:00:00.000Z', totalCost: 0,
  items: [{ id: 121, productId: 21, name: 'Trek Domane AL 3', sku: '[Supplier code]', qtyOrdered: 3, qtyReceived: 0, outstanding: 3, notComing: 0 }] };
const IN_STOCK = '[frame in stock]';

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let rendered = false;
afterEach(async () => {
  if (!rendered) return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
  rendered = false;
});

async function open({ orders = [] } = {}) {
  calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: String(url), method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, JO);
    if (u.pathname === '/api/products') {
      const q = (u.searchParams.get('search') ?? '').toLowerCase();
      return reply(200, [TREK, PADS].filter((p) => [p.name, p.sku, p.barcode].some((v) => v && v.toLowerCase().includes(q))));
    }
    if (u.pathname === '/api/stock-frames/check') {
      return reply(200, { inStock: u.searchParams.get('number') === IN_STOCK ? { frameNumber: IN_STOCK, productName: 'Trek Domane AL 3', bookedInAt: '2026-09-01T10:00:00.000Z' } : null });
    }
    if (u.pathname === '/api/purchase-orders' && method === 'GET') return reply(200, orders);
    if (u.pathname === '/api/suppliers') return reply(200, SUPPLIERS);
    if (u.pathname === '/api/deliveries/receive') return reply(200, { booked: 1, orders: [], deliveryId: 77 });
    if (u.pathname === '/api/deliveries/booked-in/77') return reply(200, { id: 77, supplierId: 1, supplierName: '[Supplier]', items: 1, bookedInAt: '2026-09-01T10:00:00.000Z', bookedBy: 'Jo Taylor', lines: [], setAside: [], stillToCome: [] });
    if (u.pathname.startsWith('/api/')) return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom(`http://localhost/workshop/deliveries/receive${orders.length ? '?order=7' : ''}`);
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  rendered = true;
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByRole('heading', { level: 2, name: 'Scan the box' });
  await ui.findByRole('searchbox', { name: 'Scan a barcode, or type to search' });
  return { ...rtl, ui };
}
function scan(r, code) {
  const box = r.ui.getByRole('searchbox', { name: 'Scan a barcode, or type to search' });
  r.fireEvent.change(box, { target: { value: code } });
  r.fireEvent.keyDown(box, { key: 'Enter' });
}
// The frame: scanned (Enter) or typed then Count this bike.
async function giveFrame(r, frame, { press = false } = {}) {
  const dialog = await r.ui.findByRole('dialog', { name: 'Frame number' });
  const box = r.within(dialog).getByRole('textbox', { name: 'Frame number' });
  r.fireEvent.change(box, { target: { value: frame } });
  if (press) r.fireEvent.click(r.within(dialog).getByRole('button', { name: 'Count this bike' }));
  else r.fireEvent.keyDown(box, { key: 'Enter' });
  return dialog;
}
const receives = () => calls.filter((c) => c.method === 'POST' && c.url.endsWith('/receive')).map((c) => { const { requestKey, ...body } = c.body; return body; });
const bikeLine = (r) => r.within(r.ui.getByRole('list', { name: 'Scanned' })).getByText('Trek Domane AL 3').closest('li');

test('scanning a bike asks for its frame number, as drawn, and the sticker counts it', async () => {
  const r = await open();
  scan(r, '[bike barcode]');
  const dialog = await r.ui.findByRole('dialog', { name: 'Frame number' });
  const d = r.within(dialog);
  assert.ok(d.getByText('Trek Domane AL 3 · bike 1 in this delivery'));
  assert.equal(d.getByRole('textbox', { name: 'Frame number' }).getAttribute('placeholder'), 'Scan the sticker on the frame, or type it');
  assert.ok(d.getByText('Scanning the sticker counts the bike straight away. A typed number needs “Count this bike”.'));
  assert.ok(d.getByText('Each bike is then known by its frame number — the till picks it at the sale, and its warranty starts from the right bike.'));
  assert.ok(d.getByRole('button', { name: 'Cancel' }));
  assert.ok(r.ui.queryByRole('list', { name: 'Scanned' }) === null, 'not counted yet');
  await giveFrame(r, '[frame 1]');
  await r.waitFor(() => assert.ok(r.ui.queryByRole('dialog', { name: 'Frame number' }) === null));
  assert.match(bikeLine(r).textContent, /\[Supplier code\] · not on an order · Frame \[frame 1\]/);
  assert.equal(r.ui.getByRole('textbox', { name: 'How many: Trek Domane AL 3' }).value, '1');
});

test('a typed frame counts with Count this bike, and the next bike is bike 2', async () => {
  const r = await open();
  scan(r, '[bike barcode]');
  await giveFrame(r, '[frame 1]', { press: true });
  await r.waitFor(() => assert.ok(r.ui.queryByRole('dialog', { name: 'Frame number' }) === null));
  scan(r, '[bike barcode]');
  assert.ok(await r.ui.findByText('Trek Domane AL 3 · bike 2 in this delivery'));
  await giveFrame(r, '[frame 2]');
  await r.waitFor(() => assert.match(bikeLine(r).textContent, /Frame \[frame 1\] · Frame \[frame 2\]/));
});

test('Cancel doesn’t count the bike', async () => {
  const r = await open();
  scan(r, '[bike barcode]');
  const dialog = await r.ui.findByRole('dialog', { name: 'Frame number' });
  r.fireEvent.click(r.within(dialog).getByRole('button', { name: 'Cancel' }));
  await r.waitFor(() => assert.ok(r.ui.queryByRole('dialog', { name: 'Frame number' }) === null));
  assert.ok(r.ui.queryByRole('list', { name: 'Scanned' }) === null);
});

test('a frame in stock, or already in this delivery, is warned and not counted', async () => {
  const r = await open();
  scan(r, '[bike barcode]');
  const dialog = await giveFrame(r, IN_STOCK);
  const alert = await r.within(dialog).findByRole('alert');
  assert.equal(alert.textContent, 'This frame number is already in stock — booked in 1 Sep 2026. Check the sticker, or scan the next bike.');
  assert.ok(r.ui.queryByRole('list', { name: 'Scanned' }) === null);
  await giveFrame(r, '[frame 1]');
  await r.waitFor(() => assert.ok(r.ui.queryByRole('dialog', { name: 'Frame number' }) === null));
  scan(r, '[bike barcode]');
  const again = await giveFrame(r, ' [FRAME 1] ');
  assert.equal((await r.within(again).findByRole('alert')).textContent, 'This frame number is already in this delivery.');
  assert.equal(r.ui.getByRole('textbox', { name: 'How many: Trek Domane AL 3' }).value, '1');
});

test('a bike’s count only goes up by scanning; stepping down takes off the last frame; Book in sends the frames', async () => {
  const r = await open();
  for (const f of ['[frame 1]', '[frame 2]']) {
    scan(r, '[bike barcode]');
    await giveFrame(r, f);
    await r.waitFor(() => assert.ok(r.ui.queryByRole('dialog', { name: 'Frame number' }) === null));
  }
  assert.ok(r.within(bikeLine(r)).getByText('Scan each bike for its frame number'));
  r.fireEvent.click(r.ui.getByRole('button', { name: 'One more: Trek Domane AL 3' }));
  assert.equal(r.ui.getByRole('textbox', { name: 'How many: Trek Domane AL 3' }).value, '2', 'no bike without a frame');
  r.fireEvent.click(r.ui.getByRole('button', { name: 'One fewer: Trek Domane AL 3' }));
  assert.equal(r.ui.getByRole('textbox', { name: 'How many: Trek Domane AL 3' }).value, '1');
  assert.doesNotMatch(bikeLine(r).textContent, /frame 2/);
  scan(r, '[pads barcode]');
  await r.waitFor(() => assert.ok(r.ui.getByText('Shimano brake pads')));
  assert.ok(r.ui.queryByRole('dialog', { name: 'Frame number' }) === null, 'pads aren’t a bike');
  r.fireEvent.click(r.ui.getByRole('button', { name: /^Book in/ }));
  await r.waitFor(() => assert.equal(receives().length, 1));
  assert.deepEqual(receives()[0].items, [{ productId: 21, qty: 1, frames: ['[frame 1]'] }, { productId: 11, qty: 1 }]);
});

test('a bike set aside leaves out the last frame scanned', async () => {
  const r = await open({ orders: [ORDER] });
  await r.ui.findByRole('list', { name: 'Still to come on the order' });
  for (const f of ['[frame 1]', '[frame 2]']) {
    scan(r, '[bike barcode]');
    await giveFrame(r, f);
    await r.waitFor(() => assert.ok(r.ui.queryByRole('dialog', { name: 'Frame number' }) === null));
  }
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Problem with Trek Domane AL 3' }));
  const box = await r.ui.findByRole('dialog', { name: 'Something wrong?' });
  r.fireEvent.click(r.within(box).getByRole('button', { name: 'Mark as damaged' }));
  await r.waitFor(() => assert.match(bikeLine(r).textContent, /Frame \[frame 2\], set aside/));
  r.fireEvent.click(r.ui.getByRole('button', { name: /^Book in/ }));
  await r.waitFor(() => assert.equal(receives().length, 1));
  assert.deepEqual(receives()[0].items, [{ productId: 21, itemId: 121, qty: 1, frames: ['[frame 1]'] }]);
});
