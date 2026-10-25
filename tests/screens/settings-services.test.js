// Settings › Workshop › Services (openspec/changes/services-room; drawn as
// set-workshop-services, ac-services and ac-service-edit): the shop's services
// by group, each one's box, adding and removing. The drawn services: Standard
// service £65.00; the rest are drawn at [£ price], which the test shop keeps
// at £0.00 (docs/decisions/2026-10-16-test-shop-defaults.md).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const svc = (over) => ({ id: 1, name: 'Standard service', price: 65, pricePence: 6500, minutes: 60, active: true, bookableOnline: true, kind: 'full', categoryId: null, position: 0, questions: [], includes: [], reminderMonths: null, ...over });
const SERVICES = [
  svc({}),
  svc({ id: 2, name: 'Safety check', price: 0, pricePence: 0, kind: 'individual' }),
  svc({ id: 3, name: 'Gear adjustment', price: 0, pricePence: 0, kind: 'individual', categoryId: 9 }),
  svc({ id: 4, name: 'Brake service', price: 0, pricePence: 0, minutes: 45, kind: 'individual' }),
  // As the server sends a removed service.
  svc({ id: 5, name: 'Old removed service', minutes: 30, kind: 'individual', active: false }),
];
const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let services;
let refuse;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

async function openServices() {
  calls = [];
  services = SERVICES.map((s) => ({ ...s }));
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
    if (u.pathname === '/api/workshop-checklists') return reply(200, []);
    if (u.pathname === '/api/workshop-services' && method === 'GET') return reply(200, services);
    if (refuse && method !== 'GET') return reply(400, { error: refuse });
    if (u.pathname === '/api/workshop-services' && method === 'POST') {
      const made = svc({ id: next++, ...body, price: Number(body.price), active: true });
      services = [...services, made];
      return reply(201, made);
    }
    const one = u.pathname.match(/^\/api\/workshop-services\/(\d+)$/);
    if (one && method === 'PUT') {
      services = services.map((s) => (s.id === Number(one[1]) ? { ...s, ...body, price: Number(body.price) } : s));
      return reply(200, services.find((s) => s.id === Number(one[1])));
    }
    if (one && method === 'DELETE') {
      services = services.map((s) => (s.id === Number(one[1]) ? { ...s, active: false } : s));
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
  const fold = await ui.findByRole('button', { name: /^Services/ });
  if (fold.getAttribute('aria-expanded') !== 'true') rtl.fireEvent.click(fold);
  await ui.findByRole('group', { name: 'Service groups' });
  return { ...rtl, ui, fold };
}
const writes = () => calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.url} ${JSON.stringify(c.body ?? null)}`);
const rowNames = (ui) => ui.queryAllByRole('button', { name: /^Edit / }).map((b) => b.getAttribute('aria-label').replace(/^Edit /, ''));

test('Services is the first fold in Workshop, open, with the drawn summary', async () => {
  const { ui, fold } = await openServices();
  assert.equal(fold.getAttribute('aria-expanded'), 'true', 'the room opens on its first fold');
  assert.match(fold.textContent, /Full service, Individual service/);
  assert.ok(fold.compareDocumentPosition(ui.getByRole('button', { name: /^Checklists/ })) & Node.DOCUMENT_POSITION_FOLLOWING, 'Services comes before Checklists');
});

test('the pills choose a group; each row shows its name, time in the diary and price; removed ones aren’t listed', async () => {
  const { ui, fireEvent, within } = await openServices();
  const pills = within(ui.getByRole('group', { name: 'Service groups' })).getAllByRole('radio');
  assert.deepEqual(pills.map((p) => [p.closest('label').textContent, p.checked]), [['Full service', true], ['Individual service', false]]);
  assert.deepEqual(rowNames(ui), ['Standard service']);
  assert.ok(ui.getByText('60 min in the diary'));
  assert.ok(ui.getByText('£65.00'));
  fireEvent.click(ui.getByRole('radio', { name: 'Individual service' }));
  assert.deepEqual(rowNames(ui), ['Safety check', 'Gear adjustment', 'Brake service']);
  assert.ok(ui.getByText('45 min in the diary'));
  assert.equal(ui.getAllByText('£0.00').length, 3);
  assert.ok(ui.queryByRole('button', { name: 'Remove Brake service' }) !== null);
  assert.ok(ui.queryByText('Old removed service') === null);
  assert.ok(ui.queryByRole('button', { name: '+ Add a service' }) !== null);
  assert.ok(ui.queryByText('Groups and services show as pills, in this order, when a job is booked.') !== null);
});

test('Edit opens the service’s box, filled in, and Save sends just what the box shows', async () => {
  const { ui, fireEvent, waitFor } = await openServices();
  fireEvent.click(ui.getByRole('button', { name: 'Edit Standard service' }));
  const box = await ui.findByRole('dialog', { name: 'Standard service' });
  const { within } = await import('@testing-library/react');
  const b = within(box);
  assert.ok(b.getByText('Full service · 60 min in the diary · £65.00'));
  assert.equal(b.getByRole('textbox', { name: 'Name' }).value, 'Standard service');
  assert.equal(b.getByRole('radio', { name: 'Full service' }).checked, true);
  assert.equal(b.getByRole('textbox', { name: 'Time in the diary' }).value, '60');
  assert.equal(b.getByRole('textbox', { name: 'Price' }).value, '65.00');
  assert.equal(b.getByRole('switch', { name: 'Customers can book this online' }).getAttribute('aria-checked'), 'true');
  fireEvent.change(b.getByRole('textbox', { name: 'Time in the diary' }), { target: { value: '90' } });
  fireEvent.click(b.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.deepEqual(writes(), ['PUT /api/workshop-services/1 {"name":"Standard service","kind":"full","minutes":90,"price":65,"bookableOnline":true,"reminderMonths":null}']));
  await waitFor(() => assert.ok(ui.queryByRole('dialog') === null));
  assert.ok(await ui.findByText('90 min in the diary'));
});

test('a refusal shows the shop’s words in the box, and the box stays open', async () => {
  const { ui, fireEvent } = await openServices();
  fireEvent.click(ui.getByRole('button', { name: 'Edit Standard service' }));
  const box = await ui.findByRole('dialog', { name: 'Standard service' });
  refuse = 'A service needs a name';
  const { within } = await import('@testing-library/react');
  fireEvent.change(within(box).getByRole('textbox', { name: 'Name' }), { target: { value: '' } });
  fireEvent.click(within(box).getByRole('button', { name: 'Save' }));
  assert.ok(await within(box).findByText('A service needs a name'));
  assert.ok(ui.queryByRole('dialog', { name: 'Standard service' }) !== null);
});

test('+ Add a service opens the box empty, in the group chosen, with online booking on; an empty time is no time', async () => {
  const { ui, fireEvent, waitFor } = await openServices();
  fireEvent.click(ui.getByRole('radio', { name: 'Individual service' }));
  fireEvent.click(ui.getByRole('button', { name: '+ Add a service' }));
  const box = await ui.findByRole('dialog', { name: 'New service' });
  const { within } = await import('@testing-library/react');
  const b = within(box);
  assert.equal(b.getByRole('textbox', { name: 'Name' }).value, '');
  assert.equal(b.getByRole('radio', { name: 'Individual service' }).checked, true);
  assert.equal(b.getByRole('switch', { name: 'Customers can book this online' }).getAttribute('aria-checked'), 'true');
  fireEvent.change(b.getByRole('textbox', { name: 'Name' }), { target: { value: 'Puncture repair' } });
  fireEvent.change(b.getByRole('textbox', { name: 'Price' }), { target: { value: '12.50' } });
  fireEvent.click(b.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.deepEqual(writes(), ['POST /api/workshop-services {"name":"Puncture repair","kind":"individual","minutes":null,"price":12.5,"bookableOnline":true,"reminderMonths":null}']));
  await waitFor(() => assert.ok(rowNames(ui).includes('Puncture repair')));
});

test('switching online booking off is sent; Cancel sends nothing', async () => {
  const { ui, fireEvent, waitFor } = await openServices();
  const { within } = await import('@testing-library/react');
  fireEvent.click(ui.getByRole('button', { name: 'Edit Standard service' }));
  let box = await ui.findByRole('dialog', { name: 'Standard service' });
  fireEvent.click(within(box).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => assert.ok(ui.queryByRole('dialog') === null));
  assert.deepEqual(writes(), []);
  fireEvent.click(ui.getByRole('button', { name: 'Edit Standard service' }));
  box = await ui.findByRole('dialog', { name: 'Standard service' });
  fireEvent.click(within(box).getByRole('switch', { name: 'Customers can book this online' }));
  fireEvent.click(within(box).getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.deepEqual(writes(), ['PUT /api/workshop-services/1 {"name":"Standard service","kind":"full","minutes":60,"price":65,"bookableOnline":false,"reminderMonths":null}']));
});

test('Remove retires the service, and it leaves the list', async () => {
  const { ui, fireEvent, waitFor } = await openServices();
  fireEvent.click(ui.getByRole('radio', { name: 'Individual service' }));
  fireEvent.click(ui.getByRole('button', { name: 'Remove Brake service' }));
  await waitFor(() => assert.deepEqual(writes(), ['DELETE /api/workshop-services/4 {}']));
  await waitFor(() => assert.deepEqual(rowNames(ui), ['Safety check', 'Gear adjustment']));
});

// When each service's reminder is due (service-reminder-months; ac-service-edit,
// ac-services): the drawn field and note, and the row's words.
test('the box has the reminder months and the drawn note; Save sends them; the row says so', async () => {
  const { ui, fireEvent, waitFor, within } = await openServices();
  fireEvent.click(ui.getByRole('button', { name: 'Edit Standard service' }));
  const box = await ui.findByRole('dialog', { name: 'Standard service' });
  const b = within(box);
  const months = b.getByRole('textbox', { name: 'Remind customers it’s due after' });
  assert.equal(months.value, '');
  assert.ok(b.getByText('Counted from when the bike is collected. Only customers who said yes get it. Leave empty for no reminder — for a puncture, say.'));
  fireEvent.change(months, { target: { value: '12' } });
  fireEvent.click(b.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.deepEqual(writes(), ['PUT /api/workshop-services/1 {"name":"Standard service","kind":"full","minutes":60,"price":65,"bookableOnline":true,"reminderMonths":12}']));
  assert.ok(await ui.findByText('60 min in the diary · reminder after 12 months'));
});

test('a service with a reminder opens with its months; emptied, Save sends none', async () => {
  const { ui, fireEvent, waitFor, within } = await openServices();
  services = services.map((x) => (x.id === 1 ? { ...x, reminderMonths: 6 } : x));
  shell.queryClient.invalidateQueries({ queryKey: ['workshop-services'] });
  assert.ok(await ui.findByText('60 min in the diary · reminder after 6 months'));
  fireEvent.click(ui.getByRole('button', { name: 'Edit Standard service' }));
  const b = within(await ui.findByRole('dialog', { name: 'Standard service' }));
  assert.equal(b.getByRole('textbox', { name: 'Remind customers it’s due after' }).value, '6');
  fireEvent.change(b.getByRole('textbox', { name: 'Remind customers it’s due after' }), { target: { value: '' } });
  fireEvent.click(b.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.match(writes().at(-1) ?? '', /"reminderMonths":null\}$/));
});

test('a service with a reminder and no time says “Reminder after [n] months”', async () => {
  const { ui } = await openServices();
  services = services.map((x) => (x.id === 1 ? { ...x, minutes: null, reminderMonths: 6 } : x));
  shell.queryClient.invalidateQueries({ queryKey: ['workshop-services'] });
  assert.ok(await ui.findByText('Reminder after 6 months'));
});
