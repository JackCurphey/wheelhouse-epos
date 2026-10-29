// The till's Serving pills (openspec/changes/serving-pills; drawn as
// till-serving-pills in till.mjs; roles and switches 10; stage-1 gaps 11):
// with trust PIN on, "Serving:" pills under the quick buttons, a pill swapping
// who is serving with the sale kept, "Someone else" back to Enter your PIN,
// and the names in Checked in today to tap.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const JACK = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street', employee: null };
// The drawing's people: Jo Taylor serving; Alex Morgan from the workshop drawings.
const JO = { id: 32, name: 'Jo Taylor' };
const ALEX = { id: 31, name: 'Alex Morgan' };
const NAMES = [{ ...ALEX, role: 'Mechanic' }, { ...JO, role: 'Staff' }];
const B1 = { code: 'B1', name: null, siteName: 'Bolton' };
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

async function open({ serving = JO, trustPin = true, names = NAMES, till = B1, checkedInToday = [ALEX, JO] } = {}) {
  const calls = [];
  const state = { serving };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, JACK);
    if (u.pathname === '/api/till-checkin/tap') {
      state.serving = names.find((n) => n.id === body.employeeId);
      return reply(201, { serving: { id: state.serving.id, name: state.serving.name } });
    }
    if (u.pathname === '/api/till-checkin/end') { state.serving = null; return reply(200, { serving: null }); }
    if (u.pathname === '/api/till-checkin') {
      return reply(200, { serving: state.serving ? { id: state.serving.id, name: state.serving.name } : null, checkedInToday, givePin: [], till, workshop: null, idleMinutes: 10, trustPin, names: trustPin && till ? names : [] });
    }
    if (u.pathname === '/api/your-settings') return reply(200, { accessibility: {} });
    if (u.pathname === '/api/float-check') return reply(200, { day: '2026-09-01', floatPence: null, takesPayments: true, firstDay: false, check: null });
    if (u.pathname === '/api/workshop-services') return reply(200, SERVICES);
    if (u.pathname === '/api/shop-details') return reply(200, { name: 'North Street Cycles' });
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    return reply(404, { error: 'Not found' });
  };
  const uninstall = installDom('http://localhost/workshop/till');
  window.innerWidth = 1024;
  window.WH_TILL_TICK_MS = 20;
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
const pills = (t, strip) => t.within(strip).getAllByRole('button').map((b) => `${b.textContent}${b.getAttribute('aria-pressed') === 'true' ? ' (pressed)' : ''}`);

test('trust PIN on: Serving pills under the quick buttons, Jo highlighted, as drawn', async () => {
  const t = await open();
  const strip = await t.ui.findByRole('group', { name: 'Who’s serving' });
  assert.match(strip.textContent, /^Serving:/);
  assert.deepEqual(pills(t, strip), ['Alex Morgan', 'Jo Taylor (pressed)', 'Someone else']);
  // Under the quick buttons.
  const quick = t.ui.getByRole('group', { name: 'Workshop quick buttons' });
  assert.ok(quick.compareDocumentPosition(strip) & window.Node.DOCUMENT_POSITION_FOLLOWING);
});

test('Alex taps his pill mid-sale: Alex is serving, the sale stays, and Take payment is his', async () => {
  const t = await open();
  t.fireEvent.click(await t.ui.findByRole('button', { name: /Fit & adjust brakes/ }));
  const strip = await t.ui.findByRole('group', { name: 'Who’s serving' });
  t.fireEvent.click(t.within(strip).getByRole('button', { name: 'Alex Morgan' }));
  await t.waitFor(() => assert.deepEqual(pills(t, t.ui.getByRole('group', { name: 'Who’s serving' })), ['Alex Morgan (pressed)', 'Jo Taylor', 'Someone else']));
  assert.deepEqual(posts(t, '/api/till-checkin/tap').map((c) => c.body), [{ employeeId: 31 }]);
  const sale = t.ui.getByRole('region', { name: 'Sale' });
  assert.match(sale.textContent, /Fit & adjust brakes/, 'the sale is still on screen');
  t.fireEvent.click(t.within(sale).getByRole('button', { name: /Take payment/ }));
  const dialog = await t.ui.findByRole('dialog');
  assert.match(dialog.textContent, /Alex Morgan serving/);
});

test('Someone else ends the check-in: Enter your PIN', async () => {
  const t = await open();
  const strip = await t.ui.findByRole('group', { name: 'Who’s serving' });
  t.fireEvent.click(t.within(strip).getByRole('button', { name: 'Someone else' }));
  await t.ui.findByRole('heading', { name: 'Enter your PIN' });
  assert.equal(posts(t, '/api/till-checkin/end').length, 1);
});

test('trust PIN off: no pills, and Checked in today is only a list', async () => {
  const t = await open({ trustPin: false });
  await t.ui.findByRole('group', { name: 'Workshop quick buttons' });
  assert.ok(t.ui.queryByRole('group', { name: 'Who’s serving' }) === null);
  current.shell.queryClient.clear();
  t.cleanup(); current.uninstall(); globalThis.fetch = current.realFetch; current = undefined;
  const p = await open({ trustPin: false, serving: null });
  await p.ui.findByRole('heading', { name: 'Enter your PIN' });
  assert.ok(p.ui.queryByRole('button', { name: 'Jo Taylor' }) === null);
  assert.ok(p.ui.getByText('Jo Taylor'));
});

test('trust PIN on: tapping Jo in Checked in today checks her back in', async () => {
  // The Owner checked in too, but isn't a name to tap: a plain chip.
  const t = await open({ serving: null, checkedInToday: [ALEX, { id: 11, name: 'Jack Lewis' }, JO] });
  await t.ui.findByRole('heading', { name: 'Enter your PIN' });
  assert.ok(t.ui.queryByRole('button', { name: 'Jack Lewis' }) === null);
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Jo Taylor' }));
  await t.ui.findByRole('group', { name: 'Who’s serving' });
  assert.deepEqual(posts(t, '/api/till-checkin/tap').map((c) => c.body), [{ employeeId: 32 }]);
});
