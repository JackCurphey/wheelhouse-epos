// The job page's "Files and photos" and "Delete job" (Jack, 18 Oct,
// docs/decisions/2026-10-18-attachments-and-delete.md): files under Notes,
// photos as pictures; "Delete job" small in the bottom bar, asking first, or
// "Settle up first" while money has been paid on the order or the bike is in.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const MECHANICS = [
  { id: 11, name: 'Alex Morgan', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true },
  { id: 12, name: 'Jo Taylor', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true },
];
const CUSTOMERS = [
  { id: 5, name: 'Maya Patel', phone: '[phone]', email: null },
  { id: 9, name: 'Oliver Chen', phone: null, email: null },
];
const BIKES = {
  5: [{ id: 7, make: 'Trek', model: 'Domane', colour: null }],
  9: [{ id: 30, make: 'Brompton', model: 'C Line', colour: null }],
};
let JOB;
let FILES = [];
function job(over) {
  return {
    id: 1, title: 'Brake service', reference: 'WH-1001', customerId: 5, customerName: 'Maya Patel', bikeId: 7, bikeLabel: 'Trek Domane',
    mechanicId: 11, mechanicName: 'Alex Morgan', jobDate: '2026-10-06', startTime: '10:00', endTime: '11:00', status: 'scheduled',
    bookingState: 'scheduled', custodyState: 'expected', workState: 'not_started', version: 3, notes: null, requested: null,
    customerDescription: null, cancelledBy: null, cancelledAt: null, cancellationSeenAt: null, orderId: null, orderStatus: null, orderTotal: null,
    createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z', ...over,
  };
}

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let answer;
afterEach(async () => {
  FILES = [];
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
    if (method !== 'GET') return answer ?? reply(method === 'POST' ? 201 : 200, method === 'POST' ? { id: 9, workshopJobId: 1, originalName: 'new.pdf', contentType: 'application/pdf', sizeBytes: 10, uploadedAt: '2026-10-05T10:00:00Z', fromCustomer: false } : { ok: true });
    if (u.pathname === '/api/workshop-jobs/1/attachments') return reply(200, FILES);
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/employees') return reply(200, MECHANICS);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/workshop-waiting') return reply(200, { count: 0, items: [] });
    if (u.pathname === '/api/workshop-jobs') return reply(200, [JOB]);
    if (u.pathname === '/api/workshop-jobs/1') return reply(200, JOB);
    if (u.pathname === '/api/customers') {
      const q = (u.searchParams.get('search') ?? '').toLowerCase();
      return reply(200, CUSTOMERS.filter((c) => c.name.toLowerCase().includes(q)));
    }
    const one = u.pathname.match(/^\/api\/customers\/(\d+)$/);
    if (one) return reply(200, CUSTOMERS.find((c) => c.id === Number(one[1])));
    const bikes = u.pathname.match(/^\/api\/customers\/(\d+)\/bikes$/);
    if (bikes) return reply(200, BIKES[bikes[1]] ?? []);
    return reply(404, { error: 'Not found' });
  };
}

async function openJob(over = {}) {
  JOB = job(over);
  uninstall = installDom('http://localhost/workshop/diary?date=2026-10-05');
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  stubServer();
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  rtl.fireEvent.click((await ui.findAllByRole('button', { name: /^Trek Domane/ }))[0]);
  const page = rtl.within(await ui.findByRole('dialog', { name: new RegExp(JOB.title) }));
  return { ...rtl, ui, page };
}
const sent = (method) => calls.filter((c) => c.method === method);
const has = (q) => Boolean(q);

test('Files and photos lists photos as pictures, the customer\'s marked, and other files by name and size', async () => {
  FILES = [
    { id: 1, workshopJobId: 1, originalName: 'brake.jpg', contentType: 'image/jpeg', sizeBytes: 1000, uploadedAt: '2026-10-03T09:00:00Z', fromCustomer: true },
    { id: 2, workshopJobId: 1, originalName: 'report.pdf', contentType: 'application/pdf', sizeBytes: 20480, uploadedAt: '2026-10-02T09:00:00Z', fromCustomer: false },
  ];
  const { page, within } = await openJob();
  const files = within(await page.findByRole('region', { name: 'Files and photos' }));
  const img = await files.findByRole('img', { name: 'brake.jpg' });
  assert.equal(img.getAttribute('src'), '/api/workshop-jobs/1/attachments/1');
  assert.ok(has(files.queryByText('From the customer')));
  assert.ok(has(files.queryByText('report.pdf')));
  assert.ok(has(files.queryByText('· 20 KB')));
});

test('Add file or photo uploads the file as the server expects', async () => {
  const { page, fireEvent, waitFor, within } = await openJob();
  const files = within(await page.findByRole('region', { name: 'Files and photos' }));
  const input = files.getByLabelText('Add file or photo');
  const file = new window.File(['hello'], 'note.txt', { type: 'text/plain' });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => assert.equal(sent('POST').length, 1));
  assert.deepEqual(sent('POST')[0].body, { filename: 'note.txt', contentType: 'text/plain', dataBase64: 'aGVsbG8=' });
});

test('a file over 15MB is refused before sending', async () => {
  const { page, fireEvent, within } = await openJob();
  const files = within(await page.findByRole('region', { name: 'Files and photos' }));
  const big = new window.File([new Uint8Array(15 * 1024 * 1024 + 1)], 'huge.mov', { type: 'video/quicktime' });
  fireEvent.change(files.getByLabelText('Add file or photo'), { target: { files: [big] } });
  assert.ok(has(await files.findByText('That file is too large (max 15MB).')));
  assert.equal(sent('POST').length, 0);
});

test('Remove asks first, then removes the file', async () => {
  FILES = [{ id: 2, workshopJobId: 1, originalName: 'report.pdf', contentType: 'application/pdf', sizeBytes: 2048, uploadedAt: '2026-10-02T09:00:00Z', fromCustomer: false }];
  const { ui, page, fireEvent, waitFor, within } = await openJob();
  const files = within(await page.findByRole('region', { name: 'Files and photos' }));
  fireEvent.click(await files.findByRole('button', { name: 'Remove report.pdf' }));
  const ask = within(await ui.findByRole('dialog', { name: 'Remove report.pdf?' }));
  fireEvent.click(ask.getByRole('button', { name: 'Remove' }));
  await waitFor(() => assert.deepEqual(sent('DELETE').map((c) => c.url), ['/api/workshop-jobs/1/attachments/2']));
});

test('Delete job asks first, then deletes the job and closes its page', async () => {
  const { ui, page, fireEvent, waitFor, within } = await openJob();
  fireEvent.click(await page.findByRole('button', { name: 'Delete job' }));
  const ask = within(await ui.findByRole('dialog', { name: 'Delete Brake service?' }));
  assert.ok(has(ask.queryByText('The job, its diary time and its files and photos are removed. This can’t be undone.')));
  fireEvent.click(ask.getByRole('button', { name: 'Delete job' }));
  await waitFor(() => assert.deepEqual(sent('DELETE').map((c) => c.url), ['/api/workshop-jobs/1']));
  await waitFor(() => assert.equal(has(ui.queryByRole('dialog', { name: /Brake service/ })), false));
});

test('Keep the job deletes nothing', async () => {
  const { ui, page, fireEvent, within } = await openJob();
  fireEvent.click(await page.findByRole('button', { name: 'Delete job' }));
  fireEvent.click(within(await ui.findByRole('dialog', { name: 'Delete Brake service?' })).getByRole('button', { name: 'Keep the job' }));
  assert.equal(sent('DELETE').length, 0);
});

test('a paid order or a bike in the shop says Settle up first, and deletes nothing', async () => {
  const { ui, page, fireEvent, within } = await openJob({ orderId: 40, orderStatus: 'converted', orderTotal: 65, custodyState: 'in_shop' });
  fireEvent.click(await page.findByRole('button', { name: 'Delete job' }));
  const box = within(await ui.findByRole('dialog', { name: 'Settle up first' }));
  assert.ok(has(box.queryByText('Paid on its order')));
  assert.ok(has(box.queryByText('£65.00')));
  assert.ok(has(box.queryByText('Bike in the shop')));
  assert.ok(has(box.queryByText('Refund what was paid and hand the bike back — then delete.')));
  assert.equal(sent('DELETE').length, 0);
});

test('a job with no next step still has Delete job in its bottom bar', async () => {
  const { page } = await openJob({ workState: 'complete', custodyState: 'collected' });
  assert.ok(has(await page.findByRole('button', { name: 'Delete job' })));
});

test('if the server says settle up first, the page says so', async () => {
  const { ui, page, fireEvent, within } = await openJob();
  answer = { status: 409, ok: false, json: async () => ({ error: 'Settle up first: refund what was paid and hand the bike back, then delete.', code: 'settle_first', paid: true, inShop: false }) };
  fireEvent.click(await page.findByRole('button', { name: 'Delete job' }));
  fireEvent.click(within(await ui.findByRole('dialog', { name: 'Delete Brake service?' })).getByRole('button', { name: 'Delete job' }));
  // It names what the server said is open: here, money paid, not the bike.
  const box = within(await ui.findByRole('dialog', { name: 'Settle up first' }));
  assert.ok(has(box.queryByText('Paid on its order')));
  assert.ok(has(box.queryByText('Refund what was paid — then delete.')));
  assert.equal(has(box.queryByText('Bike in the shop')), false);
});

// Jack, 18 Oct (docs/decisions/2026-10-18-till-job-payment.md; drawn on
// job-finished): finished work whose order isn't paid offers "Take payment",
// which opens the till with the job; paying records the hand-over.
test('finished, unpaid work offers Take payment, which opens the till', async () => {
  const { page, fireEvent, waitFor } = await openJob({ workState: 'complete', custodyState: 'in_shop', orderId: 40, orderStatus: 'open' });
  fireEvent.click(await page.findByRole('button', { name: 'Take payment' }));
  assert.equal(page.queryAllByRole('button', { name: 'Hand over' }).length, 0);
  await waitFor(() => assert.equal(`${window.location.pathname}${window.location.search}`, '/workshop/till?job=1'));
});

test('finished work already paid still offers Hand over', async () => {
  const { page } = await openJob({ workState: 'complete', custodyState: 'in_shop', orderId: 40, orderStatus: 'converted' });
  assert.ok(has(await page.findByRole('button', { name: 'Hand over' })));
  assert.equal(page.queryAllByRole('button', { name: 'Take payment' }).length, 0);
});
