// The staff app's frame: the rooms sidebar, the phone menu, where you land.
// Spec: docs/superpowers/specs/2026-10-03-staff-shell-design.md
//
// Assertions compare true/false rather than elements: printing a jsdom
// element in a failure message takes Node most of a minute.
//
// Rendered in jsdom from the test build, with /api/auth/me stubbed in
// serializeSession's real shape. jsdom applies no Tailwind, so the computer,
// tablet and phone layouts are all in the page; screen size is checked in a
// browser, and these tests check what each layout says and does.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const STAFF = { ...OWNER, id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false };

const realFetch = globalThis.fetch;
let uninstall;
let calls;
let shell;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

function stubServer(me) {
  calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, method: options.method ?? 'GET' });
    if (url === '/api/auth/me') {
      return me ? { status: 200, ok: true, json: async () => me } : { status: 401, ok: false, json: async () => ({ error: 'Not signed in' }) };
    }
    if (url === '/api/auth/logout') return { status: 200, ok: true, json: async () => ({ ok: true }) };
    return { status: 404, ok: false, json: async () => ({ error: 'Not found' }) };
  };
}

async function renderAt(path, me) {
  uninstall = installDom(`http://localhost${path}`);
  stubServer(me);
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  return { ...rtl, ui: rtl.render(createElement(shell.AppShell)) };
}

// The computer sidebar: the first "Main" navigation in the page.
async function sidebar(ui) {
  const navs = await ui.findAllByRole('navigation', { name: 'Main' });
  return navs[0];
}

test('the owner sees the four rooms, each with its items', async () => {
  const { ui, within } = await renderAt('/workshop/diary', OWNER);
  const nav = within(await sidebar(ui));
  for (const room of ['Front desk', 'Workshop', 'Stockroom', 'Office']) assert.ok(nav.getByText(room));
  for (const label of ['Till', 'Online orders', 'Cycle to Work', 'Customers', 'Messages', 'Diary', 'Overview', 'Stock', 'Deliveries and orders', 'Stock take', 'Today', 'Reports', 'Website', 'Settings']) {
    assert.ok(nav.getByRole('link', { name: label }), `${label} missing`);
  }
});

test('the page you are on is marked as the current page, and only that one', async () => {
  const { ui, within } = await renderAt('/workshop/diary', OWNER);
  const nav = within(await sidebar(ui));
  assert.equal(nav.getByRole('link', { name: 'Diary' }).getAttribute('aria-current'), 'page');
  assert.equal(nav.getByRole('link', { name: 'Till' }).getAttribute('aria-current'), null);
  assert.equal(nav.getByRole('link', { name: 'Diary' }).getAttribute('href'), '/workshop/diary');
});

test('staff do not see Reports, Website or Settings', async () => {
  const { ui, within } = await renderAt('/workshop/till', STAFF);
  const nav = within(await sidebar(ui));
  assert.ok(nav.getByRole('link', { name: 'Today' }));
  for (const label of ['Reports', 'Website', 'Settings']) assert.equal(Boolean(nav.queryByRole('link', { name: label })), false, `${label} should be hidden`);
});

test('each page is titled with its name and shows the placeholder until it is built', async () => {
  const { ui } = await renderAt('/workshop/stock', OWNER);
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Stock' }));
  assert.ok(ui.getByText('Not built yet: stock'));
});

test('the owner lands on Today', async () => {
  const { ui } = await renderAt('/workshop', OWNER);
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Today' }));
  assert.equal(window.location.pathname, '/workshop/today');
});

test('staff land on the Till', async () => {
  const { ui } = await renderAt('/workshop', STAFF);
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Till' }));
  assert.equal(window.location.pathname, '/workshop/till');
});

test('the footer names you and your role, and opens Your settings', async () => {
  const { ui, within } = await renderAt('/workshop/diary', OWNER);
  const link = within(await sidebar(ui)).getByRole('link', { name: 'Your settings — Jack Lewis, Owner' });
  assert.equal(link.getAttribute('href'), '/workshop/your-settings');
  assert.ok(within(link).getByText('JL'));
});

test('Sign out signs you out on the server', async () => {
  const { ui, within, fireEvent, waitFor } = await renderAt('/workshop/diary', OWNER);
  fireEvent.click(within(await sidebar(ui)).getByRole('button', { name: 'Sign out' }));
  await waitFor(() => assert.ok(calls.some((c) => c.url === '/api/auth/logout' && c.method === 'POST')));
});

test('on a phone the menu opens, takes focus, and Escape closes it and returns focus', async () => {
  const { ui, fireEvent, waitFor, within } = await renderAt('/workshop/diary', OWNER);
  const open = await ui.findByRole('button', { name: 'Open menu' });
  assert.equal(Boolean(ui.queryByRole('dialog', { name: 'Menu' })), false);
  fireEvent.click(open);
  const menu = await ui.findByRole('dialog', { name: 'Menu' });
  assert.ok(within(menu).getByRole('navigation', { name: 'Main' }));
  await waitFor(() => assert.ok(document.activeElement === within(menu).getByRole('button', { name: 'Close menu' }), 'focus is not on Close menu'));
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => assert.equal(Boolean(ui.queryByRole('dialog', { name: 'Menu' })), false));
  assert.ok(document.activeElement === open, 'focus did not return to Open menu');
});

test('choosing a page from the phone menu opens it and closes the menu', async () => {
  const { ui, fireEvent, within, waitFor } = await renderAt('/workshop/diary', OWNER);
  fireEvent.click(await ui.findByRole('button', { name: 'Open menu' }));
  const menu = await ui.findByRole('dialog', { name: 'Menu' });
  fireEvent.click(within(menu).getByRole('link', { name: 'Customers' }));
  await waitFor(() => assert.equal(Boolean(ui.queryByRole('dialog', { name: 'Menu' })), false));
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Customers' }));
});

test('signed out, the app says so and links to sign in', async () => {
  const { ui } = await renderAt('/workshop/diary', null);
  assert.ok(await ui.findByText("You're signed out."));
  assert.equal(ui.getByRole('link', { name: 'Sign in' }).getAttribute('href'), '/');
});

test('an edge screen opened from a customer\'s link has no staff sidebar', async () => {
  const { ui } = await renderAt('/workshop/booking/42/reschedule', OWNER);
  assert.ok(await ui.findByText('Not built yet: reschedule'));
  assert.equal(Boolean(ui.queryByRole('navigation', { name: 'Main' })), false);
});
