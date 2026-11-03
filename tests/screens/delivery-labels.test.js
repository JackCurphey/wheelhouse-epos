// Print labels after a delivery is booked in (openspec/changes/delivery-labels;
// rs-labels, rs-booked, rs-booked-staff in receiving.mjs; receiving decision 8;
// Jack's 26 Oct answer 5, browser printing only). Example data from the
// drawing: Shimano brake pads B05S-RX; everything else stays a placeholder.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const JO = { ...OWNER, id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false };
const PADS = { id: 1, productId: 11, name: 'Shimano brake pads', sku: 'B05S-RX', barcode: '4524667000001', price: 28, qty: 2 };
const THING = { id: 2, productId: 12, name: '[Product]', sku: '[Supplier code]', barcode: null, price: 1.5, qty: 3 };
const DELIVERY = { id: 77, supplierId: 1, supplierName: '[Supplier]', items: 5, bookedInAt: new Date().toISOString(), bookedBy: 'Jack Lewis', lines: [THING, PADS], setAside: [], stillToCome: [], bookedCost: 0 };

const realFetch = globalThis.fetch;
let uninstall;
let shell;
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

async function open({ me = OWNER, delivery = DELIVERY, sizeStatus = 200 } = {}) {
  globalThis.fetch = async (url) => {
    const reply = (s, b) => ({ status: s, ok: s < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, me);
    if (u.pathname === '/api/deliveries/booked-in/77') return reply(200, delivery);
    if (u.pathname === '/api/label-settings') return sizeStatus === 200 ? reply(200, { widthMm: 50, heightMm: 25 }) : reply(sizeStatus, { error: 'No' });
    if (u.pathname.startsWith('/api/')) return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom('http://localhost/workshop/deliveries/delivery/77/booked');
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  rendered = true;
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByRole('heading', { level: 2, name: 'Booked in' });
  return { ...rtl, ui };
}
const openBox = async (r) => {
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Print labels' }));
  return r.within(await r.ui.findByRole('dialog', { name: 'Print labels' }));
};

test('Print labels: first for Staff, before the list; for the Owner beside Receive another delivery', async () => {
  const { bookedCost, ...forStaff } = DELIVERY; // eslint-disable-line no-unused-vars
  const staff = await open({ me: JO, delivery: forStaff });
  const button = staff.ui.getByRole('button', { name: 'Print labels' });
  const another = staff.ui.getByRole('link', { name: 'Receive another delivery' });
  assert.ok(staff.within(staff.ui.getByRole('main')).getByRole('status').compareDocumentPosition(button) & 4);
  assert.ok(button.parentElement !== another.parentElement, 'Staff have it above, on its own');
  staff.cleanup();
  shell.queryClient.clear();
  uninstall();
  const owner = await open();
  const b = owner.ui.getByRole('button', { name: 'Print labels' });
  assert.ok(b.parentElement === owner.ui.getByRole('link', { name: 'Receive another delivery' }).parentElement);
});

test('nothing booked in: no Print labels', async () => {
  const { ui } = await open({ delivery: { ...DELIVERY, items: 0, lines: [] } });
  assert.ok(ui.queryByRole('button', { name: 'Print labels' }) === null);
});

test('the box as drawn: what needs a label starts at what was received, its own barcode at 0', async () => {
  const r = await open();
  const box = await openBox(r);
  assert.ok(box.getByText('[Supplier] · booked in just now'));
  assert.ok(box.getByText('Set for what needs a label: products without their own barcode. Change any count.'));
  assert.ok(box.getByText('No barcode of its own · 3 received'));
  assert.ok(box.getByText('Has its own barcode · 2 received'));
  assert.equal(box.getByRole('textbox', { name: 'How many: Labels for [Product]' }).value, '3');
  assert.equal(box.getByRole('textbox', { name: 'How many: Labels for Shimano brake pads' }).value, '0');
  assert.ok(box.getByRole('button', { name: 'Print 3 labels' }));
  assert.ok(box.getByRole('button', { name: 'Cancel' }));
});

test('counts change by stepping and typing, down to 0; the button follows and is off at 0', async () => {
  const r = await open();
  const box = await openBox(r);
  r.fireEvent.click(box.getByRole('button', { name: 'One more: Labels for Shimano brake pads' }));
  assert.ok(box.getByRole('button', { name: 'Print 4 labels' }));
  r.fireEvent.change(box.getByRole('textbox', { name: 'How many: Labels for [Product]' }), { target: { value: '0' } });
  assert.equal(box.getByRole('textbox', { name: 'How many: Labels for [Product]' }).value, '0');
  assert.ok(box.getByRole('button', { name: 'Print 1 label' }));
  r.fireEvent.click(box.getByRole('button', { name: 'One fewer: Labels for Shimano brake pads' }));
  assert.equal(box.getByRole('textbox', { name: 'How many: Labels for Shimano brake pads' }).value, '0');
  assert.equal(box.getByRole('button', { name: 'Print 0 labels' }).disabled, true);
  // − at 0 stays at 0.
  r.fireEvent.click(box.getByRole('button', { name: 'One fewer: Labels for Shimano brake pads' }));
  assert.equal(box.getByRole('textbox', { name: 'How many: Labels for Shimano brake pads' }).value, '0');
});

test('Print sends one label per count, at the shop’s size, then the box closes', async () => {
  const r = await open();
  let printed = null;
  window.print = () => {
    const host = document.getElementById('wh-print');
    printed = {
      labels: [...host.querySelectorAll('article[aria-label="Label"]')].map((a) => ({ text: a.textContent, bars: a.querySelector('svg rect') !== null, width: a.style.width, height: a.style.height })),
      page: host.querySelector('style')?.textContent ?? '',
    };
  };
  const box = await openBox(r);
  r.fireEvent.click(box.getByRole('button', { name: 'One fewer: Labels for [Product]' }));
  r.fireEvent.click(box.getByRole('button', { name: 'One more: Labels for Shimano brake pads' }));
  await r.waitFor(() => assert.equal(box.getByRole('button', { name: 'Print 3 labels' }).disabled, false));
  r.fireEvent.click(box.getByRole('button', { name: 'Print 3 labels' }));
  assert.ok(printed !== null, 'the print window opened');
  assert.deepEqual(printed.labels.map((l) => l.text), [
    '[Product]£1.50[Supplier code]',
    '[Product]£1.50[Supplier code]',
    'Shimano brake pads£28.004524667000001',
  ], 'its barcode if it has one, otherwise its code');
  assert.ok(printed.labels.every((l) => l.bars), 'each has a barcode');
  assert.ok(printed.labels.every((l) => l.width === '50mm' && l.height === '25mm'), JSON.stringify(printed.labels[0]));
  assert.ok(printed.page.includes('size: 50mm 25mm'), printed.page);
  await r.waitFor(() => assert.ok(r.ui.queryByRole('dialog', { name: 'Print labels' }) === null));
});

test('a product with neither barcode nor code prints its name and price; a code Code 128 can’t draw prints in words', async () => {
  const r = await open({ delivery: { ...DELIVERY, supplierName: null, lines: [{ ...THING, sku: null }, { ...THING, id: 3, productId: 13, name: '[Product 2]', sku: 'ÅØ-é' }] } });
  let printed = null;
  window.print = () => { printed = [...document.querySelectorAll('#wh-print article[aria-label="Label"]')].map((a) => [a.textContent, a.querySelector('svg rect') !== null]); };
  const box = await openBox(r);
  assert.ok(box.getByText('Booked in just now'));
  r.fireEvent.change(box.getByRole('textbox', { name: 'How many: Labels for [Product]' }), { target: { value: '1' } });
  r.fireEvent.change(box.getByRole('textbox', { name: 'How many: Labels for [Product 2]' }), { target: { value: '1' } });
  await r.waitFor(() => assert.equal(box.getByRole('button', { name: 'Print 2 labels' }).disabled, false));
  r.fireEvent.click(box.getByRole('button', { name: 'Print 2 labels' }));
  assert.deepEqual(printed, [['[Product]£1.50', false], ['[Product 2]£1.50ÅØ-é', false]]);
});

test('if the label size can’t be loaded the box says so and won’t print', async () => {
  const r = await open({ sizeStatus: 404 });
  let printed = 0;
  window.print = () => { printed += 1; };
  const box = await openBox(r);
  assert.equal((await box.findByRole('alert')).textContent, 'Wheelhouse couldn’t load the label size. Try again in a moment.');
  const print = box.getByRole('button', { name: 'Print 3 labels' });
  assert.equal(print.disabled, true);
  r.fireEvent.click(print);
  assert.equal(printed, 0);
});

// The independent review, 3 Nov (openspec/changes/delivery-labels, design 3 and 2).
test('a barcode keeps a quiet zone each side, and is sized to fit: a long code fills the label, never more; a short one stays its size', async () => {
  const LONG = 'B05S-RX-0123456789-0123456789-0123456789';
  const r = await open({ delivery: { ...DELIVERY, lines: [{ ...THING, sku: LONG, qty: 1 }, { ...PADS, id: 3, barcode: null, sku: 'B05S-RX', qty: 1 }] } });
  let bars = null;
  window.print = () => {
    bars = [...document.querySelectorAll('#wh-print article[aria-label="Label"] svg')].map((svg) => {
      const view = Number(svg.getAttribute('viewBox').split(' ')[2]);
      // The bars sit in a group moved along by the quiet zone; a full-width rect is the white behind.
      const moved = Number(svg.querySelector('g').getAttribute('transform').match(/translate\(([\d.]+)/)[1]);
      const dark = [...svg.querySelectorAll('g rect')];
      const left = moved + Math.min(...dark.map((x) => Number(x.getAttribute('x'))));
      const right = moved + Math.max(...dark.map((x) => Number(x.getAttribute('x')) + Number(x.getAttribute('width'))));
      return { view, left, gapRight: view - right, width: svg.style.width };
    });
  };
  const box = await openBox(r);
  await r.waitFor(() => assert.equal(box.getByRole('button', { name: 'Print 2 labels' }).disabled, false));
  r.fireEvent.click(box.getByRole('button', { name: 'Print 2 labels' }));
  assert.equal(bars.length, 2);
  // 10 narrow bars of clear space (one narrow bar is 2 units) on both sides.
  for (const b of bars) assert.ok(b.left >= 20 && b.gapRight >= 20, JSON.stringify(b));
  assert.equal(bars[0].width, '50mm', 'a long code is the label’s width, no more');
  const short = Number(bars[1].width.replace('mm', ''));
  assert.ok(short > 0 && short < 50, bars[1].width);
});

test('a count stops at about ten times what came, 500 at most, and at least 10', async () => {
  const r = await open({ delivery: { ...DELIVERY, lines: [{ ...THING, qty: 3 }, { ...THING, id: 3, productId: 13, name: '[Product 2]', qty: 2000 }, { ...THING, id: 4, productId: 14, name: '[Product 3]', qty: 1 }] } });
  const box = await openBox(r);
  const typed = (name, value) => {
    const input = box.getByRole('textbox', { name: `How many: Labels for ${name}` });
    r.fireEvent.change(input, { target: { value } });
    return input.value;
  };
  assert.equal(typed('[Product]', '999'), '30');
  assert.equal(typed('[Product 2]', '999'), '500');
  assert.equal(typed('[Product 3]', '999'), '10');
});

test('the box says “booked in just now” only just after; reopened later it says the day', async () => {
  const later = await open({ delivery: { ...DELIVERY, bookedInAt: '2026-09-01T10:00:00.000Z' } });
  const box = await openBox(later);
  assert.ok(box.getByText('[Supplier] · booked in Tue 1 Sep'));
  assert.ok(box.queryByText(/just now/) === null);
  later.cleanup();
  shell.queryClient.clear();
  uninstall();
  const none = await open({ delivery: { ...DELIVERY, supplierName: null, bookedInAt: '2026-09-01T10:00:00.000Z' } });
  assert.ok((await openBox(none)).getByText('Booked in Tue 1 Sep'));
});

test('Cancel closes the box without printing', async () => {
  const r = await open();
  let printed = 0;
  window.print = () => { printed += 1; };
  const box = await openBox(r);
  r.fireEvent.click(box.getByRole('button', { name: 'Cancel' }));
  await r.waitFor(() => assert.ok(r.ui.queryByRole('dialog', { name: 'Print labels' }) === null));
  assert.equal(printed, 0);
});
