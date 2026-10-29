// The Tills list, with Rename and Remove (openspec/changes/tills-list; drawn
// as set-till-tills-owner and set-till-remove in setup.mjs, tillsOpen and
// removeTillDialog; owner setup 17; workshop computer task 2.7).
import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const JACK = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street', employee: null };
const BOLTON = { id: 7, name: 'Bolton', code: 'B', taken: [1] };
const B1 = { id: 3, code: 'B1', name: null, siteName: 'Bolton', registeredAt: '2026-09-01T09:00:00Z', registeredBy: 'Jack Lewis' };
const B2 = { id: 4, code: 'B2', name: 'Front counter', siteName: 'Bolton', registeredAt: '2026-09-01T09:00:00Z', registeredBy: null };
const WORKSHOP = { id: 5, name: null, siteName: 'Bolton', registeredAt: '2026-09-01T09:00:00Z', registeredBy: 'Jack Lewis' };

let current;
afterEach(async () => {
  if (!current) return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current?.shell.queryClient.clear();
  current?.uninstall();
  globalThis.fetch = current.realFetch;
  mock.timers.reset();
  current = undefined;
});

async function open({ tills = [B1], workshopComputers = [], refuse = null } = {}) {
  const calls = [];
  const realFetch = globalThis.fetch;
  const state = { tills: [...tills], workshopComputers: [...workshopComputers] };
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-01T10:00:00+01:00') });
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    const m = u.pathname.match(/^\/api\/till-setup\/(tills|workshop)\/(\d+)(\/remove)?$/);
    if (m) {
      if (refuse) return reply(refuse.status, refuse.body);
      const list = m[1] === 'tills' ? 'tills' : 'workshopComputers';
      const id = Number(m[2]);
      if (m[3]) {
        state[list] = state[list].filter((d) => d.id !== id);
        return reply(200, { id, active: false });
      }
      const name = (body.name ?? '').trim() || null;
      state[list] = state[list].map((d) => (d.id === id ? { ...d, name } : d));
      return reply(200, { id, name });
    }
    if (u.pathname === '/api/auth/me') return reply(200, JACK);
    if (u.pathname === '/api/till-setup/list') return reply(200, state);
    if (u.pathname === '/api/till-setup') return reply(200, { sites: [BOLTON], thisTill: null, thisWorkshop: null, tills: state.tills.map((t) => t.code) });
    if (u.pathname === '/api/till-checkin') return reply(200, { serving: null, checkedInToday: [], givePin: [], till: null });
    if (u.pathname === '/api/your-settings/till-pin/ask') return reply(200, { ask: null });
    if (u.pathname === '/api/your-settings') return reply(200, { accessibility: {} });
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/shop-details') return reply(200, { name: 'North Street Cycles' });
    return reply(404, { error: 'Not found' });
  };
  const uninstall = installDom('http://localhost/workshop/settings?room=front-desk');
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  const shell = await importFresh(SHELL);
  current = { shell, uninstall, realFetch };
  const ui = rtl.render(createElement(shell.AppShell));
  const fold = await ui.findByRole('button', { name: /^Tills/ });
  if (fold.getAttribute('aria-expanded') !== 'true') rtl.fireEvent.click(fold);
  const region = rtl.within(document.getElementById(fold.getAttribute('aria-controls')));
  return { ...rtl, ui, region, calls };
}
const sent = (t, method, path) => t.calls.filter((c) => c.method === method && c.url === path).map((c) => c.body ?? null);
const dialog = (t) => t.within(t.ui.getByRole('dialog'));

test('each till that is on, then each workshop computer: where, when and by whom, Rename and Remove; then the note and the button', async () => {
  const t = await open({ tills: [B1, B2], workshopComputers: [WORKSHOP] });
  const rows = await t.region.findAllByRole('listitem');
  assert.deepEqual(rows.map((r) => r.textContent), [
    'Till B1Bolton · registered Tue 1 Sep by Jack LewisRenameRemove',
    'Till B2 · Front counterBolton · registered Tue 1 SepRenameRemove',
    'Workshop computerBolton · registered Tue 1 Sep by Jack LewisRenameRemove',
  ]);
  assert.ok(t.region.getByRole('button', { name: 'Rename Till B1' }));
  assert.ok(t.region.getByRole('button', { name: 'Remove Till B1' }));
  assert.ok(t.region.getByRole('button', { name: 'Remove Workshop computer' }));
  assert.ok(t.region.getByText('Do this on the computer that will be the till. It doesn’t show on a computer that’s already a till.'));
  assert.ok(t.region.getByRole('link', { name: 'Make this computer a till' }));
});

test('Rename: the name in a box, saved with Save; a blank name is none', async () => {
  const t = await open();
  t.fireEvent.click(await t.region.findByRole('button', { name: 'Rename Till B1' }));
  const box = dialog(t);
  assert.ok(box.getByRole('heading', { name: 'Rename Till B1' }));
  const field = box.getByLabelText('Name (optional)');
  assert.equal(field.value, '');
  t.fireEvent.change(field, { target: { value: 'Front counter' } });
  t.fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await t.waitFor(() => assert.ok(t.region.getByText('Till B1 · Front counter')));
  assert.deepEqual(sent(t, 'PUT', '/api/till-setup/tills/3'), [{ name: 'Front counter' }]);
  assert.ok(t.ui.queryByRole('dialog') === null);
  t.fireEvent.click(t.region.getByRole('button', { name: 'Rename Till B1' }));
  t.fireEvent.change(dialog(t).getByLabelText('Name (optional)'), { target: { value: '' } });
  t.fireEvent.click(dialog(t).getByRole('button', { name: 'Save' }));
  await t.waitFor(() => assert.ok(t.region.getByText('Till B1')));
  assert.deepEqual(sent(t, 'PUT', '/api/till-setup/tills/3').at(-1), { name: '' });
});

test('Remove asks first: Keep the till changes nothing, Remove the till takes it off the list', async () => {
  const t = await open();
  t.fireEvent.click(await t.region.findByRole('button', { name: 'Remove Till B1' }));
  const box = dialog(t);
  assert.ok(box.getByRole('heading', { name: 'Remove Till B1?' }));
  assert.ok(box.getByText('Bolton'));
  assert.ok(box.getByText('This computer stops working as a till. Sales already taken stay in the reports.'));
  t.fireEvent.click(box.getByRole('button', { name: 'Keep the till' }));
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog') === null));
  assert.deepEqual(sent(t, 'POST', '/api/till-setup/tills/3/remove'), []);
  t.fireEvent.click(t.region.getByRole('button', { name: 'Remove Till B1' }));
  t.fireEvent.click(dialog(t).getByRole('button', { name: 'Remove the till' }));
  await t.waitFor(() => assert.ok(t.region.queryByRole('button', { name: 'Remove Till B1' }) === null));
  assert.equal(sent(t, 'POST', '/api/till-setup/tills/3/remove').length, 1);
  assert.ok(t.ui.queryByRole('dialog') === null);
});

test('a workshop computer is removed in its own words', async () => {
  const t = await open({ tills: [], workshopComputers: [WORKSHOP] });
  t.fireEvent.click(await t.region.findByRole('button', { name: 'Remove Workshop computer' }));
  const box = dialog(t);
  assert.ok(box.getByRole('heading', { name: 'Remove the workshop computer?' }));
  assert.ok(box.getByText('This computer stops working as a workshop computer.'));
  assert.ok(box.getByRole('button', { name: 'Keep the workshop computer' }));
  t.fireEvent.click(box.getByRole('button', { name: 'Remove the workshop computer' }));
  await t.waitFor(() => assert.ok(t.region.queryByRole('listitem') === null));
  assert.equal(sent(t, 'POST', '/api/till-setup/workshop/5/remove').length, 1);
});

test('a refusal shows in the box and the till stays', async () => {
  const t = await open({ refuse: { status: 403, body: { error: 'Only the owner can add or remove tills. Switch to the owner first.', code: 'not_owner_checked_in' } } });
  t.fireEvent.click(await t.region.findByRole('button', { name: 'Remove Till B1' }));
  t.fireEvent.click(dialog(t).getByRole('button', { name: 'Remove the till' }));
  assert.equal((await dialog(t).findByRole('alert')).textContent, 'Only the owner can add or remove tills. Switch to the owner first.');
  assert.ok(t.region.getByRole('button', { name: 'Remove Till B1' }));
});
