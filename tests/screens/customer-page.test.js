// A customer's page, and Edit (openspec/changes/customer-page; cs-page,
// cs-page-new, cs-edit in customer.mjs; customer service review 12;
// walk-through 9 L5).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const MAYA = {
  id: 5, name: 'Maya Patel', phone: '07700 900142', email: 'maya@example.com', notes: 'Prefers texts, not calls',
  address: '12 North Street, Bolton', postcode: 'BL1 2AB', marketingPermission: true, active: true,
  groups: [{ id: 3, name: 'Club members', discountPercent: 10 }],
};
const BIKES = [{ id: 7, customerId: 5, make: 'Trek', model: 'Domane AL 3', colour: 'Green', notes: null }];
const JOB = { kind: 'job', id: 42, reference: 'WH-1042', title: 'Standard service', jobDate: '2026-09-17', startTime: '11:30', bookingState: 'scheduled', custodyState: 'in_shop', workState: 'in_progress', mechanicName: 'Alex Morgan', open: true, at: '2026-09-17T11:30:00.000Z' };
const OLD_JOB = { ...JOB, id: 30, reference: 'WH-1030', title: 'Gear tune', jobDate: '2026-06-02', custodyState: 'collected', workState: 'complete', open: false, at: '2026-06-02T10:00:00.000Z' };
const SALE = { kind: 'sale', id: 41, total: 10, what: 'Inner tube × 2', at: '2026-08-20T14:00:00.000Z' };
const TEXT = { kind: 'message', id: 9, name: 'Bike ready', channel: 'sms', to: '07700 900142', at: '2026-07-01T09:00:00.000Z' };

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let customer;
let history;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

async function open({ items = [JOB, SALE, TEXT, OLD_JOB], who = MAYA, expect = null } = {}) {
  calls = [];
  customer = { ...who };
  history = items;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: String(url), method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/customers/5' && method === 'PUT') { customer = { ...customer, ...body, groups: customer.groups }; return reply(200, customer); }
    if (u.pathname === '/api/customers/5') return reply(200, customer);
    if (u.pathname === '/api/customers/5/bikes') return reply(200, BIKES);
    if (u.pathname === '/api/customers/5/history') return reply(200, { items: history });
    if (u.pathname === '/api/customer-groups') return reply(200, [{ id: 3, name: 'Club members', discountPercent: 10 }]);
    if (u.pathname === '/api/customers/404') return reply(404, { error: 'Customer not found' });
    if (u.pathname.startsWith('/api/')) return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom(`http://localhost/workshop/customers/${who.id}`);
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  if (expect) await ui.findByText(expect);
  else await ui.findByRole('heading', { level: 2, name: who.name });
  return { ...rtl, ui };
}
const puts = () => calls.filter((c) => c.method === 'PUT').map((c) => c.body);

test('the page as drawn: back to Customers, who they are, New job, Details, Bikes and offers', async () => {
  const { ui, within } = await open();
  assert.equal(ui.getByRole('main').querySelector('a[href="/workshop/customers"]')?.textContent.replace('‹', '').trim(), 'Customers', 'the back link');
  assert.ok(ui.queryByText('07700 900142 · maya@example.com') !== null);
  assert.equal(ui.getByRole('link', { name: 'New job' }).getAttribute('href'), '/workshop/diary?customer=5');
  const details = within(ui.getByRole('region', { name: 'Details' }));
  assert.ok(details.getByRole('button', { name: 'Edit' }));
  assert.ok(details.queryByText('12 North Street, Bolton') !== null && details.queryByText('BL1 2AB') !== null);
  assert.ok(details.queryByText('Club members · 10% off') !== null);
  assert.ok(details.queryByText('Prefers texts, not calls') !== null);
  const bikes = within(await ui.findByRole('region', { name: 'Bikes' }));
  assert.ok((await bikes.findByText('Trek Domane AL 3')) !== null);
  assert.ok(bikes.queryByText('Green') !== null);
  const glance = within(ui.getByRole('region', { name: 'At a glance' }));
  assert.ok(glance.queryByText('Happy to hear about offers') !== null && glance.queryByText('On') !== null);
});

test('History: what’s open now, then earlier, newest first, each row as drawn', async () => {
  const { ui, within } = await open();
  const hist = within(await ui.findByRole('region', { name: 'History' }));
  const openNow = within(await hist.findByRole('list', { name: 'Open now' }));
  const job = openNow.getByRole('link', { name: /WH-1042/ });
  assert.equal(job.getAttribute('href'), '/workshop/diary?job=42');
  assert.ok(job.textContent.includes('Standard service') && job.textContent.includes('Thu 17 Sep · Alex Morgan'), job.textContent);
  const earlier = within(hist.getByRole('list', { name: 'Earlier, newest first' }));
  const rows = earlier.getAllByRole('listitem').map((li) => li.textContent);
  assert.ok(rows[0].includes('Sale 41') && rows[0].includes('Inner tube × 2') && rows[0].includes('£10.00'), rows[0]);
  assert.ok(rows[1].includes('Text') && rows[1].includes('Bike ready') && rows[1].includes('sent to 07700 900142'), rows[1]);
  assert.ok(rows[2].includes('WH-1030'), 'the collected job is earlier');
});

test('History’s Jobs, Sales and Messages show only theirs', async () => {
  const { ui, fireEvent, within } = await open();
  const hist = within(await ui.findByRole('region', { name: 'History' }));
  await hist.findByRole('list', { name: 'Open now' });
  fireEvent.click(hist.getByRole('button', { name: 'Sales' }));
  assert.equal(hist.getByRole('button', { name: 'Sales' }).getAttribute('aria-pressed'), 'true');
  const texts = hist.getAllByRole('listitem').map((li) => li.textContent);
  assert.ok(texts.length === 1 && texts[0].includes('Sale 41'), texts.join(' | '));
  fireEvent.click(hist.getByRole('button', { name: 'Jobs' }));
  assert.equal(hist.getAllByRole('listitem').length, 2);
});

test('more than eight show eight, then Show all with how many', async () => {
  const many = Array.from({ length: 11 }, (_, i) => ({ ...TEXT, id: 100 + i, at: `2026-05-${String(20 - i).padStart(2, '0')}T09:00:00.000Z` }));
  const { ui, fireEvent, within } = await open({ items: many });
  const hist = within(await ui.findByRole('region', { name: 'History' }));
  await hist.findByRole('list', { name: 'Earlier, newest first' });
  assert.equal(hist.getAllByRole('listitem').length, 8);
  fireEvent.click(hist.getByRole('button', { name: 'Show all (11)' }));
  assert.equal(hist.getAllByRole('listitem').length, 11);
});

test('someone new: History says Nothing yet, with New job', async () => {
  const { ui, within } = await open({ items: [] });
  const hist = within(await ui.findByRole('region', { name: 'History' }));
  assert.ok((await hist.findByText('Nothing yet')) !== null);
  assert.ok(hist.queryByText('Jobs, sales and messages show here, newest first.') !== null);
  assert.equal(hist.getByRole('link', { name: 'New job' }).getAttribute('href'), '/workshop/diary?customer=5');
});

test('Edit: nothing changes until Save changes; Cancel changes nothing', async () => {
  const { ui, fireEvent, within, waitFor } = await open();
  fireEvent.click(ui.getByRole('button', { name: 'Edit' }));
  let dialog = within(await ui.findByRole('dialog', { name: 'Edit Maya Patel’s details' }));
  assert.ok(dialog.queryByText('Nothing changes until you save') !== null);
  assert.equal(dialog.getByLabelText('Postcode').value, 'BL1 2AB');
  fireEvent.change(dialog.getByLabelText('Postcode'), { target: { value: 'BL9 9ZZ' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => assert.ok(ui.queryByRole('dialog') === null));
  assert.deepEqual(puts(), []);
  fireEvent.click(ui.getByRole('button', { name: 'Edit' }));
  dialog = within(await ui.findByRole('dialog', { name: 'Edit Maya Patel’s details' }));
  fireEvent.change(dialog.getByLabelText('Postcode'), { target: { value: 'BL9 9ZZ' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => assert.equal(puts().length, 1));
  assert.equal(puts()[0].postcode, 'BL9 9ZZ');
  assert.ok(!('groupIds' in puts()[0]), 'the group isn’t touched, so the server keeps it');
  assert.ok((await ui.findByText('BL9 9ZZ')) !== null, 'the page shows it');
});

test('Edit keeps Add’s rules: a name, and a phone or an email', async () => {
  const { ui, fireEvent, within } = await open();
  fireEvent.click(ui.getByRole('button', { name: 'Edit' }));
  const dialog = within(await ui.findByRole('dialog', { name: 'Edit Maya Patel’s details' }));
  fireEvent.change(dialog.getByLabelText('Phone'), { target: { value: '' } });
  fireEvent.change(dialog.getByLabelText('Email'), { target: { value: '' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Save changes' }));
  assert.ok((await dialog.findByRole('alert')).textContent.includes('A phone number or an email — at least one.'));
  assert.deepEqual(puts(), []);
});

test('a customer who isn’t there says so', async () => {
  const { ui } = await open({ who: { ...MAYA, id: 404, name: 'Nobody' }, expect: 'There’s no such customer.' });
  assert.ok(ui.queryByRole('heading', { level: 2, name: 'Nobody' }) === null);
});

test('a job still open is in Open now even when eight newer things come before it (review)', async () => {
  const newer = Array.from({ length: 9 }, (_, i) => ({ ...TEXT, id: 200 + i, at: `2026-10-${String(10 + i).padStart(2, '0')}T09:00:00.000Z` }));
  const { ui, within } = await open({ items: [...newer, { ...JOB, at: '2026-09-01T09:00:00.000Z' }] });
  const hist = within(await ui.findByRole('region', { name: 'History' }));
  const openNow = within(await hist.findByRole('list', { name: 'Open now' }));
  assert.ok(openNow.queryByRole('link', { name: /WH-1042/ }) !== null);
});

test('saving Edit keeps every group the customer is in (review)', async () => {
  const { ui, fireEvent, within, waitFor } = await open({ who: { ...MAYA, groups: [{ id: 3, name: 'Club members', discountPercent: 10 }, { id: 4, name: 'Staff', discountPercent: 20 }] } });
  fireEvent.click(ui.getByRole('button', { name: 'Edit' }));
  const dialog = within(await ui.findByRole('dialog', { name: 'Edit Maya Patel’s details' }));
  fireEvent.change(dialog.getByLabelText('Note'), { target: { value: 'Rides to work' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => assert.equal(puts().length, 1));
  assert.ok(!('groupIds' in puts()[0]) || JSON.stringify(puts()[0].groupIds) === '[3,4]', JSON.stringify(puts()[0]));
});

test('an address that isn’t a customer’s number says there’s no such customer (review)', async () => {
  const { ui } = await open({ who: { ...MAYA, id: 'abc', name: 'Nobody' }, expect: 'There’s no such customer.' });
  assert.ok(ui.queryByText('There’s no such customer.') !== null);
});
