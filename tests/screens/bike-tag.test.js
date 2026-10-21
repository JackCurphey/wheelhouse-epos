// The bike tag (Jack, 21 Oct, docs/decisions/2026-10-21-bike-tag.md; drawn as
// job-book-in-print and job-bike-tag; openspec/changes/bike-tag): once the
// bike is in, the job page's printer button prints only the tag, on the
// computer's own printer, as receipts do.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const MECHANICS = [{ id: 11, name: 'Alex Morgan', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true }];
const CUSTOMER = { id: 5, name: 'Maya Patel', email: 'maya@example.test', phone: '07700 900142', active: true };
const ORDER = { id: 80, status: 'draft', total: 111, items: [
  { id: 1, name: 'Standard service', lineType: 'service', qty: 1, unitPrice: 75, lineTotal: 75 },
  { id: 2, name: 'Brake pads (pair)', lineType: 'product', qty: 2, unitPrice: 18, lineTotal: 36 },
] };

let JOB;
function job(over) {
  return {
    id: 1, title: 'Standard service', reference: 'WH-1042', customerId: 5, customerName: 'Maya Patel', bikeId: 7, bikeLabel: 'Trek Domane AL 3',
    mechanicId: 11, mechanicName: 'Alex Morgan', jobDate: '2026-10-08', startTime: '10:00', endTime: '11:30', status: 'scheduled',
    bookingState: 'scheduled', custodyState: 'expected', workState: 'not_started', version: 3, notes: 'Check the rear hub too.', requested: null,
    customerDescription: 'Rear brake squeals and feels weak.', cancelledBy: null, cancelledAt: null, cancellationSeenAt: null,
    orderId: 80, orderStatus: 'draft', orderTotal: 111, createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z', ...over,
  };
}

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
    if (method === 'POST') return answer ?? reply(200, { ...JOB, version: JOB.version + 1 });
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/employees') return reply(200, MECHANICS);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/workshop-waiting') return reply(200, { count: 0, items: [] });
    if (u.pathname === '/api/workshop-jobs') return reply(200, [JOB]);
    if (u.pathname === '/api/workshop-jobs/1') return reply(200, JOB);
    if (u.pathname === '/api/customers/5') return reply(200, CUSTOMER);
    if (u.pathname === '/api/sale-documents/80') return reply(200, ORDER);
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
  const block = await ui.findByRole('button', { name: /^Trek Domane AL 3, Standard service/ });
  rtl.fireEvent.click(block);
  await ui.findByRole('dialog', { name: /Standard service/ });
  return { ...rtl, ui };
}

const TAG = new URL('../../.test-build/screens/diary/bike-tag.js', import.meta.url).href;
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

test('the tag: the job number, its barcode, the customer and the bike', async () => {
  uninstall = installDom('http://localhost/workshop/diary');
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  const { BikeTagPaper } = await importFresh(TAG);
  const ui = rtl.render(createElement(BikeTagPaper, { reference: 'WH-1042', customerName: 'Maya Patel', bikeLabel: 'Trek Domane AL 3' }));
  const tag = ui.getByRole('article', { name: 'Bike tag' });
  assert.deepEqual([...tag.children].filter((c) => c.tagName !== 'svg').map((c) => c.textContent), ['WH-1042', 'Maya Patel', 'Trek Domane AL 3']);
  const bars = tag.querySelector('svg[aria-label="Barcode for job WH-1042"]');
  assert.ok(bars !== null);
  assert.ok(bars.querySelectorAll('rect').length > 10);
});

test('a tag with no customer or bike has the number and barcode alone', async () => {
  uninstall = installDom('http://localhost/workshop/diary');
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  const { BikeTagPaper } = await importFresh(TAG);
  const ui = rtl.render(createElement(BikeTagPaper, { reference: 'WH-1050', customerName: null, bikeLabel: null }));
  assert.equal(text(ui.getByRole('article', { name: 'Bike tag' })), 'WH-1050');
});

test('once the bike is in, Print bike tag prints only the tag', async () => {
  const { ui, fireEvent } = await openJob({ custodyState: 'in_shop' });
  let printed = null;
  window.print = () => { printed = document.getElementById('wh-print')?.textContent ?? null; };
  fireEvent.click(await ui.findByRole('button', { name: 'Print bike tag' }));
  assert.equal(printed, 'WH-1042Maya PatelTrek Domane AL 3');
  assert.ok(document.querySelector('#wh-print article[aria-label="Bike tag"] svg rect') !== null);
});

test('the button sits before Message, as drawn', async () => {
  const { ui } = await openJob({ custodyState: 'in_shop' });
  const print = await ui.findByRole('button', { name: 'Print bike tag' });
  const message = ui.getByRole('button', { name: 'Message Maya Patel' });
  assert.ok(print.compareDocumentPosition(message) & 4);
});

for (const custodyState of ['expected', 'collected']) {
  test(`a bike ${custodyState === 'expected' ? 'not in yet' : 'already collected'} has no Print bike tag`, async () => {
    const { ui } = await openJob({ custodyState });
    await ui.findByRole('button', { name: 'Message Maya Patel' });
    assert.ok(ui.queryByRole('button', { name: 'Print bike tag' }) === null);
  });
}

test('a job with no customer still offers Print bike tag, and no Message', async () => {
  const { ui } = await openJob({ custodyState: 'in_shop', customerId: null, customerName: null });
  assert.ok(await ui.findByRole('button', { name: 'Print bike tag' }));
  assert.ok(ui.queryByRole('button', { name: /^Message/ }) === null);
});

// Fresh review, 21 Oct: a job with no number has nothing for a tag to say.
test('a job with no number has no Print bike tag', async () => {
  const { ui } = await openJob({ custodyState: 'in_shop', reference: null });
  await ui.findByRole('button', { name: 'Message Maya Patel' });
  assert.ok(ui.queryByRole('button', { name: 'Print bike tag' }) === null);
});

test('the tag is 54 mm wide and wraps long words, for a 62 mm label', async () => {
  uninstall = installDom('http://localhost/workshop/diary');
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  const { BikeTagPaper } = await importFresh(TAG);
  const ui = rtl.render(createElement(BikeTagPaper, { reference: 'WH-1042', customerName: 'Maya Patel', bikeLabel: 'Trek Domane AL 3' }));
  const tag = ui.getByRole('article', { name: 'Bike tag' });
  assert.match(tag.className, /w-\[54mm\]/);
  assert.match(tag.className, /break-words/);
});
