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
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
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
