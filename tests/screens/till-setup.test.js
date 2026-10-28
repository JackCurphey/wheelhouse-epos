// Set up this till and the till's name (openspec/changes/till-setup; drawn as
// till-setup in signin.mjs, set-till-tills-owner in setup.mjs, tillBar in
// app-map.mjs, and op-float-check, op-float-matched, op-today and
// op-today-short in opening.mjs; stage-1 gaps 4; UX walk-through 7 M2).
import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';
import { tillNumbers } from '../../src/screens/till/till-numbers.ts';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const JACK = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street', employee: null };
const JO = { id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false, shopName: 'North Street Cycles', shopSlug: 'north-street', employee: { id: 21, name: 'Jo Taylor', isCashier: true } };
const BOLTON = { id: 7, name: 'Bolton', code: 'B', taken: [] };
const SECOND = { id: 8, name: '[Second site]', code: '[code]', taken: [1, 2] };
const B1 = { code: 'B1', name: 'Front counter', siteName: 'Bolton' };
const SERVICES = [{ id: 1, name: 'Fit & adjust brakes', price: 18, minutes: 30, active: true }];
const DUE = { day: '2026-09-01', floatPence: 15000, takesPayments: true, firstDay: false, check: null };
const OPEN_B1 = { code: 'B1', openedAt: '2026-09-01T07:52:00Z', openedBy: 'Jo Taylor', floatCheck: { byName: 'Jo Taylor', at: '2026-09-01T07:55:00Z', short: true, seenByName: null } };

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

async function open(path, { me = JACK, sites = [BOLTON], thisTill = null, tills = [], setup = null, till = null, serving = null, floatCheck = { ...DUE, floatPence: null }, todayTills = [OPEN_B1], items = [] } = {}) {
  const calls = [];
  const realFetch = globalThis.fetch;
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-01T10:00:00+01:00') });
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, me);
    if (u.pathname === '/api/till-setup' && method === 'POST') {
      const r = setup ?? { status: 201, body: { till: { id: 3, code: `${sites[0].code}${body.number}`, name: body.name || null, siteName: sites[0].name } } };
      return reply(r.status, r.body);
    }
    if (u.pathname === '/api/till-setup') return me.isOwner ? reply(200, { sites, thisTill, tills }) : reply(403, { error: 'Only the owner can set up a till', code: 'owner_only' });
    if (u.pathname === '/api/till-checkin') return reply(200, { serving, checkedInToday: serving ? [serving] : [], givePin: [], till });
    if (u.pathname === '/api/float-check' && method === 'POST') return reply(201, { check: { id: 9, how: 'counted', expectedPence: 15000, countedPence: 15000, reason: '', checkedByName: 'Jo Taylor', checkedAt: '2026-09-01T07:55:00Z', tillCode: 'B1' } });
    if (u.pathname === '/api/float-check') return reply(200, floatCheck);
    if (u.pathname === '/api/today/tills') return reply(200, { tills: todayTills });
    if (u.pathname === '/api/today/whos-in') return reply(200, { people: [] });
    if (u.pathname === '/api/needs-attention') return reply(200, { items });
    if (u.pathname === '/api/your-settings/till-pin/ask') return reply(200, { ask: null });
    if (u.pathname === '/api/your-settings') return reply(200, { accessibility: {} });
    if (u.pathname === '/api/workshop-services') return reply(200, SERVICES);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/shop-details') return reply(200, { name: 'North Street Cycles' });
    if (u.pathname === '/api/workshop-jobs') return reply(200, []);
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
  return { ...rtl, ui, calls };
}
const posts = (t, path) => t.calls.filter((c) => c.method === 'POST' && c.url === path).map((c) => c.body);
const radios = (t, group) => t.within(t.ui.getByRole('radiogroup', { name: group })).getAllByRole('radio').map((r) => `${r.textContent}${r.getAttribute('aria-checked') === 'true' ? ' (chosen)' : ''}${r.disabled ? ' (disabled)' : ''}`);

test('till numbers: one to three, or one past the highest taken; taken ones in use; the lowest free chosen', () => {
  assert.deepEqual(tillNumbers([]), { numbers: [1, 2, 3].map((n) => ({ number: n, inUse: false })), chosen: 1 });
  assert.deepEqual(tillNumbers([1, 2]), { numbers: [{ number: 1, inUse: true }, { number: 2, inUse: true }, { number: 3, inUse: false }], chosen: 3 });
  assert.deepEqual(tillNumbers([1, 3]).numbers.map((n) => n.number), [1, 2, 3, 4]);
  assert.equal(tillNumbers([1, 3]).chosen, 2);
});

test('Set up this till: the shop and number as pills, the name, and Make this computer Till B1', async () => {
  const t = await open('/workshop/till/setup');
  await t.ui.findByRole('heading', { name: 'Set up this till' });
  assert.ok(t.ui.queryByText('Signed in as Jack Lewis (Owner). This computer becomes a till: staff check in with their PIN.'));
  assert.deepEqual(radios(t, 'Shop'), ['Bolton (chosen)']);
  assert.deepEqual(radios(t, 'Till number'), ['B1 (chosen)', 'B2', 'B3']);
  const name = t.ui.getByLabelText('Name (optional)');
  t.fireEvent.click(t.ui.getByRole('radio', { name: 'B2' }));
  t.fireEvent.change(name, { target: { value: 'Front counter' } });
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Make this computer Till B2' }));
  await t.waitFor(() => assert.deepEqual(posts(t, '/api/till-setup'), [{ siteId: 7, number: 2, name: 'Front counter' }]));
  // On to the till, which asks for a PIN.
  await t.waitFor(() => assert.equal(window.location.pathname, '/workshop/till'));
});

test('another shop chosen: its own numbers, the taken ones In use', async () => {
  const t = await open('/workshop/till/setup', { sites: [BOLTON, SECOND] });
  await t.ui.findByRole('heading', { name: 'Set up this till' });
  t.fireEvent.click(t.ui.getByRole('radio', { name: '[Second site]' }));
  assert.deepEqual(radios(t, 'Till number'), ['[code]1In use (disabled)', '[code]2In use (disabled)', '[code]3 (chosen)']);
  assert.ok(t.ui.getByRole('radio', { name: '[code]1, in use' }));
  assert.ok(t.ui.getByRole('button', { name: 'Make this computer Till [code]3' }));
});

test('a refusal is said in the server\'s words, and the page stays', async () => {
  const t = await open('/workshop/till/setup', { setup: { status: 409, body: { error: 'Till B1 is in use. Choose another number.', code: 'taken' } } });
  await t.ui.findByRole('heading', { name: 'Set up this till' });
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Make this computer Till B1' }));
  assert.equal((await t.ui.findByRole('alert')).textContent, 'Till B1 is in use. Choose another number.');
  assert.equal(window.location.pathname, '/workshop/till/setup');
});

test('staff are told only the owner adds tills; a business with no shop yet is told so', async () => {
  const t = await open('/workshop/till/setup', { me: JO });
  assert.ok(await t.ui.findByText('Only the owner can add or remove tills.'));
  assert.ok(t.ui.queryByRole('button', { name: /Make this computer/ }) === null);
  t.cleanup(); current.shell.queryClient.clear(); current.uninstall(); mock.timers.reset(); current = undefined;
  const none = await open('/workshop/till/setup', { sites: [] });
  assert.ok(await none.ui.findByText('This business has no shops set up in Wheelhouse yet, so a till can’t be added here.'));
  assert.ok(none.ui.queryByRole('button', { name: /Make this computer/ }) === null);
});

test('a computer that is already a till goes to the till', async () => {
  const t = await open('/workshop/till/setup', { thisTill: { id: 3, ...B1 }, till: B1 });
  await t.waitFor(() => assert.equal(window.location.pathname, '/workshop/till'));
});

test('Settings › Till › Tills: Make this computer a till, not on a computer that already is one', async () => {
  const t = await open('/workshop/settings?room=front-desk');
  const fold = await t.ui.findByRole('button', { name: /^Tills/ });
  await t.waitFor(() => assert.match(fold.textContent, /None yet/));
  if (fold.getAttribute('aria-expanded') !== 'true') t.fireEvent.click(fold);
  assert.ok(await t.ui.findByText('Do this on the computer that will be the till. It doesn’t show on a computer that’s already a till.'));
  const link = t.ui.getByRole('link', { name: 'Make this computer a till' });
  assert.equal(link.getAttribute('href'), '/workshop/till/setup');
  t.cleanup(); current.shell.queryClient.clear(); current.uninstall(); mock.timers.reset(); current = undefined;
  const already = await open('/workshop/settings?room=front-desk', { thisTill: { id: 3, ...B1 }, tills: ['B1'] });
  const f2 = await already.ui.findByRole('button', { name: /^Tills/ });
  await already.waitFor(() => assert.match(f2.textContent, /Till B1/));
  if (f2.getAttribute('aria-expanded') !== 'true') already.fireEvent.click(f2);
  await already.ui.findByText('Do this on the computer that will be the till. It doesn’t show on a computer that’s already a till.');
  assert.ok(already.ui.queryByRole('link', { name: 'Make this computer a till' }) === null);
});

test('the till says which till it is, on the PIN screen and while serving', async () => {
  const t = await open('/workshop/till', { till: B1 });
  await t.ui.findByRole('heading', { name: 'Enter your PIN' });
  assert.ok(t.ui.getByText('Till B1'));
  assert.ok(t.ui.getByText('Bolton · North Street Cycles'));
  t.cleanup(); current.shell.queryClient.clear(); current.uninstall(); mock.timers.reset(); current = undefined;
  const serving = await open('/workshop/till', { till: B1, serving: { id: 21, name: 'Jo Taylor' } });
  await serving.ui.findByRole('region', { name: 'Sale' });
  assert.ok(serving.ui.getByText('Till B1'));
  t.cleanup(); current.shell.queryClient.clear(); current.uninstall(); mock.timers.reset(); current = undefined;
  // A browser that isn't a till: no till name.
  const plain = await open('/workshop/till');
  await plain.ui.findByRole('heading', { name: 'Enter your PIN' });
  assert.ok(plain.ui.queryByText(/^Till /) === null);
});

test('the float check names the till', async () => {
  const t = await open('/workshop/till', { me: JO, till: B1, serving: { id: 21, name: 'Jo Taylor' }, floatCheck: DUE });
  const check = t.within(await t.ui.findByRole('dialog', { name: 'Hello, Jo' }));
  assert.ok(check.getByText('Till B1 · first in today to take payments'));
  t.fireEvent.click(check.getByRole('button', { name: 'Count it' }));
  const count = t.within(await t.ui.findByRole('dialog', { name: 'Count the float' }));
  assert.ok(count.getByText('Till B1 · count every note and coin'));
});

test('Today: a line per till, and the short float names its till', async () => {
  const short = { kind: 'float_short', checkId: 9, day: '2026-09-01', shortPence: 1000, tillCode: 'B1', countedByName: 'Jo Taylor', checkedAt: '2026-09-01T07:55:00Z', reason: '' };
  const t = await open('/workshop/today', { todayTills: [OPEN_B1, { code: 'B2', openedAt: null, openedBy: null, floatCheck: null }], items: [short] });
  const tills = t.within(await t.ui.findByRole('region', { name: 'Tills' }));
  await tills.findByText('Till B1');
  assert.deepEqual(tills.getAllByRole('listitem').map((li) => li.textContent), [
    'Till B1Open · float checked by Jo Taylor at 08:55Float short',
    'Till B2Not open yet',
  ]);
  assert.ok(await t.ui.findByText('Till B1’s float was £10.00 short this morning'));
});
