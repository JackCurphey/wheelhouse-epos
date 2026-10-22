// Storage slots on the screens (Workshop day 27; drawn as set-workshop-diary's
// Storage slots, till-book-in's "Where the bike is kept", the job page's
// "Kept on Hook 3" and the Overview's Custody column; openspec/changes/storage-slots).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';
import { fakeJob, changed } from '../helpers/fake-job.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
// The drawing's slots (diary.mjs STORAGE_SLOTS).
const SLOTS = ['Hook 1', 'Hook 2', 'Hook 3', 'Hook 4', 'Hook 5', 'Hook 6', 'Workshop floor', 'Front window'].map((name, i) => ({ id: i + 1, name }));

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let JOB;
let settings;
let slots;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

function stub() {
  calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/employees') return reply(200, [{ id: 11, name: 'Alex Morgan', isMechanic: true, workingDays: [1, 2, 3, 4, 5], active: true }]);
    if (u.pathname === '/api/workshop-settings' && method === 'PUT') { settings = { ...settings, ...body }; return reply(200, settings); }
    if (u.pathname === '/api/workshop-settings') return reply(200, settings);
    if (u.pathname === '/api/storage-slots' && method === 'POST') { const made = { id: 50, name: body.name.trim() }; slots = [...slots, made]; return reply(201, made); }
    const one = u.pathname.match(/^\/api\/storage-slots\/(\d+)$/);
    if (one && method === 'DELETE') { slots = slots.filter((s) => s.id !== Number(one[1])); return { status: 204, ok: true, json: async () => null }; }
    if (u.pathname === '/api/storage-slots') return reply(200, slots);
    if (u.pathname === '/api/workshop-waiting') return reply(200, { count: 0, items: [] });
    if (u.pathname === '/api/workshop-jobs/1/book-in') {
      const slot = SLOTS.find((s) => s.id === body.storageSlotId);
      JOB = fakeJob({ ...JOB, custodyState: 'in_shop', version: JOB.version + 1, storageSlotId: slot?.id ?? null, storageSlotName: slot?.name ?? null });
      return reply(200, changed(JOB));
    }
    if (u.pathname === '/api/workshop-jobs/1/storage-slot') {
      const slot = SLOTS.find((s) => s.id === body.storageSlotId);
      JOB = fakeJob({ ...JOB, storageSlotId: slot?.id ?? null, storageSlotName: slot?.name ?? null });
      return reply(200, changed(JOB));
    }
    if (u.pathname === '/api/workshop-jobs/1/checklist') return reply(200, null);
    if (u.pathname === '/api/workshop-jobs/1') return reply(200, JOB);
    if (u.pathname === '/api/workshop-jobs') return reply(200, u.searchParams.get('custody') === 'in_shop' ? (JOB.custodyState === 'in_shop' ? [JOB] : []) : [JOB]);
    if (u.pathname === '/api/customers/5') return reply(200, { id: 5, name: 'Maya Patel', phone: '07700 900142', active: true });
    if (u.pathname === '/api/sale-documents/80') return reply(200, { id: 80, status: 'open', total: 0, items: [] });
    return reply(404, { error: 'Not found' });
  };
}

async function open(path, { on = true, over = {} } = {}) {
  settings = { openingHours: [], storageSlotsOn: on, blockFirst: 'bike', blockSecond: 'jobTitle', showSignOffToCustomers: false, bookingMode: 'timed', minNoticeMinutes: 120, confirmBookingsAutomatically: false };
  slots = SLOTS.map((s) => ({ ...s }));
  JOB = fakeJob({
    id: 1, title: 'Standard service', reference: 'WH-1042', customerId: 5, customerName: 'Maya Patel', bikeId: 7, bikeLabel: 'Trek Domane AL 3',
    mechanicId: 11, mechanicName: 'Alex Morgan', jobDate: '2026-10-06', startTime: '10:00', endTime: '11:30', version: 3, orderId: 80,
    createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z', ...over,
  });
  stub();
  uninstall = installDom(`http://localhost${path}`);
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui };
}
async function openJob(opts) {
  const r = await open('/workshop/diary?date=2026-10-05', opts);
  r.fireEvent.click(await r.ui.findByRole('button', { name: /^Trek Domane AL 3, Standard service/ }));
  const dlg = r.within(await r.ui.findByRole('dialog', { name: /Standard service/ }));
  await r.waitFor(() => assert.ok(dlg.queryByText('Loading…') === null));
  return { ...r, dlg };
}
const writes = () => calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.url} ${JSON.stringify(c.body ?? null)}`);

// ---------- The job page ----------

test('Book in asks where the bike is kept; Done books it in on the slot chosen', async () => {
  const { ui, dlg, fireEvent, waitFor, within } = await openJob();
  fireEvent.click(dlg.getByRole('button', { name: 'Book in' }));
  const box = within(await ui.findByRole('dialog', { name: 'Book in · job WH-1042' }));
  assert.ok(box.queryByText('Maya Patel · Trek Domane AL 3 · Standard service') !== null);
  const kept = box.getByRole('radiogroup', { name: 'Where the bike is kept' });
  assert.deepEqual(within(kept).getAllByRole('radio').map((r) => r.textContent), SLOTS.map((s) => s.name));
  assert.ok(within(kept).getAllByRole('radio').every((r) => r.getAttribute('aria-checked') === 'false'), 'none chosen to start');
  fireEvent.click(within(kept).getByRole('radio', { name: 'Hook 3' }));
  fireEvent.click(box.getByRole('button', { name: 'Done' }));
  await waitFor(() => assert.deepEqual(writes(), ['POST /api/workshop-jobs/1/book-in {"storageSlotId":3,"version":3}']));
  await dlg.findByRole('button', { name: 'Kept on Hook 3' });
});

test('Not now books nothing; with slots off, Book in books in straight away', async () => {
  const first = await openJob();
  first.fireEvent.click(first.dlg.getByRole('button', { name: 'Book in' }));
  first.fireEvent.click(first.within(await first.ui.findByRole('dialog', { name: 'Book in · job WH-1042' })).getByRole('button', { name: 'Not now' }));
  assert.deepEqual(writes(), []);
  first.cleanup();
  shell.queryClient.clear();
  uninstall();
  const { dlg, fireEvent, waitFor, ui } = await openJob({ on: false });
  fireEvent.click(dlg.getByRole('button', { name: 'Book in' }));
  await waitFor(() => assert.deepEqual(writes(), ['POST /api/workshop-jobs/1/book-in {"version":3}']));
  assert.ok(ui.queryByRole('dialog', { name: 'Book in · job WH-1042' }) === null);
});

test('Kept on [slot] opens Where the bike is kept to move it', async () => {
  const { ui, dlg, fireEvent, waitFor, within } = await openJob({ over: { custodyState: 'in_shop', storageSlotId: 3, storageSlotName: 'Hook 3' } });
  fireEvent.click(await dlg.findByRole('button', { name: 'Kept on Hook 3' }));
  const box = within(await ui.findByRole('dialog', { name: 'Where the bike is kept' }));
  const kept = box.getByRole('radiogroup', { name: 'Where the bike is kept' });
  assert.equal(within(kept).getByRole('radio', { name: 'Hook 3' }).getAttribute('aria-checked'), 'true');
  fireEvent.click(within(kept).getByRole('radio', { name: 'Front window' }));
  fireEvent.click(box.getByRole('button', { name: 'Done' }));
  await waitFor(() => assert.deepEqual(writes(), ['PUT /api/workshop-jobs/1/storage-slot {"storageSlotId":8}']));
  await dlg.findByRole('button', { name: 'Kept on Front window' });
});

test('a bike in with no slot can be put on one', async () => {
  const { dlg } = await openJob({ over: { custodyState: 'in_shop' } });
  assert.ok(await dlg.findByRole('button', { name: 'Choose where it’s kept' }));
});

test('with slots off, a bike’s old slot shows nowhere: not on the job page, not on the Overview', async () => {
  const kept = { custodyState: 'in_shop', storageSlotId: 3, storageSlotName: 'Hook 3' };
  const r = await openJob({ on: false, over: kept });
  await r.dlg.findByText('Mechanic: Alex Morgan');
  assert.ok(r.dlg.queryByRole('button', { name: /Kept on|Choose where/ }) === null);
  r.cleanup();
  shell.queryClient.clear();
  uninstall();
  const { ui, fireEvent } = await open('/workshop/overview', { on: false, over: { ...kept, workState: 'in_progress', jobDate: '2026-09-01', mechanicId: null, mechanicName: null } });
  fireEvent.click(await ui.findByRole('button', { name: /^Shared queue · 1/ }));
  assert.ok((await ui.findAllByText('In the shop')).length > 0);
  assert.ok(ui.queryByText('Kept on Hook 3') === null);
});

test('tapping the chosen slot again takes the bike off it', async () => {
  const { ui, dlg, fireEvent, waitFor, within } = await openJob({ over: { custodyState: 'in_shop', storageSlotId: 3, storageSlotName: 'Hook 3' } });
  fireEvent.click(await dlg.findByRole('button', { name: 'Kept on Hook 3' }));
  const box = within(await ui.findByRole('dialog', { name: 'Where the bike is kept' }));
  fireEvent.click(box.getByRole('radio', { name: 'Hook 3' }));
  fireEvent.click(box.getByRole('button', { name: 'Done' }));
  await waitFor(() => assert.deepEqual(writes(), ['PUT /api/workshop-jobs/1/storage-slot {"storageSlotId":null}']));
});

test('the Bike is here switch asks where it’s kept too', async () => {
  const { ui, dlg, fireEvent } = await openJob();
  fireEvent.click(dlg.getByRole('switch', { name: 'Bike is here' }));
  assert.ok(await ui.findByRole('dialog', { name: 'Book in · job WH-1042' }));
});

test('the Overview’s Book in asks where the bike is kept, then books it in on that slot', async () => {
  // Expected today, so it's in Arrivals (the Overview reads the shop's today).
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  const { ui, fireEvent, waitFor, within } = await open('/workshop/overview', { over: { jobDate: today } });
  fireEvent.click(await ui.findByRole('button', { name: 'Book in WH-1042' }));
  const box = within(await ui.findByRole('dialog', { name: 'Book in · job WH-1042' }));
  fireEvent.click(box.getByRole('radio', { name: 'Hook 5' }));
  fireEvent.click(box.getByRole('button', { name: 'Done' }));
  await waitFor(() => assert.deepEqual(writes(), ['POST /api/workshop-jobs/1/book-in {"storageSlotId":5,"version":3}']));
});

// ---------- The Overview ----------

test('the Overview’s Custody says where a bike in the shop is kept', async () => {
  // In the shop with no mechanic yet, so it's in the Shared queue tab.
  const { ui, fireEvent } = await open('/workshop/overview', { over: { custodyState: 'in_shop', workState: 'in_progress', storageSlotId: 3, storageSlotName: 'Hook 3', jobDate: '2026-09-01', mechanicId: null, mechanicName: null } });
  fireEvent.click(await ui.findByRole('button', { name: /^Shared queue · 1/ }));
  assert.ok((await ui.findAllByText('Kept on Hook 3')).length > 0);
});

// ---------- Settings ----------

test('Settings › Storage slots: the switch, the slots, Remove and + Add a slot', async () => {
  const { ui, fireEvent, waitFor, within } = await open('/workshop/settings?room=workshop');
  const fold = await ui.findByRole('button', { name: /^Storage slots/ });
  await waitFor(() => assert.match(fold.textContent, /On · 8 slots/));
  fireEvent.click(fold);
  const sw = await ui.findByRole('switch', { name: 'Storage slots' });
  assert.equal(sw.getAttribute('aria-checked'), 'true');
  assert.ok(ui.queryByText('On for this shop. Staff can note where a bike is kept, and the diary block shows the slot where there’s room.') !== null);
  const list = within(ui.getByRole('list', { name: 'Slots' }));
  assert.deepEqual(list.getAllByRole('listitem').map((li) => li.textContent.replace(/Remove.*/, '').trim()), SLOTS.map((s) => s.name));
  fireEvent.click(list.getByRole('button', { name: 'Remove Hook 6' }));
  await waitFor(() => assert.deepEqual(writes(), ['DELETE /api/storage-slots/6 {}']));
  // The focus goes to the next chip's Remove, not off the page.
  await waitFor(() => assert.equal(document.activeElement?.getAttribute('aria-label'), 'Remove Workshop floor'));
  fireEvent.click(ui.getByRole('button', { name: '+ Add a slot' }));
  fireEvent.change(ui.getByLabelText('New slot'), { target: { value: 'Hook 7' } });
  fireEvent.click(ui.getByRole('button', { name: 'Add' }));
  await waitFor(() => assert.deepEqual(writes().at(-1), 'POST /api/storage-slots {"name":"Hook 7"}'));
  await ui.findByRole('button', { name: 'Remove Hook 7' });
  // The box stays open and empty for the next one (fewest clicks).
  await waitFor(() => assert.equal(ui.getByLabelText('New slot').value, ''));
  assert.equal(document.activeElement, ui.getByLabelText('New slot'));
  fireEvent.click(sw);
  await waitFor(() => assert.deepEqual(writes().at(-1), 'PUT /api/workshop-settings {"storageSlotsOn":false}'));
});
