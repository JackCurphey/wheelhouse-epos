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
  return (path, method, body) => {
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
      Object.assign(b, body.label !== undefined ? { label: body.label } : {});
      place(b, body.position ?? at);
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
    calls.push({ path: u.pathname, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    if (u.pathname.startsWith('/api/quick-button') && method !== 'GET' && state.offline) throw new TypeError('Failed to fetch');
    const q = quick(u.pathname, method, body);
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
