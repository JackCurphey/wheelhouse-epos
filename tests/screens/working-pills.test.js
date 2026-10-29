// The Working pills (openspec/changes/working-pills; drawn as
// workshop-working-pills in signin.mjs; roles and switches 9): with trust PIN
// on, today's people as pills at the bottom of every workshop page, in place
// of "Working: [name] · Switch"; a pill swaps who is working on the same
// page, through the same tap as "Who's working?"; "Someone else" shows the pad.
import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const JACK = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street', employee: null };
const WORKSHOP = { name: null, siteName: 'Bolton' };
// The drawing's people (workshop-working-pills): Alex Morgan working, Jo Taylor.
const ALEX = { id: 31, name: 'Alex Morgan' };
const JO = { id: 32, name: 'Jo Taylor' };
const JACK_WORKING = { id: 11, name: 'Jack Lewis' };
const NAMES = [{ ...ALEX, role: 'Mechanic' }, { ...JO, role: 'Staff' }];
const REFUSED = { error: 'Enter your PIN: you haven’t typed it on this computer today', code: 'not_typed_here' };

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

async function open(path, { serving = ALEX, trustPin = true, names = NAMES, refuse = [] } = {}) {
  const calls = [];
  const state = { serving, trustPin, names };
  const realFetch = globalThis.fetch;
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-01T10:00:00+01:00') });
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, { ...JACK, isOwner: state.serving?.id === JACK_WORKING.id, workshopComputer: true });
    if (u.pathname === '/api/till-checkin/tap') {
      if (refuse.includes(body.employeeId)) return reply(403, REFUSED);
      state.serving = state.names.find((n) => n.id === body.employeeId);
      return reply(201, { serving: { id: state.serving.id, name: state.serving.name } });
    }
    if (u.pathname === '/api/till-checkin' && method === 'POST') { state.serving = ALEX; return reply(201, { serving: ALEX }); }
    if (u.pathname === '/api/till-checkin/end') { state.serving = null; return reply(200, { serving: null }); }
    if (u.pathname === '/api/till-checkin/active') return reply(200, { serving: state.serving });
    if (u.pathname === '/api/till-checkin') {
      return reply(200, { serving: state.serving ? { id: state.serving.id, name: state.serving.name } : null, checkedInToday: [], givePin: [], till: null, workshop: WORKSHOP, idleMinutes: 10, trustPin: state.trustPin, names: state.trustPin ? state.names : [] });
    }
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
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  const shell = await importFresh(SHELL);
  current = { shell, uninstall, realFetch };
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui, calls, state };
}
const posts = (t, path) => t.calls.filter((c) => c.method === 'POST' && c.url === path);
// Each pill as the drawing shows it: its words, and (pressed) for the person working.
const pills = (t, strip) => t.within(strip).getAllByRole('button').map((b) => `${b.textContent}${b.getAttribute('aria-pressed') === 'true' ? ' (pressed)' : ''}`);

test('trust PIN on: the strip at the bottom in place of the Working bar, as drawn', async () => {
  const t = await open('/workshop/diary');
  const strip = await t.ui.findByRole('group', { name: 'Who’s working' });
  assert.match(strip.textContent, /^Working:/);
  assert.deepEqual(pills(t, strip), ['Alex Morgan (pressed)', 'Jo Taylor', 'Someone else']);
  assert.equal(t.within(strip).getByRole('button', { name: 'Someone else' }).hasAttribute('aria-pressed'), false);
  assert.ok(t.ui.queryByRole('button', { name: 'Switch' }) === null, 'no Switch at the top');
  assert.ok(t.ui.queryByRole('region', { name: 'Who’s working' }) === null, 'no Working bar');
  // At the bottom of the page column, after the page itself.
  const main = document.querySelector('main');
  assert.ok(main.compareDocumentPosition(strip) & window.Node.DOCUMENT_POSITION_FOLLOWING);
});

test('the Owner working, who is never a name to tap, still has the highlighted pill', async () => {
  const t = await open('/workshop/diary', { serving: JACK_WORKING });
  const strip = await t.ui.findByRole('group', { name: 'Who’s working' });
  assert.deepEqual(pills(t, strip), ['Jack Lewis (pressed)', 'Alex Morgan', 'Jo Taylor', 'Someone else']);
});

test('Jo taps her pill: Jo is working, on the same page, through the tap', async () => {
  const t = await open('/workshop/diary');
  const strip = await t.ui.findByRole('group', { name: 'Who’s working' });
  // The highlighted pill does nothing.
  t.fireEvent.click(t.within(strip).getByRole('button', { name: 'Alex Morgan' }));
  t.fireEvent.click(t.within(strip).getByRole('button', { name: 'Jo Taylor' }));
  await t.waitFor(() => assert.deepEqual(pills(t, t.ui.getByRole('group', { name: 'Who’s working' })), ['Alex Morgan', 'Jo Taylor (pressed)', 'Someone else']));
  assert.deepEqual(posts(t, '/api/till-checkin/tap').map((c) => c.body), [{ employeeId: 32 }]);
  assert.equal(window.location.pathname, '/workshop/diary');
  await t.waitFor(() => assert.equal(document.querySelector('[data-working]').textContent, 'Now working: Jo Taylor'));
});

test('a pill the server refuses says why, and the person working stays', async () => {
  const t = await open('/workshop/diary', { refuse: [32] });
  const strip = await t.ui.findByRole('group', { name: 'Who’s working' });
  t.fireEvent.click(t.within(strip).getByRole('button', { name: 'Jo Taylor' }));
  const alert = await t.ui.findByRole('alert');
  assert.equal(alert.textContent, REFUSED.error);
  assert.deepEqual(pills(t, t.ui.getByRole('group', { name: 'Who’s working' })), ['Alex Morgan (pressed)', 'Jo Taylor', 'Someone else']);
});

test('Someone else ends the check-in and shows the PIN pad, not the names', async () => {
  const t = await open('/workshop/diary');
  const strip = await t.ui.findByRole('group', { name: 'Who’s working' });
  t.fireEvent.click(t.within(strip).getByRole('button', { name: 'Someone else' }));
  await t.ui.findByRole('heading', { name: 'Enter your PIN' });
  assert.ok(t.ui.queryByRole('heading', { name: 'Who’s working?' }) === null);
  assert.equal(posts(t, '/api/till-checkin/end').length, 1);
});

test('trust PIN off: the Working bar with Switch, and no pills', async () => {
  const t = await open('/workshop/diary', { trustPin: false });
  const bar = await t.ui.findByRole('region', { name: 'Who’s working' });
  assert.ok(t.within(bar).getByRole('button', { name: 'Switch' }));
  assert.ok(t.ui.queryByRole('group', { name: 'Who’s working' }) === null);
});
