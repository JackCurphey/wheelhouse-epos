// A booking confirmed straight away (Jack, 19 Oct, docs/decisions/2026-10-19-auto-confirm.md;
// drawn as bk-staff-confirmed and diary.mjs blockMark): its diary block is
// marked "New, booked online" ("New online" in a narrow week column) until
// someone opens the job, which tells the server it was seen.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';
import { fakeJob } from '../helpers/fake-job.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const MECHANICS = [{ id: 11, name: 'Alex Morgan', isMechanic: true, isCashier: false, workingDays: [1, 2, 3, 4, 5], active: true }];
const CUSTOMER = { id: 5, name: 'Maya Patel', email: 'maya@example.test', phone: '07700 900142', active: true };
const ORDER = { id: 80, status: 'draft', total: 111, items: [
  { id: 1, name: 'Standard service', lineType: 'service', qty: 1, unitPrice: 75, lineTotal: 75 },
  { id: 2, name: 'Brake pads (pair)', lineType: 'product', qty: 2, unitPrice: 18, lineTotal: 36 },
] };

let JOB;
let OTHERS = [];
function job(over) {
  return fakeJob({
    id: 1, title: 'Standard service', reference: 'WH-1042', customerId: 5, customerName: 'Maya Patel', bikeId: 7, bikeLabel: 'Trek Domane AL 3',
    mechanicId: 11, mechanicName: 'Alex Morgan', jobDate: '2026-10-08', startTime: '10:00', endTime: '11:30', status: 'scheduled',
    bookingState: 'scheduled', custodyState: 'expected', workState: 'not_started', version: 3, notes: 'Check the rear hub too.', requested: null,
    customerDescription: 'Rear brake squeals and feels weak.', cancelledBy: null, cancelledAt: null, cancellationSeenAt: null,
    orderId: 80, orderStatus: 'draft', orderTotal: 111, createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z', ...over,
  });
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
  OTHERS = [];
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
    if (u.pathname === '/api/workshop-jobs') return reply(200, [JOB, ...OTHERS]);
    if (u.pathname === '/api/workshop-jobs/1') return reply(200, JOB);
    if (u.pathname === '/api/customers/5') return reply(200, CUSTOMER);
    if (u.pathname === '/api/sale-documents/80') return reply(200, ORDER);
    return reply(404, { error: 'Not found' });
  };
}

async function openDiary(over = {}, query = '?date=2026-10-05', setUp = null, first = /^Trek Domane AL 3, Standard service/) {
  JOB = job(over);
  uninstall = installDom(`http://localhost/workshop/diary${query}`);
  setUp?.(window);
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  stubServer();
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  const block = await ui.findByRole('button', { name: first });
  return { ...rtl, ui, block };
}
const seenPosts = () => calls.filter((c) => c.method === 'POST' && c.url.endsWith('/seen')).map((c) => c.url);

test('in a week column the block is marked New online, and its name says new, booked online', async () => {
  const { ui, block } = await openDiary({ newOnline: true });
  assert.ok(ui.getByRole('button', { name: /^Trek Domane AL 3, Standard service.*, new, booked online$/ }) === block);
  assert.ok(block.textContent.includes('New online'));
});

test('in the day view the mark reads New, booked online', async () => {
  const { block } = await openDiary({ newOnline: true }, '?date=2026-10-08&view=day');
  assert.ok(block.textContent.includes('New, booked online'));
});

test('a booking not marked new carries no mark', async () => {
  const { block } = await openDiary({ newOnline: false });
  assert.equal(/New online|new, booked online/.test(block.textContent), false);
});

test('opening the job tells the server it was seen, once', async () => {
  const { ui, fireEvent, block } = await openDiary({ newOnline: true });
  fireEvent.click(block);
  await ui.findByRole('dialog', { name: /Standard service/ });
  const { waitFor } = await import('@testing-library/react');
  await waitFor(() => assert.deepEqual(seenPosts(), ['/api/workshop-jobs/1/seen']));
});

test('opening a job not marked new tells the server nothing', async () => {
  const { ui, fireEvent, block } = await openDiary({ newOnline: false });
  fireEvent.click(block);
  await ui.findByRole('dialog', { name: /Standard service/ });
  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(seenPosts(), []);
});

// Fresh review, 21 Oct: the drawing's line rule, the No time row, and the phone.
test('a 30-minute booking shows the bike and the mark on its one line', async () => {
  const { block } = await openDiary({ newOnline: true, startTime: '10:00', endTime: '10:30' });
  assert.ok(block.textContent.includes('Trek Domane AL 3 · New online'));
});

test('a 45-minute booking shows the bike, then the mark, not the job', async () => {
  const { block } = await openDiary({ newOnline: true, startTime: '10:00', endTime: '10:45' });
  // The visible lines only: the screen-reader description names the job too.
  const seen = [...block.querySelectorAll(':scope > [aria-hidden="true"]')].map((el) => el.textContent);
  assert.deepEqual(seen.filter(Boolean), ['Trek Domane AL 3', 'New online']);
});

test('a booking with no time carries the mark on its No time chip', async () => {
  const { ui, block } = await openDiary({ newOnline: true, startTime: null, endTime: null });
  assert.ok(ui.getByRole('group', { name: 'No time' }).contains(block));
  assert.ok(block.textContent.includes('Trek Domane AL 3 · New online'));
});

test('on a phone the mark reads in full', async () => {
  const realMatch = globalThis.window?.matchMedia;
  const { block } = await openDiary({ newOnline: true }, '?date=2026-10-08', (w) => { w.matchMedia = (q) => ({ matches: q.includes('max-width'), media: q, addEventListener() {}, removeEventListener() {} }); });
  assert.ok(block.textContent.includes('New, booked online'));
  void realMatch;
});

// Not drawn (decided-while-building, 21 Oct, the mark on stacks and the month
// view): the closest pattern is the No time chip's "bike · mark".
const SIRRUS = (over = {}) => job({ id: 2, reference: 'WH-1043', title: 'Puncture repair', bikeLabel: 'Specialized Sirrus', customerName: 'Sam Reed', ...over });

test('a stack carries the mark when a job in it is new, and its name says which', async () => {
  OTHERS = [SIRRUS({ newOnline: true })];
  const { ui } = await openDiary({}, '?date=2026-10-05', null, /^2 jobs booked/);
  const stack = ui.getByRole('button', { name: /^2 jobs booked/ });
  assert.match(stack.getAttribute('aria-label'), /Specialized Sirrus · Puncture repair \(WH-1043\), new, booked online/);
  assert.ok(!/WH-1042\), new/.test(stack.getAttribute('aria-label')));
  assert.ok(stack.textContent.includes('New online'));
  const tiles = [...ui.container.querySelectorAll('[data-fan] button')];
  assert.deepEqual(tiles.map((t) => t.textContent.includes('New online')), [false, true]);
});

test('a stack with no new job carries no mark', async () => {
  OTHERS = [SIRRUS()];
  const { ui } = await openDiary({}, '?date=2026-10-05', null, /^2 jobs booked/);
  assert.ok(!ui.getByRole('button', { name: /^2 jobs booked/ }).textContent.includes('New online'));
});

test('in the month view a new job’s chip has the mark, and its name says new, booked online', async () => {
  OTHERS = [SIRRUS({ startTime: '14:00', endTime: '15:00' })];
  const { ui } = await openDiary({ newOnline: true }, '?date=2026-10-08&view=month', null, /^10:00, Trek Domane AL 3/);
  const chip = ui.getByRole('button', { name: /^10:00, Trek Domane AL 3/ });
  assert.match(chip.getAttribute('aria-label'), /, new, booked online$/);
  assert.ok(chip.querySelector('svg') !== null, 'the globe shows on the chip');
  const other = ui.getByRole('button', { name: /^14:00, Specialized Sirrus/ });
  assert.ok(!/new, booked online/.test(other.getAttribute('aria-label')));
  assert.ok(other.querySelector('svg') === null);
});
