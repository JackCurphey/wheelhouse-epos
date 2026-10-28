// Giving a PIN at the till (openspec/changes/give-pin-at-till; drawn in
// signin.mjs as till-serving-menu, till-serving-menu-several,
// till-give-pin-pick and till-give-pin; Jack's answers 28 Oct, 3 to 5).
// The Owner serving taps "Serving: Jack Lewis": with nobody to give a PIN
// to it switches at once, as built; otherwise a menu offers Switch who’s
// serving and the PIN to give, straight away for one person or from "Who’s
// getting a PIN?" for several; "[Name]’s till PIN" keeps a PIN Wheelhouse
// picked and the till goes back to Enter your PIN.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const JACK = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street', employee: null };
const JACK_SERVING = { id: 11, name: 'Jack Lewis' };
// The drawings' two people with no PIN: Jo Taylor (invited) and the till-only [Name].
const JO = { id: 21, name: 'Jo Taylor', role: 'Staff', tillOnly: false };
const NAME = { id: 31, name: '[Name]', role: 'Staff', tillOnly: true };
const SERVICES = [{ id: 1, name: 'Fit & adjust brakes', price: 18, minutes: 30, active: true }];

let current;
afterEach(async () => {
  if (!current) return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current?.shell.queryClient.clear();
  current?.uninstall();
  globalThis.fetch = current.realFetch;
  current = undefined;
});

async function open({ givePin = [NAME], offers = ['7305', '4182'], keep = null, width = 1024 } = {}) {
  const calls = [];
  const server = { serving: JACK_SERVING, givePin, offers: [...offers] };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, JACK);
    if (u.pathname === '/api/till-checkin/end') { server.serving = null; return reply(200, { serving: null }); }
    if (u.pathname === '/api/till-checkin') return reply(200, { serving: server.serving, checkedInToday: [JACK_SERVING], givePin: server.serving ? server.givePin : [] });
    const give = u.pathname.match(/^\/api\/till-checkin\/give-pin\/(\d+)(\/offer)?$/);
    if (give && give[2] && method === 'DELETE') return reply(200, { ok: true });
    if (give && give[2]) return reply(201, { pin: server.offers.shift() });
    if (give) {
      const k = keep ?? { status: 200, body: { serving: null } };
      if (k.status === 200) { server.serving = null; server.givePin = server.givePin.filter((p) => p.id !== Number(give[1])); }
      return reply(k.status, k.body);
    }
    if (u.pathname === '/api/your-settings') return reply(200, { accessibility: {} });
    if (u.pathname === '/api/float-check') return reply(200, { day: '2026-09-01', floatPence: null, takesPayments: true, firstDay: false, check: null });
    if (u.pathname === '/api/workshop-services') return reply(200, SERVICES);
    if (u.pathname === '/api/shop-details') return reply(200, { name: 'North Street Cycles' });
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    return reply(404, { error: 'Not found' });
  };
  const uninstall = installDom('http://localhost/workshop/till');
  window.innerWidth = width;
  window.WH_TILL_TICK_MS = 20;
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  const shell = await importFresh(SHELL);
  current = { shell, uninstall, realFetch };
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui, calls, server };
}
const posts = (t, path) => t.calls.filter((c) => c.method === 'POST' && c.url === path);
const withdrawn = (t, id) => t.calls.filter((c) => c.method === 'DELETE' && c.url === `/api/till-checkin/give-pin/${id}/offer`).length;
const serving = (t) => t.ui.findByRole('button', { name: 'Serving: Jack Lewis' });

test('with nobody to give a PIN to, Serving switches at once, as built', async () => {
  const t = await open({ givePin: [] });
  const button = await t.ui.findByRole('button', { name: 'Serving: Jack Lewis — switch who’s serving' });
  assert.equal(button.getAttribute('aria-haspopup'), null);
  t.fireEvent.click(button);
  await t.ui.findByRole('heading', { name: 'Enter your PIN' });
  assert.equal(posts(t, '/api/till-checkin/end').length, 1);
});

test('one person with no PIN: the menu offers Switch who’s serving and Give [Name] their PIN', async () => {
  const t = await open();
  const button = await serving(t);
  assert.equal(button.getAttribute('aria-haspopup'), 'menu');
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  t.fireEvent.click(button);
  const menu = t.ui.getByRole('menu', { name: 'Serving: Jack Lewis' });
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  const items = t.within(menu).getAllByRole('menuitem');
  assert.deepEqual(items.map((i) => i.getAttribute('aria-label')), ['Switch who’s serving', 'Give [Name] their PIN']);
  assert.match(items[0].textContent, /Back to Enter your PIN/);
  assert.match(items[1].textContent, /Till only · no PIN yet/);
  // Nothing was switched by opening it.
  assert.equal(posts(t, '/api/till-checkin/end').length, 0);
});

test('Give [Name] their PIN: [Name]’s till PIN, another on request, Keep, and back to Enter your PIN', async () => {
  const t = await open();
  t.fireEvent.click(await serving(t));
  t.fireEvent.click(t.ui.getByRole('menuitem', { name: 'Give [Name] their PIN' }));
  const pop = await t.ui.findByRole('dialog', { name: '[Name]’s till PIN' });
  assert.ok(t.ui.queryByRole('menu') === null, 'the menu closes');
  assert.match(pop.textContent, /Turn the screen to \[Name\]\. Wheelhouse picked this PIN — nobody else at the shop has it\. \[Name\] learns it now; only they should see it\./);
  assert.match(pop.textContent, /Then the till goes back to the PIN screen, ready for \[Name\] to check in\./);
  await t.within(pop).findByText('[Name]’s PIN 7 3 0 5');
  assert.equal(posts(t, '/api/till-checkin/give-pin/31/offer').length, 1);
  await t.waitFor(() => assert.equal(document.activeElement?.textContent, 'Keep this PIN'));
  t.fireEvent.click(t.within(pop).getByRole('button', { name: 'Give me a different one' }));
  await t.within(pop).findByText('[Name]’s PIN 4 1 8 2');
  assert.equal(posts(t, '/api/till-checkin/give-pin/31/offer').length, 2);
  t.fireEvent.click(t.within(pop).getByRole('button', { name: 'Keep this PIN' }));
  await t.ui.findByRole('heading', { name: 'Enter your PIN' });
  assert.deepEqual(posts(t, '/api/till-checkin/give-pin/31').map((c) => c.body), [{ pin: '4182' }]);
  assert.ok(t.ui.queryByRole('dialog', { name: '[Name]’s till PIN' }) === null);
});

test('several with no PIN: Give someone their PIN opens Who’s getting a PIN?, then their PIN', async () => {
  const t = await open({ givePin: [JO, NAME] });
  t.fireEvent.click(await serving(t));
  const item = t.ui.getByRole('menuitem', { name: 'Give someone their PIN' });
  assert.match(item.textContent, /2 people have no PIN yet/);
  t.fireEvent.click(item);
  const pick = await t.ui.findByRole('dialog', { name: 'Who’s getting a PIN?' });
  assert.match(pick.textContent, /These people have no PIN yet\. Tap a name, then turn the screen to them\./);
  const names = t.within(pick).getAllByRole('button').filter((b) => b.getAttribute('aria-label') !== 'Close without giving a PIN');
  assert.deepEqual(names.map((b) => b.textContent), ['JJo TaylorStaff', '[Name]Staff · till only']);
  assert.equal(posts(t, '/api/till-checkin/give-pin/21/offer').length, 0, 'no PIN until a name is tapped');
  t.fireEvent.click(names[0]);
  const pop = await t.ui.findByRole('dialog', { name: 'Jo Taylor’s till PIN' });
  assert.ok(t.ui.queryByRole('dialog', { name: 'Who’s getting a PIN?' }) === null);
  await t.within(pop).findByText('Jo Taylor’s PIN 7 3 0 5');
  assert.equal(posts(t, '/api/till-checkin/give-pin/21/offer').length, 1);
});

test('Close without giving a PIN gives nobody a PIN, and the Owner is still serving', async () => {
  const t = await open({ givePin: [JO, NAME] });
  t.fireEvent.click(await serving(t));
  t.fireEvent.click(t.ui.getByRole('menuitem', { name: 'Give someone their PIN' }));
  const pick = await t.ui.findByRole('dialog', { name: 'Who’s getting a PIN?' });
  t.fireEvent.click(t.within(pick).getByRole('button', { name: 'Close without giving a PIN' }));
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog', { name: 'Who’s getting a PIN?' }) === null));
  // And from the PIN itself.
  t.fireEvent.click(await serving(t));
  t.fireEvent.click(t.ui.getByRole('menuitem', { name: 'Give someone their PIN' }));
  t.fireEvent.click(t.within(await t.ui.findByRole('dialog', { name: 'Who’s getting a PIN?' })).getByText('[Name]').closest('button'));
  const pop = await t.ui.findByRole('dialog', { name: '[Name]’s till PIN' });
  await t.within(pop).findByText('[Name]’s PIN 7 3 0 5');
  t.fireEvent.click(t.within(pop).getByRole('button', { name: 'Close without giving a PIN' }));
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog', { name: '[Name]’s till PIN' }) === null));
  assert.equal(posts(t, '/api/till-checkin/give-pin/31').length, 0);
  // The PIN shown is withdrawn, so nobody can keep it afterwards (review, 28 Oct).
  await t.waitFor(() => assert.equal(withdrawn(t, 31), 1));
  assert.ok(await serving(t));
  assert.ok(t.ui.getByRole('region', { name: 'Sale' }));
});

test('Escape closes the PIN pop-up as its ✕ does', async () => {
  const t = await open();
  t.fireEvent.click(await serving(t));
  t.fireEvent.click(t.ui.getByRole('menuitem', { name: 'Give [Name] their PIN' }));
  const pop = await t.ui.findByRole('dialog', { name: '[Name]’s till PIN' });
  await t.within(pop).findByText('[Name]’s PIN 7 3 0 5');
  // The browser closes a native dialog on Escape (the 'close' event). Closed
  // for good: the focus goes back to Serving, and no pop-up opens again.
  pop.close();
  const button = await serving(t);
  await t.waitFor(() => assert.ok(document.activeElement === button, 'the focus is back on Serving'));
  assert.ok(t.ui.queryByRole('dialog', { name: '[Name]’s till PIN' }) === null);
  assert.equal(posts(t, '/api/till-checkin/give-pin/31').length, 0);
  await t.waitFor(() => assert.equal(withdrawn(t, 31), 1));
});

test('Switch who’s serving from the menu goes back to Enter your PIN', async () => {
  const t = await open();
  t.fireEvent.click(await serving(t));
  t.fireEvent.click(t.ui.getByRole('menuitem', { name: 'Switch who’s serving' }));
  await t.ui.findByRole('heading', { name: 'Enter your PIN' });
  assert.equal(posts(t, '/api/till-checkin/end').length, 1);
});

test('the menu by keyboard: focus on the first item, arrows move, Escape back to Serving', async () => {
  const t = await open();
  const button = await serving(t);
  t.fireEvent.click(button);
  const menu = t.ui.getByRole('menu', { name: 'Serving: Jack Lewis' });
  await t.waitFor(() => assert.equal(document.activeElement?.getAttribute('aria-label'), 'Switch who’s serving'));
  t.fireEvent.keyDown(menu, { key: 'ArrowDown' });
  assert.equal(document.activeElement?.getAttribute('aria-label'), 'Give [Name] their PIN');
  t.fireEvent.keyDown(menu, { key: 'ArrowDown' });
  assert.equal(document.activeElement?.getAttribute('aria-label'), 'Switch who’s serving', 'round to the top');
  t.fireEvent.keyDown(menu, { key: 'Escape' });
  assert.ok(t.ui.queryByRole('menu') === null);
  // Compared with ===: assert.equal on a DOM node hangs on failure (CLAUDE.md).
  assert.ok(document.activeElement === button, 'the focus is back on Serving');
  assert.equal(button.getAttribute('aria-expanded'), 'false');
});

test('Tab leaves the menu with the focus back on Serving', async () => {
  const t = await open();
  const button = await serving(t);
  t.fireEvent.click(button);
  const menu = t.ui.getByRole('menu', { name: 'Serving: Jack Lewis' });
  await t.waitFor(() => assert.equal(document.activeElement?.getAttribute('aria-label'), 'Switch who’s serving'));
  t.fireEvent.keyDown(menu, { key: 'Tab' });
  assert.ok(t.ui.queryByRole('menu') === null);
  assert.ok(document.activeElement === button, 'the focus is back on Serving');
});

test('a click away closes the menu', async () => {
  const t = await open();
  t.fireEvent.click(await serving(t));
  assert.ok(t.ui.getByRole('menu'));
  t.fireEvent.mouseDown(document.body);
  await t.waitFor(() => assert.ok(t.ui.queryByRole('menu') === null));
});

test('on a phone the menu is a sheet headed Serving: Jack Lewis, with Close', async () => {
  const t = await open({ width: 390 });
  t.fireEvent.click(await serving(t));
  const sheet = await t.ui.findByRole('dialog', { name: 'Serving: Jack Lewis' });
  assert.ok(t.within(sheet).getByRole('menu', { name: 'Serving: Jack Lewis' }));
  assert.ok(t.within(sheet).getByRole('menuitem', { name: 'Give [Name] their PIN' }));
  t.fireEvent.click(t.within(sheet).getByRole('button', { name: 'Close' }));
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog', { name: 'Serving: Jack Lewis' }) === null));
  assert.equal(posts(t, '/api/till-checkin/end').length, 0);
});

test('a PIN someone kept meanwhile says so, and the pop-up stays', async () => {
  const t = await open({ keep: { status: 409, body: { error: 'Someone has just been given that PIN. Ask for a different one.', code: 'pin_taken' } } });
  t.fireEvent.click(await serving(t));
  t.fireEvent.click(t.ui.getByRole('menuitem', { name: 'Give [Name] their PIN' }));
  const pop = await t.ui.findByRole('dialog', { name: '[Name]’s till PIN' });
  await t.within(pop).findByText('[Name]’s PIN 7 3 0 5');
  t.fireEvent.click(t.within(pop).getByRole('button', { name: 'Keep this PIN' }));
  assert.equal((await t.within(pop).findByRole('alert')).textContent, 'Someone has just been given that PIN. Ask for a different one.');
  assert.ok(t.ui.getByRole('dialog', { name: '[Name]’s till PIN' }));
});

test('Enter your PIN says how to get a PIN, as drawn', async () => {
  const t = await open({ givePin: [] });
  t.fireEvent.click(await t.ui.findByRole('button', { name: 'Serving: Jack Lewis — switch who’s serving' }));
  await t.ui.findByRole('heading', { name: 'Enter your PIN' });
  const line = t.ui.getByText('No PIN yet?').closest('p');
  assert.equal(line.textContent, 'No PIN yet? Sign in on your phone, or ask the owner or a manager to give you one here.');
});
