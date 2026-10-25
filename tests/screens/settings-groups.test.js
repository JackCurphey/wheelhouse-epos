// Settings › Front desk › Payments › Customer groups (openspec/changes/customer-groups-settings;
// drawn as cs-groups in customer.mjs; customer service review decision 8).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let groups;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

async function openGroups(start = [{ id: 3, name: 'Club members', discountPercent: 10, customerCount: 3 }]) {
  calls = [];
  groups = start.map((g) => ({ ...g }));
  let next = 20;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/shop-details') return reply(200, { name: 'North Street Cycles' });
    if (u.pathname === '/api/message-templates') return reply(200, []);
    if (u.pathname === '/api/customer-groups' && method === 'GET') return reply(200, groups);
    if (u.pathname === '/api/customer-groups' && method === 'POST') {
      const made = { id: next++, name: body.name, discountPercent: Number(body.discountPercent), customerCount: 0 };
      groups = [...groups, made];
      return reply(201, made);
    }
    const one = u.pathname.match(/^\/api\/customer-groups\/(\d+)$/);
    if (one && method === 'PUT') {
      groups = groups.map((g) => (g.id === Number(one[1]) ? { ...g, name: body.name, discountPercent: Number(body.discountPercent) } : g));
      return reply(200, groups.find((g) => g.id === Number(one[1])));
    }
    if (one && method === 'DELETE') {
      groups = groups.filter((g) => g.id !== Number(one[1]));
      return reply(200, { ok: true });
    }
    return reply(200, []);
  };
  uninstall = installDom('http://localhost/workshop/settings?room=front-desk');
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByRole('heading', { level: 3, name: 'Payments' });
  const fold = await ui.findByRole('button', { name: /^Customer groups/ });
  if (fold.getAttribute('aria-expanded') !== 'true') rtl.fireEvent.click(fold);
  await ui.findByRole('button', { name: '+ Add a group' });
  return { ...rtl, ui, fold };
}
const writes = () => calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.url} ${JSON.stringify(c.body ?? null)}`);

test('Payments sits after Till in Front desk, with Customer groups and its drawn summary', async () => {
  const { ui, fold } = await openGroups();
  assert.match(fold.textContent, /Club members/);
  const payments = ui.getByRole('heading', { level: 3, name: 'Payments' });
  const till = ui.getByRole('heading', { level: 3, name: 'Till' });
  assert.ok(till.compareDocumentPosition(payments) & Node.DOCUMENT_POSITION_FOLLOWING, 'Payments after Till');
});

test('each group shows its name, how many customers, its discount and Edit, with the drawn note', async () => {
  const { ui } = await openGroups();
  assert.ok(ui.getAllByText('Club members').length >= 2, 'the row, and the fold’s summary');
  assert.ok(ui.getByText('3 customers'));
  assert.ok(ui.getByText('10% off'));
  assert.ok(ui.getByRole('button', { name: 'Edit Club members' }));
  assert.ok(ui.getByText('The till gives the discount by itself when a group member is added to a sale, with the group as the reason.'));
});

test('+ Add a group opens an empty box; Save adds it', async () => {
  const { ui, fireEvent, waitFor, within } = await openGroups([]);
  fireEvent.click(ui.getByRole('button', { name: '+ Add a group' }));
  const box = within(await ui.findByRole('dialog', { name: 'Add a group' }));
  fireEvent.change(box.getByLabelText('Name'), { target: { value: 'Blue Light' } });
  fireEvent.change(box.getByLabelText('% off'), { target: { value: '15' } });
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.deepEqual(writes(), ['POST /api/customer-groups {"name":"Blue Light","discountPercent":15}']));
  assert.ok(await ui.findByText('0 customers'));
  assert.ok(ui.getByText('15% off'));
});

test('Edit fills the box in; Save changes the group; Remove group takes it off', async () => {
  const { ui, fireEvent, waitFor, within } = await openGroups();
  fireEvent.click(ui.getByRole('button', { name: 'Edit Club members' }));
  const box = within(await ui.findByRole('dialog', { name: 'Edit Club members' }));
  assert.equal(box.getByLabelText('Name').value, 'Club members');
  assert.equal(box.getByLabelText('% off').value, '10');
  fireEvent.change(box.getByLabelText('% off'), { target: { value: '12' } });
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.deepEqual(writes(), ['PUT /api/customer-groups/3 {"name":"Club members","discountPercent":12}']));
  assert.ok(await ui.findByText('12% off'));
  fireEvent.click(ui.getByRole('button', { name: 'Edit Club members' }));
  const again = within(await ui.findByRole('dialog', { name: 'Edit Club members' }));
  fireEvent.click(again.getByRole('button', { name: 'Remove group' }));
  await waitFor(() => assert.ok(writes().some((w) => w.startsWith('DELETE /api/customer-groups/3 '))));
  await waitFor(() => assert.ok(ui.queryByRole('button', { name: 'Edit Club members' }) === null));
});

test('no groups: the summary says so', async () => {
  const { fold } = await openGroups([]);
  assert.match(fold.textContent, /No groups yet/);
});
