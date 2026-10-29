// Trust PIN on the workshop computer (openspec/changes/trust-pin-workshop;
// the lines on set-till-quick; roles and switches 3 and 9; stage-1 gaps 9):
// Settings › Till ›
// Signing in, and the workshop computer going back at the shop's time.
import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const JACK = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street', employee: null };
const WORKSHOP = { name: null, siteName: 'Bolton' };
const ALEX = { id: 31, name: 'Alex Morgan' };
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

async function open(path, { workshop = WORKSHOP, serving = null, trustPin = false, workshopIdleMinutes = 10 } = {}) {
  const calls = [];
  const state = { serving, workshop, trustPin, workshopIdleMinutes };
  const idle = () => (state.trustPin ? state.workshopIdleMinutes : 10);
  const realFetch = globalThis.fetch;
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-01T10:00:00+01:00') });
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, { ...JACK, isOwner: !state.workshop, workshopComputer: Boolean(state.workshop) });
    if (u.pathname === '/api/signing-in-settings' && method === 'PUT') Object.assign(state, body);
    if (u.pathname === '/api/signing-in-settings') return reply(200, { trustPin: state.trustPin, workshopIdleMinutes: state.workshopIdleMinutes });
    if (u.pathname === '/api/till-checkin' && method === 'POST') { state.serving = ALEX; return reply(201, { serving: ALEX }); }
    if (u.pathname === '/api/till-checkin/end') { state.serving = null; return reply(200, { serving: null }); }
    if (u.pathname === '/api/till-checkin/active') return reply(200, { serving: state.serving });
    if (u.pathname === '/api/till-checkin') {
      return reply(200, { serving: state.serving ? { id: state.serving.id, name: state.serving.name } : null, checkedInToday: [], givePin: [], till: null, workshop: state.workshop, idleMinutes: idle() });
    }
    if (u.pathname === '/api/till-setup') return reply(200, { sites: [], thisTill: null, thisWorkshop: null, tills: [] });
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
const puts = (t) => t.calls.filter((c) => c.method === 'PUT' && c.url === '/api/signing-in-settings').map((c) => c.body);
const posts = (t, path) => t.calls.filter((c) => c.method === 'POST' && c.url === path);
const later = (ms) => mock.timers.tick(ms);
const tick = () => new Promise((r) => setTimeout(r, 1200));

test('Settings › Till › Signing in: trust PIN off to start; the times only with it on; each saved when chosen', async () => {
  const t = await open('/workshop/settings?room=front-desk', { workshop: null });
  const fold = await t.ui.findByRole('button', { name: /^Signing in/ });
  await t.waitFor(() => assert.match(fold.textContent, /Trust PIN off/));
  if (fold.getAttribute('aria-expanded') !== 'true') t.fireEvent.click(fold);
  const trust = await t.ui.findByRole('switch', { name: 'Trust PIN' });
  assert.equal(trust.getAttribute('aria-checked'), 'false');
  assert.ok(t.ui.getByText('Once someone has typed their PIN on a workshop computer today, they tap their name instead. The owner still types theirs. One setting for the whole business.'));
  assert.ok(t.ui.getByText('Workshop computers go back to Enter your PIN after 10 minutes left alone.'));
  assert.ok(t.ui.queryByRole('radiogroup', { name: 'Go back to the start when left alone' }) === null, 'no times with trust PIN off');
  t.fireEvent.click(trust);
  const times = await t.ui.findByRole('radiogroup', { name: 'Go back to the start when left alone' });
  assert.deepEqual(puts(t), [{ trustPin: true }]);
  assert.deepEqual(t.within(times).getAllByRole('radio').map((r) => `${r.textContent}${r.getAttribute('aria-checked') === 'true' ? ' (chosen)' : ''}`),
    ['5 minutes', '10 minutes (chosen)', '15 minutes', '30 minutes', 'Off']);
  await t.waitFor(() => assert.match(fold.textContent, /Trust PIN on · back after 10 minutes/));
  t.fireEvent.click(t.within(times).getByRole('radio', { name: '5 minutes' }));
  await t.waitFor(() => assert.match(fold.textContent, /Trust PIN on · back after 5 minutes/));
  t.fireEvent.click(t.within(times).getByRole('radio', { name: 'Off' }));
  await t.waitFor(() => assert.match(fold.textContent, /Trust PIN on · never goes back/));
  assert.deepEqual(puts(t), [{ trustPin: true }, { workshopIdleMinutes: 5 }, { workshopIdleMinutes: null }]);
});

test('the workshop computer goes back at the shop’s time: 5 minutes chosen', async () => {
  const t = await open('/workshop/diary', { serving: ALEX, trustPin: true, workshopIdleMinutes: 5 });
  await t.ui.findByRole('region', { name: 'Who’s working' });
  later(4 * MINUTE + 50_000);
  await tick();
  assert.ok(t.ui.queryByRole('region', { name: 'Who’s working' }), 'still Alex at 4 minutes 50');
  later(10_000);
  await t.ui.findByRole('heading', { name: 'Enter your PIN' }, { timeout: 3000 });
  assert.equal(posts(t, '/api/till-checkin/end').length, 1);
});

test('the workshop computer never goes back by itself with Off chosen', async () => {
  const t = await open('/workshop/diary', { serving: ALEX, trustPin: true, workshopIdleMinutes: null });
  await t.ui.findByRole('region', { name: 'Who’s working' });
  later(60 * MINUTE);
  await tick();
  assert.ok(t.ui.queryByRole('region', { name: 'Who’s working' }), 'still Alex an hour later');
  assert.equal(posts(t, '/api/till-checkin/end').length, 0);
});
