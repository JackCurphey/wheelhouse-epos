// The job's checklist (Jack, 22 Oct, docs/decisions/2026-10-22-service-checklists.md;
// drawn as job-mechanic's "Full service checklist" bar and job-checklist,
// Workshop day 21, 39 and 58): the bar under Notes says how far through it
// is, and opens the checklist, where each item is ticked and any item noted.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';
import { fakeJob } from '../helpers/fake-job.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const TEMPLATE = ['Frame & fork', 'Wheels & tyres', 'Tyre pressure', 'Brakes bled & adjusted', 'Gears indexed',
  'Chain & drivetrain', 'Bottom bracket', 'Headset', 'Cables & housing', 'Bolts torqued'];
const NOTE = 'The rear pads are worn. We recommend replacing the pads and adjusting the brake.';

let JOB;
let CHECKLIST;
let refuse;
const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

// The drawing's checklist: eight of ten ticked, a note on the brakes.
function drawn() {
  const items = TEMPLATE.map((label, i) => ({ label, done: i < 8, note: i === 3 ? NOTE : null }));
  return counted({ name: 'Full service checklist', items });
}
function counted(c) {
  return { ...c, done: c.items.filter((i) => i.done).length, total: c.items.length, notes: c.items.filter((i) => i.note).length };
}

async function openJob({ over = {}, checklist = drawn() } = {}) {
  JOB = fakeJob({
    id: 1, title: 'Standard service', reference: 'WH-1042', customerId: 5, customerName: 'Maya Patel', bikeId: 7, bikeLabel: 'Trek Domane AL 3',
    mechanicId: 11, mechanicName: 'Alex Morgan', jobDate: '2026-10-08', startTime: '10:00', endTime: '11:30', version: 3,
    custodyState: 'in_shop', workState: 'in_progress', orderId: 80, orderStatus: 'open', orderTotal: 111,
    createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z', ...over,
  });
  CHECKLIST = checklist;
  refuse = null;
  calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/employees') return reply(200, [{ id: 11, name: 'Alex Morgan', isMechanic: true, workingDays: [1, 2, 3, 4, 5], active: true }]);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/workshop-waiting') return reply(200, { count: 0, items: [] });
    if (u.pathname === '/api/workshop-jobs') return reply(200, [JOB]);
    if (u.pathname === '/api/workshop-jobs/1') return reply(200, JOB);
    if (u.pathname === '/api/workshop-jobs/1/checklist') return reply(200, CHECKLIST);
    const item = u.pathname.match(/^\/api\/workshop-jobs\/1\/checklist\/items\/(\d+)$/);
    if (item && method === 'PUT') {
      if (refuse) return reply(refuse.status, refuse.body);
      const i = Number(item[1]);
      CHECKLIST = counted({ ...CHECKLIST, items: CHECKLIST.items.map((it, n) => (n === i ? { ...it, ...body } : it)) });
      return reply(200, CHECKLIST);
    }
    if (u.pathname === '/api/customers/5') return reply(200, { id: 5, name: 'Maya Patel', phone: '07700 900142', active: true });
    if (u.pathname === '/api/sale-documents/80') return reply(200, { id: 80, status: 'open', total: 111, items: [] });
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom('http://localhost/workshop/diary?date=2026-10-05');
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  rtl.fireEvent.click(await ui.findByRole('button', { name: /^Trek Domane AL 3, Standard service/ }));
  const dlg = rtl.within(await ui.findByRole('dialog', { name: /Standard service/ }));
  await rtl.waitFor(() => assert.ok(dlg.queryByText('Loading…') === null));
  return { ...rtl, ui, dlg };
}
async function openChecklist(opts) {
  const r = await openJob(opts);
  r.fireEvent.click(await r.dlg.findByRole('button', { name: /^Full service checklist/ }));
  const box = r.within(await r.ui.findByRole('dialog', { name: 'Full service checklist' }));
  return { ...r, box };
}
const puts = () => calls.filter((c) => c.method === 'PUT').map((c) => `${c.url.replace('/api/workshop-jobs/1/checklist/items/', '')} ${JSON.stringify(c.body)}`);

test('the bar under Notes says how far through the checklist is', async () => {
  const { dlg } = await openJob();
  const bar = await dlg.findByRole('button', { name: /^Full service checklist/ });
  assert.ok(bar.textContent.includes('Full service checklist'));
  assert.ok(bar.textContent.includes('8 of 10 done · 1 note'));
});

test('a job with no checklist shows no bar', async () => {
  const { dlg, waitFor } = await openJob({ checklist: null });
  await waitFor(() => assert.ok(calls.some((c) => c.url.endsWith('/checklist'))));
  assert.ok(dlg.queryByRole('button', { name: /checklist/i }) === null);
});

test('the checklist: its name, the job, the count, each item with a tick, the note where there is one', async () => {
  const { box } = await openChecklist();
  assert.ok(box.queryByText('Standard service · WH-1042 · Trek Domane AL 3') !== null);
  assert.ok(box.queryByText('8 of 10 done · 1 note') !== null);
  assert.deepEqual(TEMPLATE.map((label) => box.getByLabelText(label).checked), [true, true, true, true, true, true, true, true, false, false]);
  assert.ok(box.queryByText(NOTE) !== null);
  assert.ok(box.queryByRole('button', { name: 'Add a note for Brakes bled & adjusted' }) === null);
  assert.ok(box.queryByRole('button', { name: 'Add a note for Headset' }) !== null);
  assert.ok(box.queryByRole('button', { name: 'Close, back to the job' }) !== null);
});

test('ticking an item saves it at once, and the count follows', async () => {
  const { box, fireEvent, waitFor } = await openChecklist();
  fireEvent.click(box.getByLabelText('Cables & housing'));
  await waitFor(() => assert.deepEqual(puts(), ['8 {"done":true}']));
  await box.findByText('9 of 10 done · 1 note');
  fireEvent.click(box.getByLabelText('Frame & fork'));
  await waitFor(() => assert.deepEqual(puts().at(-1), '0 {"done":false}'));
});

test('+ Add note opens a box for that item, saved when the box is left', async () => {
  const { box, fireEvent, waitFor } = await openChecklist();
  fireEvent.click(box.getByRole('button', { name: 'Add a note for Headset' }));
  const note = box.getByLabelText('Note for Headset');
  fireEvent.change(note, { target: { value: 'Slight play, adjusted.' } });
  fireEvent.blur(note);
  await waitFor(() => assert.deepEqual(puts(), ['7 {"note":"Slight play, adjusted."}']));
  await box.findByText('8 of 10 done · 2 notes');
});

test('Done and the close button go back to the job, and the bar shows the new count', async () => {
  const { ui, dlg, box, fireEvent, waitFor } = await openChecklist();
  fireEvent.click(box.getByLabelText('Cables & housing'));
  await box.findByText('9 of 10 done · 1 note');
  fireEvent.click(box.getAllByRole('button', { name: 'Done' })[0]);
  await waitFor(() => assert.ok(ui.queryByRole('dialog', { name: 'Full service checklist' }) === null));
  assert.match(dlg.getByRole('button', { name: /^Full service checklist/ }).textContent, /9 of 10 done · 1 note/);
});

test('a refused tick says why and puts the tick back', async () => {
  const { box, fireEvent } = await openChecklist();
  refuse = { status: 409, body: { error: 'This work is finished, so its checklist can’t change. Reopen the work first.', code: 'illegal' } };
  fireEvent.click(box.getByLabelText('Cables & housing'));
  assert.equal((await box.findByRole('alert')).textContent, 'This work is finished, so its checklist can’t change. Reopen the work first.');
  assert.equal(box.getByLabelText('Cables & housing').checked, false);
});

test('finished work’s checklist can be read, not changed', async () => {
  const { box } = await openChecklist({ over: { workState: 'complete' } });
  assert.equal(box.getByLabelText('Cables & housing').disabled, true);
  assert.ok(box.queryByRole('button', { name: 'Add a note for Headset' }) === null);
  assert.ok(box.queryByText('Reopen the work to change its checklist.') !== null);
});
