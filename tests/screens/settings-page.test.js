// The first Settings page (Jack, 18 Oct, mechanic sign-off piece 3; drawn as
// set-workshop-sign-off): Workshop › Mechanics holds "Show who signed off to
// customers", off to start, saved as soon as it's switched.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let settings;
let putFails;
let details;
let detailsFail;
let holdDetails = null;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

async function openSettings() {
  calls = [];
  settings = { openingHours: [], showSignOffToCustomers: false };
  putFails = false;
  details = { name: 'North Street Cycles', address: null, phone: null, email: null, vatNumber: null };
  detailsFail = false;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/shop-details' && method === 'PUT') {
      if (detailsFail) return reply(500, { error: 'Internal error' });
      details = { ...details, ...body };
      const answer = reply(200, { ...details });
      if (holdDetails) { const wait = holdDetails; holdDetails = null; await wait; }
      return answer;
    }
    if (u.pathname === '/api/shop-details') return reply(200, details);
    if (u.pathname === '/api/workshop-settings' && method === 'PUT') {
      if (putFails) return reply(500, { error: 'Internal error' });
      settings = { ...settings, ...body };
      return reply(200, settings);
    }
    if (u.pathname === '/api/workshop-settings') return reply(200, settings);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom('http://localhost/workshop/settings');
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByRole('heading', { name: 'Workshop' });
  return { ...rtl, ui };
}
const has = (q) => Boolean(q);

test('Settings › Workshop › Mechanics has the switch, off, with its note', async () => {
  const { ui } = await openSettings();
  // The staff frame's header names the page, once.
  assert.equal(ui.getAllByRole('heading', { level: 1, name: 'Settings' }).length, 1);
  assert.ok(has(ui.queryByText('Services, who works in the workshop, and how the diary looks.')));
  assert.ok(has(ui.queryByRole('heading', { name: 'Mechanics' })));
  const sw = await ui.findByRole('switch', { name: 'Show who signed off to customers' });
  assert.equal(sw.getAttribute('aria-checked'), 'false');
  assert.ok(has(ui.queryByText('Off')));
  assert.ok(has(ui.queryByText('Adds “Checked by [name]” to their receipt and booking link. Off: only staff see who signed a job off.')));
});

test('switching it on saves at once, and it reads On', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  const sw = await ui.findByRole('switch', { name: 'Show who signed off to customers' });
  fireEvent.click(sw);
  await waitFor(() => assert.deepEqual(calls.filter((c) => c.method === 'PUT').map((c) => c.body), [{ showSignOffToCustomers: true }]));
  await waitFor(() => assert.equal(sw.getAttribute('aria-checked'), 'true'));
  assert.ok(has(ui.queryByText('On')));
});

test('if it can’t be saved, it says so and stays as it was', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  putFails = true;
  const sw = await ui.findByRole('switch', { name: 'Show who signed off to customers' });
  fireEvent.click(sw);
  assert.ok(has(await ui.findByText('Wheelhouse couldn’t save that. Try again in a moment.')));
  await waitFor(() => assert.equal(sw.getAttribute('aria-checked'), 'false'));
});

// Shop details (Jack, 18 Oct, docs/decisions/2026-10-18-shop-details.md; drawn
// as set-shop-details): five boxes, each saved when it's left if it changed.
test('Shop and sites › Shop details shows the five boxes and the note', async () => {
  const { ui } = await openSettings();
  assert.ok(has(ui.queryByRole('heading', { name: 'Shop and sites' })));
  assert.ok(has(ui.queryByRole('heading', { name: 'Shop details' })));
  assert.equal((await ui.findByLabelText('Shop name')).value, 'North Street Cycles');
  for (const label of ['Address', 'Phone', 'Email', 'VAT number']) assert.equal(ui.getByLabelText(label).value, '', label);
  assert.ok(has(ui.queryByText('These show on receipts, emails and the website.')));
});

test('a box saves when it’s left, only if it changed, and says Saved', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  const address = await ui.findByLabelText('Address');
  fireEvent.blur(ui.getByLabelText('Phone'));
  fireEvent.change(address, { target: { value: '[Shop address]' } });
  fireEvent.blur(address);
  await waitFor(() => assert.deepEqual(calls.filter((c) => c.method === 'PUT' && c.url === '/api/shop-details').map((c) => c.body), [{ address: '[Shop address]' }]));
  assert.ok(has(await ui.findByText('Saved.')));
});

test('if a box can’t be saved, it says so and keeps what was typed', async () => {
  const { ui, fireEvent } = await openSettings();
  detailsFail = true;
  const vat = await ui.findByLabelText('VAT number');
  fireEvent.change(vat, { target: { value: '[VAT number]' } });
  fireEvent.blur(vat);
  assert.ok(has(await ui.findByText('Wheelhouse couldn’t save that. Try again in a moment.')));
  assert.equal(vat.value, '[VAT number]');
});

// Fresh review: what's typed while a save is on its way isn't lost, and a
// reply only updates the box it saved.
test('typing more while a box is saving keeps the new words, and they save too', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  let release;
  holdDetails = new Promise((r) => { release = r; });
  const address = await ui.findByLabelText('Address');
  fireEvent.change(address, { target: { value: '12 High St' } });
  fireEvent.blur(address);
  await waitFor(() => assert.equal(calls.filter((c) => c.method === 'PUT').length, 1));
  fireEvent.change(address, { target: { value: '12 High St, Leeds' } });
  release();
  assert.ok(has(await ui.findByText('Saved.')));
  assert.equal(address.value, '12 High St, Leeds');
  fireEvent.blur(address);
  await waitFor(() => assert.deepEqual(calls.filter((c) => c.method === 'PUT').map((c) => c.body), [{ address: '12 High St' }, { address: '12 High St, Leeds' }]));
});
