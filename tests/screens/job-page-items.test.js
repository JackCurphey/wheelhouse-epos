// The staff job page, piece 3: work and parts (journey 12 decision 46; drawn
// as job-book-in / job-mechanic's "Add item, Scan barcode" toolbar). Lines
// live on the job's order; the server takes the whole list back each time
// (PUT /api/sale-documents/:id/items). Labour sorts above parts.
// Spec: docs/superpowers/specs/2026-10-03-staff-job-page-design.md (piece 3)
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const MECHANICS = [{ id: 11, name: 'Alex Morgan', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true }];
const SERVICES = [{ id: 1, name: 'Standard service', price: 75, minutes: 90, active: true, kind: 'full' }];
const PRODUCTS = [
  { id: 40, sku: 'BP-01', barcode: '5012345678900', name: 'Brake pads (pair)', price: 18, stockQty: 6, active: true },
  { id: 41, sku: 'TB-700', barcode: '5098765432100', name: 'Inner tube 700c', price: 6.5, stockQty: 0, active: true },
];
let ORDER;
const JOB = {
  id: 1, title: 'Standard service', reference: 'WH-1042', customerId: null, customerName: 'Maya Patel', bikeId: null, bikeLabel: 'Trek Domane AL 3',
  mechanicId: 11, mechanicName: 'Alex Morgan', jobDate: '2026-10-05', startTime: '10:00', endTime: '11:30', status: 'scheduled',
  bookingState: 'scheduled', custodyState: 'in_shop', workState: 'in_progress', version: 3, notes: null, requested: null,
  customerDescription: null, cancelledBy: null, cancelledAt: null, cancellationSeenAt: null, orderId: 80, orderStatus: 'open', orderTotal: 75,
  createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z',
  parts: [{ id: 21, position: 1, date: '2026-10-05', startTime: '10:00', endTime: '11:30', mechanicId: 11, mechanicName: 'Alex Morgan' }],
};

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let answer;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

function stubServer() {
  calls = [];
  answer = null;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ url, method, body: init.body ? JSON.parse(init.body) : undefined });
    const reply = (status, body) => ({ status, ok: status < 300, json: async () => body });
    const u = new URL(url, 'http://localhost');
    if (method === 'PUT' && u.pathname === '/api/sale-documents/80/items') return answer ?? reply(200, ORDER);
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/employees') return reply(200, MECHANICS);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/workshop-waiting') return reply(200, { count: 0, items: [] });
    if (u.pathname === '/api/workshop-jobs') return reply(200, [JOB]);
    if (u.pathname === '/api/workshop-jobs/1') return reply(200, JOB);
    if (u.pathname === '/api/sale-documents/80') return reply(200, ORDER);
    if (u.pathname === '/api/workshop-services') return reply(200, SERVICES);
    if (u.pathname === '/api/products') {
      const q = (u.searchParams.get('search') || '').toLowerCase();
      return reply(200, PRODUCTS.filter((p) => [p.name, p.sku, p.barcode].some((v) => v.toLowerCase().includes(q))));
    }
    return reply(404, { error: 'Not found' });
  };
}

async function openJob(order) {
  ORDER = order;
  uninstall = installDom('http://localhost/workshop/diary?date=2026-10-05');
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  stubServer();
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  rtl.fireEvent.click(await ui.findByRole('button', { name: /^Trek Domane AL 3, Standard service/ }));
  const dlg = rtl.within(await ui.findByRole('dialog', { name: /Standard service/ }));
  await rtl.waitFor(() => assert.equal(Boolean(dlg.queryByText('Loading…')), false));
  await dlg.findByRole('table');
  return { ...rtl, ui, dlg };
}

const LABOUR = { id: 1, productId: null, name: 'Standard service', sku: null, unitPrice: 75, qty: 1, lineTotal: 75, lineType: 'labour', serviceId: 1, minutes: 90 };
const PADS = { id: 2, productId: 40, name: 'Brake pads (pair)', sku: 'BP-01', unitPrice: 18, qty: 1, lineTotal: 18, lineType: 'product', serviceId: null, minutes: null };
const open = (items) => ({ id: 80, kind: 'order', status: 'open', subtotal: items.reduce((s, i) => s + i.lineTotal, 0), discount: 0, total: items.reduce((s, i) => s + i.lineTotal, 0), items });
const puts = () => calls.filter((c) => c.method === 'PUT').map((c) => JSON.stringify(c.body));
const has = (q) => Boolean(q);

test('labour sits above parts', async () => {
  const { dlg, within } = await openJob(open([PADS, LABOUR]));
  const rows = within(dlg.getByRole('table')).getAllByRole('row').map((r) => r.textContent);
  assert.match(rows[1], /Standard service/);
  assert.match(rows[2], /Brake pads/);
});

test('Add item finds a product and adds it to the job', async () => {
  const { dlg, fireEvent, waitFor } = await openJob(open([LABOUR]));
  fireEvent.click(dlg.getByRole('button', { name: 'Add item' }));
  fireEvent.change(dlg.getByLabelText('Search products or services, or scan a barcode'), { target: { value: 'brake' } });
  fireEvent.click(await dlg.findByRole('button', { name: /Brake pads \(pair\)/ }));
  await waitFor(() => assert.deepEqual(puts(), [JSON.stringify({ items: [
    { lineType: 'labour', name: 'Standard service', unitPrice: 75, minutes: 90, serviceId: 1 },
    { productId: 40, qty: 1, unitPrice: 18 },
  ] })]));
});

test('a service is added as labour', async () => {
  const { dlg, fireEvent, waitFor } = await openJob(open([]));
  fireEvent.click(dlg.getByRole('button', { name: 'Add item' }));
  fireEvent.change(dlg.getByLabelText('Search products or services, or scan a barcode'), { target: { value: 'service' } });
  fireEvent.click(await dlg.findByRole('button', { name: /Standard service · £75.00/ }));
  await waitFor(() => assert.deepEqual(puts(), [JSON.stringify({ items: [{ lineType: 'labour', serviceId: 1 }] })]));
});

test('scanning a barcode adds that product straight away', async () => {
  const { dlg, fireEvent, waitFor } = await openJob(open([]));
  fireEvent.click(dlg.getByRole('button', { name: 'Add item' }));
  const box = dlg.getByLabelText('Search products or services, or scan a barcode');
  fireEvent.change(box, { target: { value: '5098765432100' } });
  await dlg.findByRole('button', { name: /Inner tube 700c/ });
  fireEvent.keyDown(box, { key: 'Enter' });
  await waitFor(() => assert.deepEqual(puts(), [JSON.stringify({ items: [{ productId: 41, qty: 1, unitPrice: 6.5 }] })]));
});

test('a part\'s quantity can be changed, and a line removed', async () => {
  const { dlg, fireEvent, waitFor } = await openJob(open([LABOUR, PADS]));
  fireEvent.change(dlg.getByLabelText('Quantity of Brake pads (pair)'), { target: { value: '2' } });
  fireEvent.blur(dlg.getByLabelText('Quantity of Brake pads (pair)'));
  await waitFor(() => assert.equal(puts().length, 1));
  assert.deepEqual(JSON.parse(puts()[0]).items[1], { productId: 40, qty: 2, unitPrice: 18 });
  fireEvent.click(dlg.getByRole('button', { name: 'Remove Standard service' }));
  await waitFor(() => assert.equal(puts().length, 2));
  assert.deepEqual(JSON.parse(puts()[1]).items, [{ productId: 40, qty: 1, unitPrice: 18 }]);
});

test('if the server refuses, it says why', async () => {
  const { dlg, fireEvent } = await openJob(open([]));
  answer = { status: 400, ok: false, json: async () => ({ error: 'This order is already completed' }) };
  fireEvent.click(dlg.getByRole('button', { name: 'Add item' }));
  fireEvent.change(dlg.getByLabelText('Search products or services, or scan a barcode'), { target: { value: 'brake' } });
  fireEvent.click(await dlg.findByRole('button', { name: /Brake pads \(pair\)/ }));
  assert.ok(has(await dlg.findByText('This order is already completed')));
});

test('a paid order cannot be changed here', async () => {
  const { dlg } = await openJob({ ...open([LABOUR]), status: 'completed' });
  assert.equal(has(dlg.queryByRole('button', { name: 'Add item' })), false);
  assert.equal(has(dlg.queryByRole('button', { name: 'Remove Standard service' })), false);
});
