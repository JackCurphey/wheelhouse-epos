// Settings › Front desk › Till › Quick buttons (set-till-quick, set-till-quick-add,
// set-till-quick-saved, set-till-empty in generator/setup.mjs; openspec/changes/
// owner-setup-till-payments-eod task 2.1): the group pills, the rows, hover and
// right-click Edit and Remove, arrow-key moves, the Add box, Remove and Undo,
// Add a group, the empty state and a failed save. Example data from the drawings.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const JACK = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street', employee: null };
const FAILED = 'Not saved — no internet connection. Your change is kept here.';
const SERVICES = [
  { id: 11, name: 'Standard service', price: 65, minutes: 60, active: true },
  { id: 12, name: 'Fit & adjust brakes', price: 18, minutes: 30, active: true },
  { id: 13, name: 'Replace gear cable', price: 12, minutes: null, active: true },
];
const PADS = { id: 21, name: 'Shimano brake pads B05S-RX', price: 28, sku: null, barcode: null, stockQty: 0 };

let current;
afterEach(async () => {
  if (!current) return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current.shell.queryClient.clear();
  current.uninstall();
  globalThis.fetch = current.realFetch;
  current = undefined;
});

// A small stand-in for server/routes/quick-buttons.js: each change answers with the whole list.
function fakeServer(state) {
  let nextId = 100;
  const button = (b) => {
    const s = b.serviceId ? SERVICES.find((x) => x.id === b.serviceId) : null;
    const itemName = s ? s.name : PADS.name;
    return { ...b, name: b.label ?? itemName, itemName, kind: s ? 'service' : 'product', line: s ? (s.minutes ? `Labour · ${s.minutes} min` : 'Labour') : 'Part', price: s ? s.price : PADS.price, onSale: !state.offSale?.includes(b.id) };
  };
  const list = () => ({ groups: state.groups.map((g) => ({ id: g.id, name: g.name, buttons: state.buttons.filter((b) => b.groupId === g.id).map(button) })) });
  const place = (b, at) => {
    const rest = state.buttons.filter((x) => x.groupId === b.groupId && x.id !== b.id);
    rest.splice(at ?? rest.length, 0, b);
    state.buttons = [...state.buttons.filter((x) => x.groupId !== b.groupId && x.id !== b.id), ...rest];
  };
  return (path, method, body, search) => {
    const id = Number(path.split('/').pop());
    if (path === '/api/quick-buttons' && method === 'GET') return [200, list()];
    if (path === '/api/quick-buttons' && method === 'POST') {
      const b = { id: nextId++, groupId: body.groupId, productId: body.productId ?? null, serviceId: body.serviceId ?? null, label: body.label ?? null };
      place(b, body.position);
      return [201, { id: b.id, ...list() }];
    }
    if (path.startsWith('/api/quick-buttons/') && method === 'PUT') {
      const b = state.buttons.find((x) => x.id === id);
      const at = state.buttons.filter((x) => x.groupId === b.groupId).indexOf(b);
      if ('label' in body) b.label = body.label;
      if ('productId' in body || 'serviceId' in body) Object.assign(b, { productId: body.productId ?? null, serviceId: body.serviceId ?? null });
      const moved = body.groupId !== undefined && body.groupId !== b.groupId;
      if (moved) b.groupId = body.groupId;
      place(b, body.position ?? (moved ? undefined : at));
      return [200, list()];
    }
    if (path.startsWith('/api/quick-buttons/') && method === 'DELETE') {
      state.buttons = state.buttons.filter((x) => x.id !== id);
      return [200, list()];
    }
    if (path === '/api/quick-button-groups' && method === 'POST') {
      if (state.groups.some((g) => g.name.toLowerCase() === body.name.trim().toLowerCase())) return [409, { error: 'There’s already a group with that name', code: 'name_taken' }];
      state.groups.push({ id: nextId++, name: body.name.trim() });
      return [201, { id: state.groups.at(-1).id, ...list() }];
    }
    if (path.startsWith('/api/quick-button-groups/') && method === 'PUT') {
      state.groups.find((g) => g.id === id).name = body.name;
      return [200, list()];
    }
    if (path.startsWith('/api/quick-button-groups/') && method === 'DELETE') {
      const count = state.buttons.filter((b) => b.groupId === id).length;
      if (count && search !== '?confirm=1') return [409, { error: `This group has ${count} buttons`, code: 'has_buttons', count }];
      state.groups = state.groups.filter((g) => g.id !== id);
      state.buttons = state.buttons.filter((b) => b.groupId !== id);
      return [200, list()];
    }
    return null;
  };
}

async function open({ empty = false } = {}) {
  const calls = [];
  const state = empty ? { groups: [], buttons: [] } : {
    groups: [{ id: 1, name: 'Workshop' }, { id: 2, name: 'Parts' }, { id: 3, name: 'Accessories' }],
    buttons: [11, 12, 13].map((s, i) => ({ id: i + 1, groupId: 1, productId: null, serviceId: s, label: null })),
  };
  state.offline = false;
  const quick = fakeServer(state);
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    const u = new URL(url, 'http://localhost');
    calls.push({ path: u.pathname + u.search, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    if (u.pathname.startsWith('/api/quick-button') && method !== 'GET') {
      if (state.hold) await state.hold;
      if (state.offline) throw new TypeError('Failed to fetch');
    }
    const q = quick(u.pathname, method, body, u.search);
    if (q) return reply(...q);
    if (u.pathname === '/api/auth/me') return reply(200, JACK);
    if (u.pathname === '/api/products') return reply(200, /brake/i.test(u.searchParams.get('search') ?? '') ? [PADS] : []);
    if (u.pathname === '/api/workshop-services') return reply(200, SERVICES);
    if (u.pathname === '/api/till-checkin') return reply(200, { serving: { id: 11, name: 'Jack Lewis' }, checkedInToday: [] });
    if (u.pathname === '/api/your-settings') return reply(200, { accessibility: {} });
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/shop-details') return reply(200, { name: 'North Street Cycles' });
    if (u.pathname === '/api/workshop-jobs') return reply(200, []);
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
  return { ...rtl, ui, calls, state };
}
const sent = (t, method) => t.calls.filter((c) => c.method === method && c.path.startsWith('/api/quick-button')).map((c) => [c.path, c.body]);
const noteArea = (t) => t.ui.container.querySelector('[data-saved-note]');
const rows = (t) => [...t.ui.container.querySelectorAll('[data-quick-button]')].map((r) => [...r.querySelectorAll('[data-part]')].map((p) => p.textContent));
const row = (t, name) => [...t.ui.container.querySelectorAll('[data-quick-button]')].find((r) => r.querySelector('[data-part="name"]').textContent === name);
const pills = (group) => [...group.querySelectorAll('button')].map((b) => `${b.textContent}${b.getAttribute('aria-pressed') === 'true' ? ' (chosen)' : ''}`);
const WORKSHOP = [['Standard service', 'Labour · 60 min', '£65.00'], ['Fit & adjust brakes', 'Labour · 30 min', '£18.00'], ['Replace gear cable', 'Labour', '£12.00']];

async function ready(t) {
  const fold = await t.ui.findByRole('button', { name: /^Quick buttons/ });
  await t.waitFor(() => assert.equal(rows(t).length, 3));
  return fold;
}

test('Front desk › Till opens on Quick buttons: its summary, the group pills, the rows and the note', async () => {
  const t = await open();
  const fold = await ready(t);
  assert.equal(fold.getAttribute('aria-expanded'), 'true', 'first in Till, as drawn, so open');
  await t.waitFor(() => assert.match(fold.textContent, /Workshop, Parts, Accessories/));
  assert.deepEqual(pills(t.ui.getByRole('group', { name: 'Quick button groups' })), ['Workshop (chosen)', 'Parts', 'Accessories', '+ Add a group']);
  assert.deepEqual(rows(t), WORKSHOP);
  assert.ok(t.ui.getByRole('button', { name: 'Move Standard service — drag, or use the arrow keys' }));
  assert.ok(t.ui.getByRole('button', { name: '+ Add a button' }));
  assert.ok(t.ui.getByText('Buttons show on the till in this order.'));
  // Another pill shows its own (empty) list.
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Parts' }));
  await t.waitFor(() => assert.deepEqual(rows(t), []));
});

test('hovering a row shows Edit and Remove; right-click shows them too', async () => {
  const t = await open();
  await ready(t);
  assert.ok(t.ui.queryByRole('button', { name: 'Edit Fit & adjust brakes' }) === null);
  t.fireEvent.mouseEnter(row(t, 'Fit & adjust brakes'));
  assert.ok(t.ui.getByRole('button', { name: 'Edit Fit & adjust brakes' }));
  assert.ok(t.ui.getByRole('button', { name: 'Remove Fit & adjust brakes' }));
  t.fireEvent.mouseLeave(row(t, 'Fit & adjust brakes'));
  assert.ok(t.ui.queryByRole('button', { name: 'Remove Fit & adjust brakes' }) === null);
  t.fireEvent.contextMenu(row(t, 'Replace gear cable'));
  assert.ok(t.ui.getByRole('button', { name: 'Edit Replace gear cable' }));
  assert.ok(t.ui.getByRole('button', { name: 'Remove Replace gear cable' }));
});

test('a handle moved with the up arrow saves at once, with Saved and Undo', async () => {
  const t = await open();
  await ready(t);
  const handle = t.ui.getByRole('button', { name: 'Move Replace gear cable — drag, or use the arrow keys' });
  t.fireEvent.keyDown(handle, { key: 'ArrowUp' });
  await t.waitFor(() => assert.deepEqual(rows(t).map((r) => r[0]), ['Standard service', 'Replace gear cable', 'Fit & adjust brakes']));
  assert.deepEqual(sent(t, 'PUT'), [['/api/quick-buttons/3', { position: 1 }]]);
  const area = noteArea(t);
  await t.waitFor(() => assert.match(area.textContent, /^Saved/));
  t.fireEvent.click(t.within(area).getByRole('button', { name: 'Undo' }));
  await t.waitFor(() => assert.deepEqual(rows(t), WORKSHOP));
  assert.deepEqual(sent(t, 'PUT')[1], ['/api/quick-buttons/3', { position: 2 }]);
});

test('Add a quick button: nothing picked is refused, then search, pick, name, Add the button', async () => {
  const t = await open();
  await ready(t);
  // Cancel closes it with nothing sent.
  t.fireEvent.click(t.ui.getByRole('button', { name: '+ Add a button' }));
  t.fireEvent.click(t.within(await t.ui.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog') === null));
  t.fireEvent.click(t.ui.getByRole('button', { name: '+ Add a button' }));
  const box = t.within(await t.ui.findByRole('dialog'));
  assert.ok(box.getByRole('heading', { name: 'Add a quick button' }));
  assert.ok(box.getByText('To the Workshop group'));
  t.fireEvent.click(box.getByRole('button', { name: 'Add the button' }));
  assert.equal(box.getByRole('alert').textContent, 'Pick a product or service');
  assert.deepEqual(sent(t, 'POST'), []);
  t.fireEvent.change(box.getByRole('textbox', { name: 'Find a product or service' }), { target: { value: 'brake pads' } });
  const hit = await box.findByRole('button', { name: /Shimano brake pads B05S-RX/ });
  assert.match(hit.textContent, /Part.*£28\.00/);
  t.fireEvent.click(hit);
  assert.equal(hit.getAttribute('aria-pressed'), 'true');
  const name = box.getByRole('textbox', { name: 'Name on the button' });
  assert.equal(name.value, 'Shimano brake pads B05S-RX');
  assert.ok(box.getByText('The price always comes from the product.'));
  assert.deepEqual(pills(box.getByRole('group', { name: 'Group' })), ['Workshop (chosen)', 'Parts', 'Accessories']);
  t.fireEvent.click(box.getByRole('button', { name: 'Parts' }));
  assert.ok(box.getByText('To the Parts group'));
  t.fireEvent.click(box.getByRole('button', { name: 'Workshop' }));
  t.fireEvent.change(name, { target: { value: 'Shimano brake pads' } });
  t.fireEvent.click(box.getByRole('button', { name: 'Add the button' }));
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog') === null));
  assert.deepEqual(sent(t, 'POST'), [['/api/quick-buttons', { groupId: 1, productId: 21, label: 'Shimano brake pads' }]]);
  await t.waitFor(() => assert.deepEqual(rows(t).at(-1), ['Shimano brake pads', 'Part', '£28.00']));
  const area = noteArea(t);
  await t.waitFor(() => assert.match(area.textContent, /^Saved · Shimano brake pads added to Workshop/));
  assert.ok(t.within(area).getByRole('button', { name: 'Undo' }));
});

test('Edit opens the box filled in, and Save saves', async () => {
  const t = await open();
  await ready(t);
  t.fireEvent.contextMenu(row(t, 'Standard service'));
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Edit Standard service' }));
  const box = t.within(await t.ui.findByRole('dialog'));
  const name = box.getByRole('textbox', { name: 'Name on the button' });
  assert.equal(name.value, 'Standard service');
  assert.equal(box.getByRole('button', { name: /Standard service/ }).getAttribute('aria-pressed'), 'true', 'its item, picked');
  t.fireEvent.change(name, { target: { value: 'Service' } });
  t.fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog') === null));
  assert.deepEqual(sent(t, 'PUT'), [['/api/quick-buttons/1', { groupId: 1, serviceId: 11, productId: null, label: 'Service' }]]);
  await t.waitFor(() => assert.equal(rows(t)[0][0], 'Service'));
  await t.waitFor(() => assert.match(noteArea(t).textContent, /^Saved/));
});

test('Remove takes the button off at once, and Undo puts it back where it was', async () => {
  const t = await open();
  await ready(t);
  t.fireEvent.mouseEnter(row(t, 'Fit & adjust brakes'));
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Remove Fit & adjust brakes' }));
  await t.waitFor(() => assert.deepEqual(rows(t).map((r) => r[0]), ['Standard service', 'Replace gear cable']));
  const area = noteArea(t);
  await t.waitFor(() => assert.match(area.textContent, /^Saved/));
  t.fireEvent.click(t.within(area).getByRole('button', { name: 'Undo' }));
  await t.waitFor(() => assert.deepEqual(rows(t), WORKSHOP));
  assert.deepEqual(sent(t, 'POST'), [['/api/quick-buttons', { groupId: 1, productId: null, serviceId: 12, label: null, position: 1 }]]);
});

test('Add a group: a taken name is refused beside the name; a new one goes last and is chosen', async () => {
  const t = await open();
  await ready(t);
  t.state.groups.pop();
  await current.shell.queryClient.invalidateQueries();
  const group = t.ui.getByRole('group', { name: 'Quick button groups' });
  await t.waitFor(() => assert.deepEqual(pills(group), ['Workshop (chosen)', 'Parts', '+ Add a group']));
  t.fireEvent.click(t.ui.getByRole('button', { name: '+ Add a group' }));
  const box = t.within(await t.ui.findByRole('dialog'));
  const name = box.getByRole('textbox', { name: 'Name' });
  t.fireEvent.change(name, { target: { value: 'parts' } });
  t.fireEvent.click(box.getByRole('button', { name: 'Add the group' }));
  await t.waitFor(() => assert.equal(box.getByRole('alert').textContent, 'There’s already a group with that name'));
  t.fireEvent.change(name, { target: { value: 'Accessories' } });
  t.fireEvent.click(box.getByRole('button', { name: 'Add the group' }));
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog') === null));
  await t.waitFor(() => assert.deepEqual(pills(group), ['Workshop', 'Parts', 'Accessories (chosen)', '+ Add a group']));
});

test('a new shop: No quick buttons yet, and the summary reads None yet', async () => {
  const t = await open({ empty: true });
  const fold = await t.ui.findByRole('button', { name: /^Quick buttons/ });
  await t.waitFor(() => assert.match(fold.textContent, /None yet/));
  assert.deepEqual(pills(t.ui.getByRole('group', { name: 'Quick button groups' })), ['+ Add a group']);
  assert.ok(t.ui.getByText('No quick buttons yet'));
  assert.ok(t.ui.getByText('Add the things you sell most — they’ll show on the till, one tap each.'));
  assert.ok(t.ui.getByRole('button', { name: '+ Add a button' }));
  assert.ok(t.ui.queryByText('Buttons show on the till in this order.') === null);
});

test('a failed save says so, keeps the change here, and Try again saves it', async () => {
  const t = await open();
  await ready(t);
  t.state.offline = true;
  t.fireEvent.contextMenu(row(t, 'Fit & adjust brakes'));
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Remove Fit & adjust brakes' }));
  const area = noteArea(t);
  await t.waitFor(() => assert.match(area.textContent, new RegExp(`^${FAILED}`)));
  assert.deepEqual(rows(t).map((r) => r[0]), ['Standard service', 'Replace gear cable'], 'the change is kept here');
  t.state.offline = false;
  t.fireEvent.click(t.within(area).getByRole('button', { name: 'Try again' }));
  await t.waitFor(() => assert.match(area.textContent, /^Saved/));
  assert.equal(t.state.buttons.length, 2);
  assert.deepEqual(sent(t, 'DELETE'), [['/api/quick-buttons/2', {}], ['/api/quick-buttons/2', {}]]);
});

test('a button whose item is off sale reads Not on sale (design 5 point 4)', async () => {
  const t = await open();
  t.state.offSale = [2];
  await ready(t);
  assert.deepEqual(rows(t)[1], ['Fit & adjust brakes', 'Labour · 30 min · Not on sale', '£18.00']);
});

// Review fixes (PR 2 drawing check).
const held = (t) => { let release; t.state.hold = new Promise((r) => { release = () => { t.state.hold = null; r(); }; }); return () => release(); };
async function openAdd(t) {
  t.fireEvent.click(t.ui.getByRole('button', { name: '+ Add a button' }));
  const box = t.within(await t.ui.findByRole('dialog'));
  t.fireEvent.change(box.getByRole('textbox', { name: 'Find a product or service' }), { target: { value: 'brake pads' } });
  t.fireEvent.click(await box.findByRole('button', { name: /Shimano brake pads B05S-RX/ }));
  return box;
}

test('a failed Add says so inside the box, which stays open as typed; pressing again saves', async () => {
  const t = await open();
  await ready(t);
  const box = await openAdd(t);
  assert.ok(box.getByRole('button', { name: 'Close' }), 'the header’s × as drawn (popup)');
  t.state.offline = true;
  t.fireEvent.click(box.getByRole('button', { name: 'Add the button' }));
  await t.waitFor(() => assert.equal(box.getByRole('alert').textContent, FAILED));
  assert.ok(t.ui.queryByRole('dialog') !== null);
  assert.equal(box.getByRole('textbox', { name: 'Name on the button' }).value, 'Shimano brake pads B05S-RX');
  assert.ok(!noteArea(t).textContent.includes(FAILED), 'not in the note behind the box');
  t.state.offline = false;
  t.fireEvent.click(box.getByRole('button', { name: 'Add the button' }));
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog') === null));
  assert.equal(t.state.buttons.length, 4);
});

test('a failed Edit says so inside the box', async () => {
  const t = await open();
  await ready(t);
  t.fireEvent.contextMenu(row(t, 'Standard service'));
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Edit Standard service' }));
  const box = t.within(await t.ui.findByRole('dialog'));
  t.state.offline = true;
  t.fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await t.waitFor(() => assert.equal(box.getByRole('alert').textContent, FAILED));
  assert.ok(t.ui.queryByRole('dialog') !== null);
});

test('pressing Add the button twice adds one button', async () => {
  const t = await open();
  await ready(t);
  const box = await openAdd(t);
  const release = held(t);
  const add = box.getByRole('button', { name: 'Add the button' });
  t.fireEvent.click(add);
  await t.waitFor(() => assert.equal(add.disabled, true));
  t.fireEvent.click(add);
  release();
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog') === null));
  assert.equal(sent(t, 'POST').length, 1);
});

test('pressing Add the group twice adds one group', async () => {
  const t = await open();
  await ready(t);
  t.fireEvent.click(t.ui.getByRole('button', { name: '+ Add a group' }));
  const box = t.within(await t.ui.findByRole('dialog'));
  t.fireEvent.change(box.getByRole('textbox', { name: 'Name' }), { target: { value: '[Group name]' } });
  const release = held(t);
  const add = box.getByRole('button', { name: 'Add the group' });
  t.fireEvent.click(add);
  await t.waitFor(() => assert.equal(add.disabled, true));
  t.fireEvent.click(add);
  release();
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog') === null));
  assert.equal(sent(t, 'POST').length, 1);
});

test('a failed move, then Try again, keeps the list right', async () => {
  const t = await open();
  await ready(t);
  t.state.offline = true;
  t.fireEvent.keyDown(t.ui.getByRole('button', { name: 'Move Replace gear cable — drag, or use the arrow keys' }), { key: 'ArrowUp' });
  const area = noteArea(t);
  await t.waitFor(() => assert.match(area.textContent, new RegExp(`^${FAILED}`)));
  t.state.offline = false;
  const release = held(t);
  t.fireEvent.click(t.within(area).getByRole('button', { name: 'Try again' }));
  await t.act(() => new Promise((r) => setTimeout(r, 20)));
  assert.deepEqual(rows(t).map((r) => r[0]), ['Standard service', 'Replace gear cable', 'Fit & adjust brakes'], 'while it saves');
  release();
  await t.waitFor(() => assert.match(area.textContent, /^Saved/));
  assert.deepEqual(rows(t).map((r) => r[0]), ['Standard service', 'Replace gear cable', 'Fit & adjust brakes']);
  assert.deepEqual(t.state.buttons.map((b) => b.id), [1, 3, 2]);
});

test('two quick moves save one after the other, and the server ends where the screen shows', async () => {
  const t = await open();
  await ready(t);
  const release = held(t);
  const handle = t.ui.getByRole('button', { name: 'Move Replace gear cable — drag, or use the arrow keys' });
  t.fireEvent.keyDown(handle, { key: 'ArrowUp' });
  t.fireEvent.keyDown(handle, { key: 'ArrowUp' });
  await t.waitFor(() => assert.equal(rows(t)[0][0], 'Replace gear cable'));
  assert.equal(sent(t, 'PUT').length, 1, 'the second waits for the first');
  release();
  await t.waitFor(() => assert.equal(sent(t, 'PUT').length, 2));
  await t.waitFor(() => assert.match(noteArea(t).textContent, /^Saved/));
  assert.deepEqual(sent(t, 'PUT').map((c) => c[1]), [{ position: 1 }, { position: 0 }]);
  assert.deepEqual(t.state.buttons.map((b) => b.id), [3, 1, 2]);
  assert.deepEqual(rows(t).map((r) => r[0]), ['Replace gear cable', 'Standard service', 'Fit & adjust brakes']);
});

test('after Remove the focus goes to the next row’s handle; closing Edit puts it back on Edit', async () => {
  const t = await open();
  await ready(t);
  t.fireEvent.contextMenu(row(t, 'Fit & adjust brakes'));
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Remove Fit & adjust brakes' }));
  await t.waitFor(() => assert.equal(document.activeElement?.getAttribute('aria-label'), 'Move Replace gear cable — drag, or use the arrow keys'));
  t.fireEvent.contextMenu(row(t, 'Replace gear cable'));
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Remove Replace gear cable' }));
  await t.waitFor(() => assert.equal(document.activeElement?.getAttribute('aria-label'), 'Move Standard service — drag, or use the arrow keys'));
  const edit = t.ui.getByRole('button', { name: 'Edit Standard service' });
  t.fireEvent.click(edit);
  const box = t.within(await t.ui.findByRole('dialog'));
  t.fireEvent.click(box.getByRole('button', { name: 'Cancel' }));
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog') === null));
  await t.waitFor(() => assert.equal(document.activeElement?.getAttribute('aria-label'), 'Edit Standard service'));
});

test('Edit’s Undo puts the name and group back', async () => {
  const t = await open();
  await ready(t);
  t.fireEvent.contextMenu(row(t, 'Fit & adjust brakes'));
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Edit Fit & adjust brakes' }));
  const box = t.within(await t.ui.findByRole('dialog'));
  t.fireEvent.change(box.getByRole('textbox', { name: 'Name on the button' }), { target: { value: 'Brakes' } });
  t.fireEvent.click(box.getByRole('button', { name: 'Parts' }));
  t.fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await t.waitFor(() => assert.deepEqual(rows(t).map((r) => r[0]), ['Standard service', 'Replace gear cable']));
  assert.deepEqual(t.state.buttons.find((b) => b.id === 2), { id: 2, groupId: 2, productId: null, serviceId: 12, label: 'Brakes' });
  const area = noteArea(t);
  await t.waitFor(() => assert.match(area.textContent, /^Saved/));
  t.fireEvent.click(t.within(area).getByRole('button', { name: 'Undo' }));
  await t.waitFor(() => assert.deepEqual(rows(t), WORKSHOP));
});

test('a group’s … menu renames it, by keyboard or tap', async () => {
  const t = await open();
  await ready(t);
  const more = t.ui.getByRole('button', { name: 'More for Workshop' });
  assert.equal(more.getAttribute('aria-haspopup'), 'menu');
  t.fireEvent.click(more);
  const menu = t.within(t.ui.getByRole('menu', { name: 'Workshop' }));
  await t.waitFor(() => assert.equal(document.activeElement?.textContent, 'Rename…'));
  // A drawn menu item that opens a box ends in "…" (ms-tills).
  assert.deepEqual(menu.getAllByRole('menuitem').map((m) => m.textContent), ['Rename…', 'Remove']);
  t.fireEvent.keyDown(document.activeElement, { key: 'Escape' });
  await t.waitFor(() => assert.ok(document.activeElement === more));
  t.fireEvent.click(more);
  t.fireEvent.click(t.within(t.ui.getByRole('menu', { name: 'Workshop' })).getByRole('menuitem', { name: 'Rename…' }));
  const box = t.within(await t.ui.findByRole('dialog'));
  assert.ok(box.getByRole('heading', { name: 'Edit Workshop' }));
  t.fireEvent.change(box.getByRole('textbox', { name: 'Name' }), { target: { value: '[Group name]' } });
  t.fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog') === null));
  assert.deepEqual(sent(t, 'PUT'), [['/api/quick-button-groups/1', { name: '[Group name]' }]]);
  // Right-click on a pill opens the same menu.
  t.fireEvent.contextMenu(t.ui.getByRole('button', { name: 'Parts' }));
  assert.ok(t.ui.getByRole('menu', { name: 'Parts' }));
});

test('removing a group with buttons says how many and asks first', async () => {
  const t = await open();
  await ready(t);
  t.fireEvent.click(t.ui.getByRole('button', { name: 'More for Workshop' }));
  t.fireEvent.click(t.within(t.ui.getByRole('menu', { name: 'Workshop' })).getByRole('menuitem', { name: 'Remove' }));
  const box = t.within(await t.ui.findByRole('dialog'));
  await t.waitFor(() => assert.equal(box.getByRole('alert').textContent, 'Workshop has 3 buttons. Removing the group removes them too.'));
  assert.equal(t.state.groups.length, 3, 'nothing removed yet');
  t.fireEvent.click(box.getByRole('button', { name: 'Remove the group and its buttons' }));
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog') === null));
  assert.deepEqual(sent(t, 'DELETE').map((c) => c[0]), ['/api/quick-button-groups/1', '/api/quick-button-groups/1?confirm=1']);
  await t.waitFor(() => assert.deepEqual(pills(t.ui.getByRole('group', { name: 'Quick button groups' })).slice(0, 2), ['Parts (chosen)', 'Accessories']));
});

test('a group with no buttons shows the empty line; with no buttons at all the summary reads None yet', async () => {
  const t = await open();
  const fold = await ready(t);
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Parts' }));
  assert.ok(t.ui.getByText('No quick buttons yet'));
  assert.ok(t.ui.getByText('Add the things you sell most — they’ll show on the till, one tap each.'));
  assert.match(fold.textContent, /Workshop, Parts, Accessories/);
  t.state.buttons = [];
  await current.shell.queryClient.invalidateQueries();
  await t.waitFor(() => assert.match(fold.textContent, /None yet/));
});

// Second review.
const press = (t, el) => { el.focus(); t.fireEvent.click(el); };
const more = (t) => t.ui.getByRole('button', { name: /^More for / });
async function rename(t) {
  t.fireEvent.click(more(t));
  press(t, t.within(t.ui.getByRole('menu')).getByRole('menuitem', { name: 'Rename…' }));
  return t.within(await t.ui.findByRole('dialog'));
}
const focusOnMore = (t) => t.waitFor(() => assert.ok(document.activeElement === more(t), `focus on ${document.activeElement?.tagName} ${document.activeElement?.textContent}`));

test('after renaming a group, by Save, Cancel or Escape, the focus is back on its …', async () => {
  const t = await open();
  await ready(t);
  let box = await rename(t);
  t.fireEvent.change(box.getByRole('textbox', { name: 'Name' }), { target: { value: '[Group name]' } });
  press(t, box.getByRole('button', { name: 'Save' }));
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog') === null));
  await focusOnMore(t);
  box = await rename(t);
  press(t, box.getByRole('button', { name: 'Cancel' }));
  await focusOnMore(t);
  await rename(t);
  // Escape: the browser closes the <dialog> itself, sending its close event.
  t.ui.getByRole('dialog').close();
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog') === null));
  await focusOnMore(t);
});

test('after removing a group the focus stays on the fold: on … (now the next group’s)', async () => {
  const t = await open();
  await ready(t);
  // An empty group goes straight from the menu.
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Accessories' }));
  t.fireEvent.click(more(t));
  press(t, t.within(t.ui.getByRole('menu')).getByRole('menuitem', { name: 'Remove' }));
  await t.waitFor(() => assert.equal(t.state.groups.length, 2));
  await focusOnMore(t);
  // One with buttons: Cancel, then remove.
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Workshop' }));
  t.fireEvent.click(more(t));
  press(t, t.within(t.ui.getByRole('menu')).getByRole('menuitem', { name: 'Remove' }));
  let box = t.within(await t.ui.findByRole('dialog'));
  press(t, box.getByRole('button', { name: 'Cancel' }));
  await focusOnMore(t);
  t.fireEvent.click(more(t));
  press(t, t.within(t.ui.getByRole('menu')).getByRole('menuitem', { name: 'Remove' }));
  box = t.within(await t.ui.findByRole('dialog'));
  press(t, box.getByRole('button', { name: 'Remove the group and its buttons' }));
  await t.waitFor(() => assert.equal(t.state.groups.length, 1));
  await focusOnMore(t);
  assert.equal(more(t).getAttribute('aria-label'), 'More for Parts');
});

test('a failed move then a move of another button: the first is sent again first, so nothing jumps back', async () => {
  const t = await open();
  await ready(t);
  t.state.offline = true;
  t.fireEvent.keyDown(t.ui.getByRole('button', { name: 'Move Replace gear cable — drag, or use the arrow keys' }), { key: 'ArrowUp' });
  const area = noteArea(t);
  await t.waitFor(() => assert.match(area.textContent, new RegExp(`^${FAILED}`)));
  t.state.offline = false;
  t.fireEvent.keyDown(t.ui.getByRole('button', { name: 'Move Standard service — drag, or use the arrow keys' }), { key: 'ArrowDown' });
  await t.waitFor(() => assert.match(area.textContent, /^Saved/));
  await t.act(() => new Promise((r) => setTimeout(r, 20)));
  assert.deepEqual(rows(t).map((r) => r[0]), ['Replace gear cable', 'Standard service', 'Fit & adjust brakes']);
  assert.deepEqual(t.state.buttons.map((b) => b.id), [3, 1, 2]);
  assert.deepEqual(sent(t, 'PUT'), [['/api/quick-buttons/3', { position: 1 }], ['/api/quick-buttons/3', { position: 1 }], ['/api/quick-buttons/1', { position: 1 }]]);
});

test('a slow Edit save, cancelled, doesn’t close the next button’s Edit box', async () => {
  const t = await open();
  await ready(t);
  t.fireEvent.contextMenu(row(t, 'Standard service'));
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Edit Standard service' }));
  let box = t.within(await t.ui.findByRole('dialog'));
  const release = held(t);
  press(t, box.getByRole('button', { name: 'Save' }));
  press(t, box.getByRole('button', { name: 'Cancel' }));
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog') === null));
  t.fireEvent.contextMenu(row(t, 'Fit & adjust brakes'));
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Edit Fit & adjust brakes' }));
  box = t.within(await t.ui.findByRole('dialog'));
  release();
  await t.waitFor(() => assert.match(noteArea(t).textContent, /^Saved/));
  await t.act(() => new Promise((r) => setTimeout(r, 20)));
  assert.ok(t.ui.queryByRole('heading', { name: 'Fit & adjust brakes' }) !== null, 'the newer box is still open');
});
