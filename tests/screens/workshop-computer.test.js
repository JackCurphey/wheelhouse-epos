// The shared workshop computer, first part (openspec/changes/workshop-computer;
// drawn as till-checkin-workshop in signin.mjs and the Working bar in
// diary.mjs; walk-through 8 decisions 1, 3 and 4; build plan Q6; stage-1
// gaps 4 and 10): Set up this computer's choice, Enter your PIN with no
// till number in place of every page, "Working: [name] · Switch", and back
// to Enter your PIN after 10 minutes idle.
import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const JACK = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street', employee: null };
const BOLTON = { id: 7, name: 'Bolton', code: 'B', taken: [] };
const WORKSHOP = { name: null, siteName: 'Bolton' };
const ALEX = { id: 31, name: 'Alex Morgan' };
// Jack Lewis's own team member: his PIN makes the Owner the person working.
const JACK_WORKING = { id: 11, name: 'Jack Lewis' };
const B1 = { code: 'B1', name: null, siteName: 'Bolton' };
const MINUTE = 60_000;

let current;
afterEach(async () => {
  if (!current) return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current?.shell.queryClient.clear();
  current?.uninstall();
  globalThis.fetch = current.realFetch;
  mock.timers.reset();
  current = undefined;
});

async function open(path, { workshop = WORKSHOP, till = null, serving = null, pinOk = true, checkinFails = false } = {}) {
  const calls = [];
  const state = { serving, workshop };
  const realFetch = globalThis.fetch;
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-01T10:00:00+01:00') });
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    // On a workshop computer the server says Owner only while the Owner is working (design 9).
    if (u.pathname === '/api/auth/me') return reply(200, { ...JACK, isOwner: !state.workshop || state.serving?.id === JACK_WORKING.id, workshopComputer: Boolean(state.workshop) });
    if (u.pathname === '/api/till-setup/workshop') state.workshop = { name: body.name || null, siteName: 'Bolton' };
    if (u.pathname === '/api/till-setup/workshop') return reply(201, { workshop: { id: 4, name: body.name || null, siteName: 'Bolton' } });
    if (u.pathname === '/api/till-setup') return reply(200, { sites: [BOLTON], thisTill: till ? { id: 3, ...till } : null, thisWorkshop: state.workshop ? { id: 4, ...state.workshop } : null, tills: till ? [till.code] : [] });
    if (u.pathname === '/api/till-checkin' && method === 'POST') {
      if (!pinOk) return reply(400, { error: 'That PIN isn’t anyone’s — try again', code: 'wrong_pin' });
      state.serving = body.pin === '1111' ? JACK_WORKING : ALEX;
      return reply(201, { serving: state.serving });
    }
    if (u.pathname === '/api/till-checkin/end') { state.serving = null; return reply(200, { serving: null }); }
    if (u.pathname === '/api/till-checkin/active') return reply(200, { serving: state.serving });
    if (u.pathname === '/api/till-checkin' && checkinFails) return reply(500, { error: 'Internal server error' });
    if (u.pathname === '/api/till-checkin') return reply(200, { serving: state.serving, checkedInToday: state.serving ? [state.serving] : [], givePin: [], till, workshop: state.workshop });
    if (u.pathname === '/api/float-check') return reply(200, { day: '2026-09-01', floatPence: null, takesPayments: true, firstDay: false, check: null });
    if (u.pathname === '/api/your-settings/till-pin/ask') return reply(200, { ask: null });
    if (u.pathname === '/api/your-settings') return reply(200, { accessibility: {} });
    if (u.pathname === '/api/workshop-services') return reply(200, []);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/shop-details') return reply(200, { name: 'North Street Cycles' });
    if (u.pathname === '/api/workshop-jobs') return reply(200, []);
    if (u.pathname === '/api/employees') return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  const uninstall = installDom(`http://localhost${path}`);
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  const shell = await importFresh(SHELL);
  current = { shell, uninstall, realFetch };
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui, calls, state };
}
const posts = (t, path) => t.calls.filter((c) => c.method === 'POST' && c.url === path);
const typePin = (t, pin) => { for (const d of pin) t.fireEvent.click(t.ui.getByRole('button', { name: d })); };
const restart = () => { current.shell.queryClient.clear(); };
// The idle check runs every second on the page's own clock; the test moves the clock.
const later = (ms) => mock.timers.tick(ms);

test('Set up this computer offers a workshop computer: a shop, a name, no number', async () => {
  const t = await open('/workshop/till/setup', { workshop: null });
  await t.ui.findByRole('heading', { name: 'Set up this till' });
  const kinds = t.within(t.ui.getByRole('radiogroup', { name: 'This computer becomes' }));
  assert.deepEqual(kinds.getAllByRole('radio').map((r) => `${r.textContent}${r.getAttribute('aria-checked') === 'true' ? ' (chosen)' : ''}`), ['A till (chosen)', 'A workshop computer']);
  t.fireEvent.click(kinds.getByRole('radio', { name: 'A workshop computer' }));
  await t.ui.findByRole('heading', { name: 'Set up a workshop computer' });
  assert.ok(t.ui.getByText('Signed in as Jack Lewis (Owner). This computer becomes a workshop computer: staff work on it with their PIN.'));
  assert.ok(t.ui.queryByRole('radiogroup', { name: 'Till number' }) === null, 'no till number');
  assert.ok(t.ui.getByRole('radiogroup', { name: 'Shop' }));
  t.fireEvent.change(t.ui.getByLabelText('Name (optional)'), { target: { value: 'Back bench' } });
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Make this computer a workshop computer' }));
  await t.waitFor(() => assert.deepEqual(posts(t, '/api/till-setup/workshop').map((c) => c.body), [{ siteId: 7, name: 'Back bench' }]));
  // On to the workshop computer, which asks for a PIN.
  await t.waitFor(() => assert.equal(window.location.pathname, '/workshop'));
  await t.ui.findByRole('heading', { name: 'Enter your PIN' });
});

test('a computer that is already a workshop computer goes to it, and Settings offers no till there', async () => {
  const t = await open('/workshop/till/setup');
  await t.waitFor(() => assert.equal(window.location.pathname, '/workshop'));
  t.cleanup(); restart(); current.uninstall(); mock.timers.reset(); current = undefined;
  const s = await open('/workshop/settings?room=front-desk', { serving: JACK_WORKING });
  const fold = await s.ui.findByRole('button', { name: /^Tills/ });
  if (fold.getAttribute('aria-expanded') !== 'true') s.fireEvent.click(fold);
  await s.ui.findByText(/Do this on the computer that will be the till/);
  assert.ok(s.ui.queryByRole('link', { name: 'Make this computer a till' }) === null);
});

test('nobody working: every page is Enter your PIN under the workshop bar, with no till words', async () => {
  const t = await open('/workshop/diary');
  await t.ui.findByRole('heading', { name: 'Enter your PIN' });
  // The phone shows "Bolton" and "Nobody working"; wider adds the rest.
  assert.equal(t.ui.getByRole('banner').textContent, 'Workshop computerBolton · North Street CyclesNobody working — enter your PIN');
  assert.ok(t.ui.queryByText(/Till B1|Nobody serving|Checked in today|No PIN yet|recorded under your name/i) === null);
  assert.ok(t.ui.queryByRole('navigation') === null, 'no sidebar or menu');
  assert.ok(t.ui.queryByRole('button', { name: 'Open menu' }) === null);
  assert.ok(t.ui.queryByText('Working:') === null);
});

test('a PIN opens the diary from the front page, with "Working: Alex Morgan · Switch" and "Now working" said', async () => {
  const t = await open('/workshop');
  await t.ui.findByRole('heading', { name: 'Enter your PIN' });
  typePin(t, '7305');
  await t.waitFor(() => assert.deepEqual(posts(t, '/api/till-checkin').map((c) => c.body), [{ pin: '7305' }]));
  const working = await t.ui.findByRole('region', { name: 'Who’s working' });
  assert.match(working.textContent, /Working: Alex Morgan/);
  assert.ok(t.within(working).getByRole('button', { name: 'Switch' }));
  assert.ok(t.ui.getAllByRole('status').some((s) => s.textContent === 'Now working: Alex Morgan'));
  await t.waitFor(() => assert.equal(window.location.pathname, '/workshop/diary'));
  // No PIN digits are left on the page.
  assert.ok(!document.body.innerHTML.includes('7305'));
});

test('the page asked for stays the page after the PIN', async () => {
  const t = await open('/workshop/customers');
  await t.ui.findByRole('heading', { name: 'Enter your PIN' });
  typePin(t, '7305');
  await t.ui.findByRole('region', { name: 'Who’s working' });
  assert.equal(window.location.pathname, '/workshop/customers');
});

test('a wrong PIN says so and stays on Enter your PIN', async () => {
  const t = await open('/workshop/diary', { pinOk: false });
  await t.ui.findByRole('heading', { name: 'Enter your PIN' });
  typePin(t, '1111');
  assert.equal((await t.ui.findByRole('alert')).textContent, 'That PIN isn’t anyone’s — try again');
  assert.ok(t.ui.queryByText('Working:') === null);
});

test('Switch ends the check-in and goes back to Enter your PIN', async () => {
  const t = await open('/workshop/diary', { serving: ALEX });
  const working = await t.ui.findByRole('region', { name: 'Who’s working' });
  t.fireEvent.click(t.within(working).getByRole('button', { name: 'Switch' }));
  await t.ui.findByRole('heading', { name: 'Enter your PIN' });
  assert.equal(posts(t, '/api/till-checkin/end').length, 1);
});

test('left alone for 10 minutes: back to Enter your PIN, and the server is told', async () => {
  const t = await open('/workshop/diary', { serving: ALEX });
  await t.ui.findByRole('region', { name: 'Who’s working' });
  later(9 * MINUTE + 50_000);
  await new Promise((r) => setTimeout(r, 1200));
  assert.ok(t.ui.queryByRole('region', { name: 'Who’s working' }), 'still Alex at 9 minutes 50');
  assert.equal(posts(t, '/api/till-checkin/end').length, 0);
  later(10_000);
  await t.ui.findByRole('heading', { name: 'Enter your PIN' }, { timeout: 3000 });
  assert.equal(posts(t, '/api/till-checkin/end').length, 1);
});

test('using it keeps it: a key or a tap starts the 10 minutes again, and tells the server', async () => {
  const t = await open('/workshop/diary', { serving: ALEX });
  await t.ui.findByRole('region', { name: 'Who’s working' });
  later(6 * MINUTE);
  t.fireEvent.keyDown(document.body, { key: 'a' });
  await t.waitFor(() => assert.equal(posts(t, '/api/till-checkin/active').length, 1));
  // A second press straight after doesn't tell the server at once; it is
  // told once 30 seconds have passed (the review, 29 Oct).
  t.fireEvent.pointerDown(document.body);
  assert.equal(posts(t, '/api/till-checkin/active').length, 1);
  later(6 * MINUTE);
  await new Promise((r) => setTimeout(r, 1200));
  assert.ok(t.ui.queryByRole('region', { name: 'Who’s working' }), 'still Alex, 12 minutes after he started');
  assert.equal(posts(t, '/api/till-checkin/active').length, 2);
  assert.equal(posts(t, '/api/till-checkin/end').length, 0);
});

test('the server ending it brings back Enter your PIN', async () => {
  const t = await open('/workshop/diary', { serving: ALEX });
  await t.ui.findByRole('region', { name: 'Who’s working' });
  t.state.serving = null;
  later(MINUTE);
  t.fireEvent.keyDown(document.body, { key: 'a' });
  await t.ui.findByRole('heading', { name: 'Enter your PIN' }, { timeout: 3000 });
});

test('Owner pages only while the Owner is working: Alex sees what staff see, Jack Lewis sees his own', async () => {
  const t = await open('/workshop/settings');
  await t.ui.findByRole('heading', { name: 'Enter your PIN' });
  typePin(t, '7305');
  await t.ui.findByRole('region', { name: 'Who’s working' });
  // What a staff sign-in sees at Settings, and no Owner rooms in the menu.
  await t.ui.findByText(/isn’t part of your role|aren’t part of your role/);
  const nav = t.ui.getAllByRole('navigation', { name: 'Main' })[0];
  await t.waitFor(() => assert.ok(t.within(nav).queryByRole('link', { name: 'Settings' }) === null));
  t.fireEvent.click(t.within(t.ui.getByRole('region', { name: 'Who’s working' })).getByRole('button', { name: 'Switch' }));
  await t.ui.findByRole('heading', { name: 'Enter your PIN' });
  typePin(t, '1111');
  await t.waitFor(() => assert.match(t.ui.getByRole('region', { name: 'Who’s working' }).textContent, /Jack Lewis/));
  const nav2 = t.ui.getAllByRole('navigation', { name: 'Main' })[0];
  await t.waitFor(() => assert.ok(t.within(nav2).queryByRole('link', { name: 'Settings' })));
  assert.ok(t.ui.queryByText(/isn’t part of your role|aren’t part of your role/) === null);
});

test('after the Owner, the next person never sees the Owner’s menu, not even for a moment', async () => {
  const t = await open('/workshop/diary', { serving: JACK_WORKING });
  const nav = () => t.ui.getAllByRole('navigation', { name: 'Main' })[0];
  await t.waitFor(() => assert.ok(t.within(nav()).queryByRole('link', { name: 'Settings' })));
  t.fireEvent.click(t.within(t.ui.getByRole('region', { name: 'Who’s working' })).getByRole('button', { name: 'Switch' }));
  await t.ui.findByRole('heading', { name: 'Enter your PIN' });
  typePin(t, '7305');
  await t.ui.findByRole('region', { name: 'Who’s working' });
  // The moment the page is back, its menu is already Alex's.
  assert.ok(t.within(nav()).queryByRole('link', { name: 'Settings' }) === null);
});

// The review, 29 Oct: the screen's 10 minutes run from the last time it told
// the server, and activity it hasn't told yet is told within 30 seconds, so
// the screen and the server end together.
test('a press the server wasn’t told of yet is told within 30 seconds, and the 10 minutes run from then', async () => {
  const t = await open('/workshop/diary', { serving: ALEX });
  await t.ui.findByRole('region', { name: 'Who’s working' });
  later(20_000);
  t.fireEvent.keyDown(document.body, { key: 'a' });
  // Too soon after the check-in to tell the server at once…
  assert.equal(posts(t, '/api/till-checkin/active').length, 0);
  // …so it is told once 30 seconds have passed since it last was.
  later(11_000);
  await t.waitFor(() => assert.equal(posts(t, '/api/till-checkin/active').length, 1), { timeout: 3000 });
  // Nothing more: 10 minutes from that telling, not from the press.
  later(9 * MINUTE + 50_000);
  await new Promise((r) => setTimeout(r, 1200));
  assert.ok(t.ui.queryByRole('region', { name: 'Who’s working' }), 'still Alex just under 10 minutes after the server was told');
  later(15_000);
  await t.ui.findByRole('heading', { name: 'Enter your PIN' }, { timeout: 3000 });
});

test('a workshop computer whose check-in can’t be read shows no pages, only a message', async () => {
  const t = await open('/workshop/settings', { checkinFails: true });
  assert.equal((await t.ui.findByRole('alert')).textContent, 'Wheelhouse couldn’t check who is working on this computer. Try again in a moment.');
  assert.ok(t.ui.queryByRole('navigation') === null);
  assert.ok(t.ui.queryByText(/Settings/) === null);
});

test('one status region, empty on the PIN screen, says "Now working" after the PIN; Switch is a full-size target', async () => {
  const t = await open('/workshop/diary');
  await t.ui.findByRole('heading', { name: 'Enter your PIN' });
  const region = t.ui.getAllByRole('status').find((s) => s.dataset.working !== undefined);
  assert.ok(region, 'the working status region is there before the PIN');
  assert.equal(region.textContent, '');
  typePin(t, '7305');
  const working = await t.ui.findByRole('region', { name: 'Who’s working' });
  assert.ok(region.isConnected, 'the same region, kept');
  assert.equal(region.textContent, 'Now working: Alex Morgan');
  assert.match(t.within(working).getByRole('button', { name: 'Switch' }).className, /\bmin-h-11\b/);
});

test('a till is not a workshop computer: no Working bar, and it never goes back by itself', async () => {
  const t = await open('/workshop/till', { workshop: null, till: B1, serving: ALEX });
  await t.ui.findByRole('button', { name: /Serving: Alex Morgan/ });
  assert.ok(t.ui.queryByRole('region', { name: 'Who’s working' }) === null);
  later(30 * MINUTE);
  await new Promise((r) => setTimeout(r, 1200));
  assert.equal(posts(t, '/api/till-checkin/end').length, 0);
  assert.equal(posts(t, '/api/till-checkin/active').length, 0);
  assert.ok(t.ui.getByRole('button', { name: /Serving: Alex Morgan/ }));
});
