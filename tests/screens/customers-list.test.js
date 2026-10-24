// Customers, the list and Add a customer (openspec/changes/customers-list;
// cs-list, cs-add, cs-add-match in customer.mjs; customer service review 3, 5, 12).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
// The drawing's list: Maya's Trek Domane AL 3 first, then Oliver's Brompton.
const RECENT = [
  { id: 5, name: 'Maya Patel', phone: '07700 900142', email: null, bikeLabel: 'Trek Domane AL 3' },
  { id: 6, name: 'Oliver Chen', phone: '07700 900600', email: null, bikeLabel: 'Brompton C Line' },
  { id: 7, name: 'Sam Reed', phone: null, email: 'sam@example.com', bikeLabel: null },
];

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

async function open({ phone = false, withGroups = [] } = {}) {
  calls = [];
  groups = withGroups;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: String(url), method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/recent-customers') return reply(200, RECENT);
    if (u.pathname === '/api/customer-groups') return reply(200, groups);
    if (u.pathname === '/api/customer-matches') {
      const digits = (u.searchParams.get('phone') ?? '').replace(/\D/g, '');
      return reply(200, digits === '07700900142' ? [{ ...RECENT[0] }] : []);
    }
    if (u.pathname === '/api/customers' && method === 'POST') return reply(201, { id: 99, ...body, active: true, groups: [] });
    if (u.pathname.startsWith('/api/')) return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom('http://localhost/workshop/customers');
  if (phone) window.matchMedia = (q) => ({ matches: q.includes('max-width'), media: q, addEventListener() {}, removeEventListener() {} });
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByRole('heading', { level: 2, name: 'Recent customers' });
  return { ...rtl, ui };
}
const posts = () => calls.filter((c) => c.method === 'POST' && c.url.endsWith('/api/customers')).map((c) => c.body);

test('Customers is the recent list, as drawn: the note, Add, and a row per customer opening their page', async () => {
  const { ui, within } = await open();
  assert.ok(ui.queryByText('To find anyone else, use the search at the top — by name, phone, email or postcode.') !== null);
  assert.ok(ui.getByRole('button', { name: '+ Add a customer' }));
  const list = within(await ui.findByRole('list', { name: 'Recent customers' }));
  const maya = list.getByRole('link', { name: /^Maya Patel/ });
  assert.equal(maya.getAttribute('href'), '/workshop/customers/5');
  assert.ok(maya.textContent.includes('Trek Domane AL 3') && maya.textContent.includes('07700 900142') && maya.textContent.includes('MP'), maya.textContent);
  const sam = list.getByRole('link', { name: /^Sam Reed/ });
  assert.ok(!sam.textContent.includes('null'), 'no bike, no phone: nothing made up');
});

test('on a phone the rows leave the phone number off, as drawn', async () => {
  const { ui, within } = await open({ phone: true });
  const maya = within(await ui.findByRole('list', { name: 'Recent customers' })).getByRole('link', { name: /^Maya Patel/ });
  assert.ok(!maya.textContent.includes('07700 900142'));
});

test('Add a customer, as drawn: name, one way to reach them, the optional parts, offers off', async () => {
  const { ui, fireEvent, within } = await open();
  fireEvent.click(ui.getByRole('button', { name: '+ Add a customer' }));
  const dialog = within(await ui.findByRole('dialog', { name: 'Add a customer' }));
  assert.ok(dialog.queryByText('Only a name and one way to reach them are needed') !== null);
  for (const label of ['Name', 'Phone', 'Email', 'Address (optional)', 'Postcode (optional)', 'Note (optional)']) assert.ok(dialog.getByLabelText(label), label);
  assert.ok(dialog.queryByText('A phone number or an email — at least one.') !== null);
  const offers = dialog.getByRole('switch', { name: 'Happy to hear about offers' });
  assert.equal(offers.getAttribute('aria-checked'), 'false');
  assert.ok(dialog.queryByText('Only if they say yes. Job updates always go.') !== null);
  assert.ok(dialog.queryByRole('group', { name: 'Group (optional)' }) === null, 'no groups set up, so no choice');
});

test('a group can be chosen when the shop has groups', async () => {
  const { ui, fireEvent, within } = await open({ withGroups: [{ id: 3, name: 'Club members', discountPercent: 10 }] });
  fireEvent.click(ui.getByRole('button', { name: '+ Add a customer' }));
  const dialog = within(await ui.findByRole('dialog', { name: 'Add a customer' }));
  const group = within(await dialog.findByRole('group', { name: 'Group (optional)' }));
  assert.equal(group.getByRole('radio', { name: 'None' }).checked, true);
  assert.ok(group.getByRole('radio', { name: 'Club members' }));
});

test('no name, or no way to reach them, says so and adds nobody', async () => {
  const { ui, fireEvent, within } = await open();
  fireEvent.click(ui.getByRole('button', { name: '+ Add a customer' }));
  const dialog = within(await ui.findByRole('dialog', { name: 'Add a customer' }));
  fireEvent.click(dialog.getByRole('button', { name: 'Add the customer' }));
  assert.ok((await dialog.findByText('Add their name.')) !== null);
  fireEvent.change(dialog.getByLabelText('Name'), { target: { value: 'Lena Fox' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Add the customer' }));
  assert.ok((await dialog.findByRole('alert')).textContent.includes('A phone number or an email — at least one.'));
  assert.deepEqual(posts(), []);
});

test('a phone that’s already a customer’s shows them, with Use, before anyone is added twice', async () => {
  const { ui, fireEvent, within } = await open();
  fireEvent.click(ui.getByRole('button', { name: '+ Add a customer' }));
  const dialog = within(await ui.findByRole('dialog', { name: 'Add a customer' }));
  fireEvent.change(dialog.getByLabelText('Name'), { target: { value: 'Maya P.' } });
  fireEvent.change(dialog.getByLabelText('Phone'), { target: { value: '07700 900142' } });
  const found = within(await dialog.findByRole('status'));
  assert.ok((await found.findByText('Maya Patel already has this number')) !== null);
  assert.ok(found.queryByText(/Trek Domane AL 3/) !== null);
  fireEvent.click(found.getByRole('link', { name: 'Use Maya Patel' }));
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(window.location.pathname, '/workshop/customers/5');
  assert.deepEqual(posts(), [], 'nobody added');
});

test('adding sends what was typed, offers as chosen, and opens the new customer', async () => {
  const { ui, fireEvent, within, waitFor } = await open();
  fireEvent.click(ui.getByRole('button', { name: '+ Add a customer' }));
  const dialog = within(await ui.findByRole('dialog', { name: 'Add a customer' }));
  fireEvent.change(dialog.getByLabelText('Name'), { target: { value: 'Lena Fox' } });
  fireEvent.change(dialog.getByLabelText('Email'), { target: { value: 'lena@example.com' } });
  fireEvent.change(dialog.getByLabelText('Postcode (optional)'), { target: { value: 'BL1 2AB' } });
  fireEvent.click(dialog.getByRole('switch', { name: 'Happy to hear about offers' }));
  fireEvent.click(dialog.getByRole('button', { name: 'Add the customer' }));
  await waitFor(() => assert.equal(posts().length, 1));
  assert.deepEqual(posts()[0], { name: 'Lena Fox', phone: '', email: 'lena@example.com', address: '', postcode: 'BL1 2AB', notes: '', marketingPermission: true, groupIds: [] });
  await waitFor(() => assert.equal(window.location.pathname, '/workshop/customers/99'));
});
