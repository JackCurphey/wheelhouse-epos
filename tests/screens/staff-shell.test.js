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

// me: the signed-in person, null when signed out, or 'expired' for a
// session that has run out (staff-signin-workos-screens design 2).
function stubServer(me) {
  calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, method: options.method ?? 'GET' });
    if (url === '/api/auth/me') {
      if (me === 'expired') return { status: 401, ok: false, json: async () => ({ error: 'Not signed in', reason: 'expired' }) };
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
  // Where the page sends the browser, which jsdom can't follow.
  const went = [];
  shell.pageNav.go = (url) => went.push(url);
  return { ...rtl, went, ui: rtl.render(createElement(shell.AppShell)) };
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
  // Stock take: not built yet (the stock list is, since the stock-list change).
  const { ui } = await renderAt('/workshop/stocktake', OWNER);
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Stock take' }));
  assert.ok(ui.getByText('Not built yet: stocktake'));
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

// staff-signin-workos: signing out of a WorkOS sign-in ends it at WorkOS too,
// so the next person at this computer signs in again; otherwise the staff
// app's signed-out page, which links to WorkOS.
for (const [said, goes] of [[{ ok: true, signOutUrl: 'https://api.workos.com/user_management/sessions/logout?session_id=s1' }, 'https://api.workos.com/user_management/sessions/logout?session_id=s1'], [{ ok: true }, '/workshop/signed-out']]) {
  test(`Sign out then goes to ${goes}`, async () => {
    const { ui, within, fireEvent, waitFor, went } = await renderAt('/workshop/diary', OWNER);
    const stubbed = globalThis.fetch;
    globalThis.fetch = async (url, options) => (url === '/api/auth/logout'
      ? { status: 200, ok: true, json: async () => said }
      : stubbed(url, options));
    fireEvent.click(within(await sidebar(ui)).getByRole('button', { name: 'Sign out' }));
    await waitFor(() => assert.deepEqual(went, [goes]));
  });
}

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

// staff-signin-workos-screens: the drawn pages around signing in and out.
const START = '/api/auth/workos/start';

// staff-signin-google: signed out, Wheelhouse's own sign-in screen, drawn as staff-signin.
const SIGN_IN = '/workshop/sign-in';
test('signed out on the diary: “Sign in to Wheelhouse”, Google or email, both back to the diary', async () => {
  const { ui, went } = await renderAt('/workshop/diary', null);
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Sign in to Wheelhouse' }));
  assert.equal(ui.getByRole('link', { name: 'Continue with Google' }).getAttribute('href'), `${START}?provider=google&from=%2Fworkshop%2Fdiary`);
  assert.equal(ui.getByRole('link', { name: 'Sign in with email' }).getAttribute('href'), `${START}?from=%2Fworkshop%2Fdiary`);
  assert.ok(ui.getByText('or'));
  assert.deepEqual(went, [], 'no jump to WorkOS');
});

// Google's official G (signin-assets.zip, Google's Sign in with Google branding
// kit, 27 Oct; Jack chose the kit), not the "[G]" stand-in: its outline is the
// kit's own path, unchanged, and it's hidden from screen readers as the words say it.
test('Continue with Google carries Google’s own G, not a stand-in', async () => {
  const { ui } = await renderAt('/workshop/diary', null);
  const google = await ui.findByRole('link', { name: 'Continue with Google' });
  assert.ok(!google.textContent.includes('[G]'), 'the stand-in is gone');
  const g = google.querySelector('svg[data-google-g]');
  assert.ok(g !== null, 'the G is in the button');
  assert.equal(g.getAttribute('aria-hidden'), 'true');
  assert.ok(g.querySelector('path[d^="M29.3987 18.1814H19.9849V22.0445H25.3598"]') !== null, 'Google’s own G outline');
});

test('/workshop/sign-in shows it even with a session that has run out, so Sign in again can’t go round in a loop', async () => {
  const { ui } = await renderAt(`${SIGN_IN}?from=%2Fworkshop%2Fdiary`, 'expired');
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Sign in to Wheelhouse' }));
  assert.equal(ui.getByRole('link', { name: 'Sign in with email' }).getAttribute('href'), `${START}?from=%2Fworkshop%2Fdiary`);
});

test('/workshop/sign-in shows it, going back to its own from', async () => {
  const { ui } = await renderAt(`${SIGN_IN}?from=%2Fworkshop%2Fcustomers`, null);
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Sign in to Wheelhouse' }));
  assert.equal(ui.getByRole('link', { name: 'Continue with Google' }).getAttribute('href'), `${START}?provider=google&from=%2Fworkshop%2Fcustomers`);
  const plain = await renderAt(SIGN_IN, null);
  assert.equal((await plain.ui.findByRole('link', { name: 'Sign in with email' })).getAttribute('href'), START);
});

test('after signing out: the drawn auth-signedout page', async () => {
  const { ui, went } = await renderAt('/workshop/signed-out', null);
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'You’ve signed out' }));
  assert.ok(ui.getByText('Close this window, or sign in again.'));
  assert.equal(ui.getByRole('link', { name: 'Sign in again' }).getAttribute('href'), SIGN_IN);
  assert.deepEqual(went, [], 'it doesn’t go on by itself');
});

test('a session that has run out: the drawn auth-expired page, back to this page after', async () => {
  const { ui, went } = await renderAt('/workshop/diary', 'expired');
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Please sign in again' }));
  assert.ok(ui.getByText('You were signed out after a while without activity. Sign in and you’ll be back where you were.'));
  assert.equal(ui.getByRole('link', { name: 'Sign in again' }).getAttribute('href'), `${SIGN_IN}?from=%2Fworkshop%2Fdiary`);
  assert.deepEqual(went, []);
});

// Design 4: not drawn, decided while building.
const FAILED = {
  'not-on-staff': ['That email isn’t on a staff list', 'Sign in with the email your shop has for you, or ask the shop’s owner to add you.', 'Sign in again'],
  unchecked: ['Check your email first', 'WorkOS sent you an email to check it’s yours. Open it, then sign in again.', 'Sign in again'],
  busy: ['Too many tries', 'Wait a few minutes, then try again.', 'Try again'],
  failed: ['That sign-in didn’t work', 'Please try again.', 'Try again'],
  'something-new': ['That sign-in didn’t work', 'Please try again.', 'Try again'],
};
for (const [reason, [heading, line, button]] of Object.entries(FAILED)) {
  test(`a failed sign-in (${reason}) says why and offers “${button}”`, async () => {
    const { ui, went } = await renderAt(`/workshop?signin=${reason}`, null);
    assert.ok(await ui.findByRole('heading', { level: 1, name: heading }));
    assert.ok(ui.getByText(line));
    assert.equal(ui.getByRole('link', { name: button }).getAttribute('href'), SIGN_IN);
    assert.deepEqual(went, []);
  });
}

test('signing in not switched on: says so, with nothing to press', async () => {
  const { ui, went } = await renderAt('/workshop?signin=off', null);
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Signing in isn’t switched on yet' }));
  assert.ok(ui.getByText('Ask whoever runs Wheelhouse for your shop.'));
  assert.equal(ui.queryByRole('link') === null, true);
  assert.deepEqual(went, []);
});

test('an edge screen opened from a customer\'s link has no staff sidebar', async () => {
  const { ui } = await renderAt('/workshop/booking/42/reschedule', OWNER);
  assert.ok(await ui.findByText('Not built yet: reschedule'));
  assert.equal(Boolean(ui.queryByRole('navigation', { name: 'Main' })), false);
});
