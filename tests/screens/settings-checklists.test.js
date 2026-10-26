// Settings › Workshop › Checklists (Jack, 22 Oct, docs/decisions/2026-10-22-service-checklists.md;
// drawn as set-workshop-checklists, set-workshop-checklists-empty and
// set-workshop-checklist-edit): the shop's own checklists, the full service
// template, and the services each is used for.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const TEMPLATE = ['Frame & fork', 'Wheels & tyres', 'Tyre pressure', 'Brakes bled & adjusted', 'Gears indexed',
  'Chain & drivetrain', 'Bottom bracket', 'Headset', 'Cables & housing', 'Bolts torqued'];
const SERVICES = [
  { id: 3, name: 'Standard service', minutes: 60, price: 65, active: true },
  { id: 4, name: 'Safety check', minutes: 60, price: 30, active: true },
  { id: 5, name: 'Gear adjustment', minutes: 60, price: 20, active: true },
  // As the server sends a removed service (fresh review, 22 Oct).
  { id: 6, name: 'Old removed service', minutes: 30, price: 10, active: false },
];
const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let checklists;
let refuse;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

const FULL = { id: 7, name: 'Full service checklist', items: TEMPLATE, serviceIds: [3] };
async function openChecklists(list = [FULL]) {
  calls = [];
  checklists = list.map((c) => ({ ...c }));
  refuse = null;
  let next = 20;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [], bookingMode: 'timed', minNoticeMinutes: 120, confirmBookingsAutomatically: false, showSignOffToCustomers: false });
    if (u.pathname === '/api/shop-details') return reply(200, { name: 'North Street Cycles' });
    if (u.pathname === '/api/workshop-services') return reply(200, SERVICES);
    if (u.pathname === '/api/workshop-checklists' && method === 'GET') return reply(200, checklists);
    if (refuse && method !== 'GET') return reply(400, { error: refuse });
    if (u.pathname === '/api/workshop-checklists' && method === 'POST') {
      const made = body.template
        ? { id: next++, name: 'Full service checklist', items: TEMPLATE, serviceIds: [] }
        : { id: next++, name: body.name, items: body.items, serviceIds: body.serviceIds ?? [] };
      checklists = [...checklists, made];
      return reply(201, made);
    }
    const one = u.pathname.match(/^\/api\/workshop-checklists\/(\d+)$/);
    if (one && method === 'PUT') {
      checklists = checklists.map((c) => (c.id === Number(one[1]) ? { ...c, ...body } : c));
      return reply(200, checklists.find((c) => c.id === Number(one[1])));
    }
    if (one && method === 'DELETE') {
      checklists = checklists.filter((c) => c.id !== Number(one[1]));
      return { status: 204, ok: true, json: async () => null };
    }
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom('http://localhost/workshop/settings?room=workshop');
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByRole('heading', { level: 2, name: 'Workshop' });
  const fold = await ui.findByRole('button', { name: /^Checklists/ });
  if (fold.getAttribute('aria-expanded') !== 'true') rtl.fireEvent.click(fold);
  return { ...rtl, ui, fold };
}
const writes = () => calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.url} ${JSON.stringify(c.body ?? null)}`);

test('the fold lists each checklist with its items and the services it’s used for', async () => {
  const { ui, fold } = await openChecklists();
  await ui.findByText('Full service checklist', { selector: 'span' });
  assert.match(fold.textContent, /Full service checklist · 10 items/);
  assert.ok(ui.queryByText('10 items · used for Standard service') !== null);
  assert.ok(ui.queryByRole('button', { name: 'Edit Full service checklist' }) !== null);
  assert.ok(ui.queryByRole('button', { name: 'Remove Full service checklist' }) !== null);
  assert.ok(ui.queryByRole('button', { name: '+ New checklist' }) !== null);
  assert.ok(ui.queryByText('A job shows its service’s checklist on the job page, for the mechanic to tick.') !== null);
});

test('with none yet, one tap gives the full service template', async () => {
  const { ui, fireEvent, waitFor, fold } = await openChecklists([]);
  await ui.findByText(/^No checklists yet\./);
  assert.match(fold.textContent, /None yet/);
  assert.ok(ui.queryByText('The template has 10 items, from Frame & fork to Bolts torqued. You can change any of them after.') !== null);
  fireEvent.click(ui.getByRole('button', { name: 'Use the full service template' }));
  await waitFor(() => assert.deepEqual(writes(), ['POST /api/workshop-checklists {"template":true}']));
  await ui.findByText('10 items · not used for a service yet');
});

test('Edit opens the checklist: its name, items and Used for; Save sends the whole of it', async () => {
  const { ui, fireEvent, waitFor, within } = await openChecklists();
  fireEvent.click(await ui.findByRole('button', { name: 'Edit Full service checklist' }));
  const box = within(await ui.findByRole('dialog', { name: 'Full service checklist' }));
  assert.ok(box.queryByText('Its items, in the order the mechanic ticks them') !== null);
  assert.equal(box.getByLabelText('Name').value, 'Full service checklist');
  assert.deepEqual(TEMPLATE.map((_, i) => box.getByLabelText(`Item ${i + 1}`).value), TEMPLATE);
  const used = box.getByRole('group', { name: 'Used for' });
  assert.equal(within(used).getByLabelText('Standard service').checked, true);
  assert.equal(within(used).getByLabelText('Safety check').checked, false);
  assert.ok(box.queryByText('A service has one checklist at most. Jobs already started keep the checklist they began with.') !== null);
  assert.ok(within(used).queryByLabelText('Old removed service') === null, 'a removed service isn’t offered');

  fireEvent.change(box.getByLabelText('Name'), { target: { value: 'Service checklist' } });
  fireEvent.click(box.getByRole('button', { name: 'Remove Bolts torqued' }));
  fireEvent.click(box.getByRole('button', { name: '+ Add an item' }));
  fireEvent.change(box.getByLabelText('Item 10'), { target: { value: 'Lights' } });
  fireEvent.click(within(used).getByLabelText('Safety check'));
  fireEvent.click(box.getByRole('button', { name: 'Save checklist' }));
  await waitFor(() => assert.deepEqual(calls.filter((c) => c.method === 'PUT').map((c) => c.body), [
    { name: 'Service checklist', items: [...TEMPLATE.slice(0, 9), 'Lights'], serviceIds: [3, 4] },
  ]));
  await waitFor(() => assert.ok(ui.queryByRole('dialog') === null));
});

test('an item moves with the arrow keys on its handle', async () => {
  const { ui, fireEvent, within } = await openChecklists();
  fireEvent.click(await ui.findByRole('button', { name: 'Edit Full service checklist' }));
  const box = within(await ui.findByRole('dialog', { name: 'Full service checklist' }));
  fireEvent.keyDown(box.getByRole('button', { name: 'Move Frame & fork — drag, or use the arrow keys' }), { key: 'ArrowDown' });
  assert.deepEqual([box.getByLabelText('Item 1').value, box.getByLabelText('Item 2').value], ['Wheels & tyres', 'Frame & fork']);
  fireEvent.keyDown(box.getByRole('button', { name: 'Move Frame & fork — drag, or use the arrow keys' }), { key: 'ArrowUp' });
  assert.equal(box.getByLabelText('Item 1').value, 'Frame & fork');
});

test('+ Write your own and + New checklist open an empty checklist that saves as new', async () => {
  const { ui, fireEvent, waitFor, within } = await openChecklists([]);
  fireEvent.click(await ui.findByRole('button', { name: '+ Write your own' }));
  const box = within(await ui.findByRole('dialog', { name: 'New checklist' }));
  fireEvent.change(box.getByLabelText('Name'), { target: { value: 'Safety checklist' } });
  fireEvent.change(box.getByLabelText('Item 1'), { target: { value: 'Brakes' } });
  fireEvent.click(within(box.getByRole('group', { name: 'Used for' })).getByLabelText('Safety check'));
  fireEvent.click(box.getByRole('button', { name: 'Save checklist' }));
  await waitFor(() => assert.deepEqual(writes(), ['POST /api/workshop-checklists {"name":"Safety checklist","items":["Brakes"],"serviceIds":[4]}']));
  await ui.findByText('1 item · used for Safety check');
  fireEvent.click(ui.getByRole('button', { name: '+ New checklist' }));
  assert.ok(await ui.findByRole('dialog', { name: 'New checklist' }));
});

test('a refused save says why and keeps the box open; Cancel changes nothing', async () => {
  const { ui, fireEvent, within } = await openChecklists();
  fireEvent.click(await ui.findByRole('button', { name: 'Edit Full service checklist' }));
  const box = within(await ui.findByRole('dialog', { name: 'Full service checklist' }));
  refuse = 'Every item needs some words, or remove it.';
  fireEvent.click(box.getByRole('button', { name: 'Save checklist' }));
  assert.equal((await box.findByRole('alert')).textContent, 'Every item needs some words, or remove it.');
  fireEvent.click(box.getByRole('button', { name: 'Cancel' }));
  assert.ok(ui.queryByRole('dialog') === null);
});

test('Remove takes the checklist away', async () => {
  const { ui, fireEvent, waitFor } = await openChecklists();
  fireEvent.click(await ui.findByRole('button', { name: 'Remove Full service checklist' }));
  await waitFor(() => assert.deepEqual(writes(), ['DELETE /api/workshop-checklists/7 {}']));
  await ui.findByText(/^No checklists yet\./);
});
