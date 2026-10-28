// Who's in and Tills on Today, and "Your till PIN" by itself
// (openspec/changes/whos-in-and-first-pin; drawn as op-today, op-today-staff,
// op-today-late, op-today-short, op-today-seen in opening.mjs and pin-first,
// pin-cleared in signin.mjs; opening the shop decisions 3 to 6; UX
// walk-through 4 H1).
import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const JO = { ...OWNER, id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false };
// Wednesday 21 October 2026 in the shop (British Summer Time).
const at = (hhmm) => new Date(`2026-10-21T${hhmm}:00+01:00`);
const PEOPLE = [
  { id: 21, name: 'Jo Taylor', role: 'Staff', checkedInAt: '2026-10-21T07:52:00Z' },
  { id: 1, name: 'Jack Lewis', role: 'Owner', checkedInAt: '2026-10-21T08:05:00Z' },
  { id: 22, name: 'Alex Morgan', role: 'Mechanic', dueAt: '09:30' },
];
const OPEN = { openedAt: '2026-10-21T07:52:00Z', openedBy: 'Jo Taylor', floatCheck: { byName: 'Jo Taylor', at: '2026-10-21T07:55:00Z', short: false, seenByName: null } };

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

const SERVICES = [{ id: 1, name: 'Fit & adjust brakes', price: 18, minutes: 30, active: true }];
const FLOAT_DUE = { day: '2026-10-21', floatPence: 15000, takesPayments: true, firstDay: false, check: null };
const LOOKED = { id: 9, how: 'looked', expectedPence: 15000, countedPence: null, reason: '', checkedByName: 'Jo Taylor', checkedAt: '2026-10-21T07:55:00Z' };

async function open(path, { who = OWNER, now = at('10:00'), people = PEOPLE, till = OPEN, ask = null, offers = ['7305', '4182'], floatCheck = { ...FLOAT_DUE, check: LOOKED } } = {}) {
  const calls = [];
  let float = floatCheck;
  const realFetch = globalThis.fetch;
  mock.timers.enable({ apis: ['Date'], now });
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ url, method, body: init.body ? JSON.parse(init.body) : undefined });
    const reply = (status, body) => ({ status, ok: status < 300, json: async () => body });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, who);
    if (u.pathname === '/api/today/whos-in') return reply(200, { people });
    if (u.pathname === '/api/today/tills') return who.isOwner ? reply(200, { tills: [{ code: null, ...till }] }) : reply(403, { error: 'no', code: 'owner_only' });
    if (u.pathname === '/api/needs-attention') return who.isOwner ? reply(200, { items: [] }) : reply(403, { error: 'no', code: 'owner_only' });
    if (u.pathname === '/api/your-settings/till-pin/ask') return method === 'POST' ? reply(200, { ask: null }) : reply(200, { ask });
    if (u.pathname === '/api/your-settings/till-pin/offer') return reply(201, { pin: offers.shift() });
    if (u.pathname === '/api/your-settings/till-pin' && method === 'POST') return reply(200, { hasPin: true });
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [{ weekday: 3, open: '09:00', close: '17:30' }] });
    if (u.pathname === '/api/workshop-jobs') return reply(200, []);
    if (u.pathname === '/api/till-checkin') return reply(200, { serving: { id: 21, name: 'Jo Taylor' }, checkedInToday: [{ id: 21, name: 'Jo Taylor' }], givePin: [] });
    if (u.pathname === '/api/float-check' && method === 'POST') { float = { ...float, check: LOOKED }; return reply(201, { check: LOOKED }); }
    if (u.pathname === '/api/float-check') return reply(200, float);
    if (u.pathname === '/api/workshop-services') return reply(200, SERVICES);
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
const card = async (t, name) => t.within(await t.ui.findByRole('region', { name }));
const lines = (region) => region.getAllByRole('listitem').map((li) => li.textContent);

test('Who\'s in: checked in first in first, with each role, and a mechanic not in yet', async () => {
  const t = await open('/workshop/today', { now: at('09:10') });
  const who = await card(t, 'Who’s in');
  await who.findByText('Jo Taylor');
  assert.deepEqual(lines(who), [
    'Jo TaylorChecked in at 08:52 · StaffIn',
    'Jack LewisChecked in at 09:05 · OwnerIn',
    'Alex MorganDue in at 09:30 · MechanicNot in yet',
  ]);
});

test('Who\'s in: once the start time has passed, Not in yet reads Late, with no alert', async () => {
  const t = await open('/workshop/today', { now: at('09:31') });
  const who = await card(t, 'Who’s in');
  assert.ok(await who.findByText('Late'));
  assert.ok(who.queryByText('Not in yet') === null);
  assert.ok(who.queryByRole('alert') === null);
});

test('Tills, for the Owner: open with the float checked, Float short, seen, and not open yet', async () => {
  const t = await open('/workshop/today');
  const tills = await card(t, 'Tills');
  assert.ok(await tills.findByText('Open · float checked by Jo Taylor at 08:55'));
  assert.ok(tills.queryByText('Till'));
  t.cleanup(); current.shell.queryClient.clear(); current.uninstall(); mock.timers.reset(); current = undefined;
  const s = await open('/workshop/today', { till: { ...OPEN, floatCheck: { ...OPEN.floatCheck, short: true } } });
  assert.ok(await (await card(s, 'Tills')).findByText('Float short'));
  s.cleanup(); current.shell.queryClient.clear(); current.uninstall(); mock.timers.reset(); current = undefined;
  const seen = await open('/workshop/today', { till: { ...OPEN, floatCheck: { ...OPEN.floatCheck, short: true, seenByName: 'Jack Lewis' } } });
  assert.ok(await (await card(seen, 'Tills')).findByText('Float short · seen by Jack Lewis'));
  seen.cleanup(); current.shell.queryClient.clear(); current.uninstall(); mock.timers.reset(); current = undefined;
  const early = await open('/workshop/today', { till: { openedAt: null, openedBy: null, floatCheck: null } });
  assert.ok(await (await card(early, 'Tills')).findByText('Not open yet'));
  early.cleanup(); current.shell.queryClient.clear(); current.uninstall(); mock.timers.reset(); current = undefined;
  const opened = await open('/workshop/today', { till: { ...OPEN, floatCheck: null } });
  assert.ok(await (await card(opened, 'Tills')).findByText('Open · Jo Taylor checked in at 08:52'));
});

test('on a computer the Owner\'s left column is Needs attention, Tills, Who\'s in', async () => {
  const t = await open('/workshop/today');
  await card(t, 'Who’s in');
  await card(t, 'Tills');
  const ids = ['today-attention', 'today-tills', 'today-whos-in', 'today-workshop'].map((id) => t.ui.container.querySelector(`[aria-labelledby="${id}"]`));
  assert.ok(ids[0].parentElement === ids[1].parentElement && ids[1].parentElement === ids[2].parentElement, 'one column');
  assert.ok(ids[0].nextElementSibling === ids[1] && ids[1].nextElementSibling === ids[2], 'in the drawn order');
  assert.ok(ids[2].parentElement !== ids[3].parentElement, 'Workshop today has its own column');
});

test('Staff see Who\'s in beside Workshop today, and no Tills; its line isn\'t asked for', async () => {
  const t = await open('/workshop/today', { who: JO });
  const who = await card(t, 'Who’s in');
  await who.findByText('Alex Morgan');
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(t.ui.queryByRole('heading', { name: 'Tills' }) === null);
  assert.ok(!t.calls.some((c) => c.url.includes('/api/today/tills')), 'it asked for the Owner\'s till line');
  const [mine, work] = ['today-whos-in', 'today-workshop'].map((id) => t.ui.container.querySelector(`[aria-labelledby="${id}"]`));
  assert.ok(mine.parentElement !== work.parentElement, 'two columns, as op-today-staff');
});

test('a first sign-in opens Your till PIN by itself; Skip for now leaves the page and isn\'t asked again', async () => {
  const t = await open('/workshop/today', { who: JO, ask: 'first' });
  const pop = t.within(await t.ui.findByRole('dialog', { name: 'Your till PIN' }));
  assert.ok(await pop.findByText('New PIN 7 3 0 5'));
  assert.ok(pop.queryByText(/^Welcome to North Street Cycles, Jo\. This PIN checks you in/));
  assert.ok(pop.queryByRole('button', { name: /Close/ }) === null, 'no ✕');
  // Escape does nothing: the browser's cancel is stopped (the float check's fix).
  const escape = new window.Event('cancel', { cancelable: true });
  t.ui.getByRole('dialog', { name: 'Your till PIN' }).dispatchEvent(escape);
  assert.equal(escape.defaultPrevented, true);
  t.fireEvent.click(pop.getByRole('button', { name: 'Skip for now' }));
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog', { name: 'Your till PIN' }) === null));
  assert.equal(t.calls.filter((c) => c.method === 'POST' && c.url === '/api/your-settings/till-pin/ask').length, 1);
  assert.equal(t.calls.filter((c) => c.method === 'POST' && c.url === '/api/your-settings/till-pin').length, 0);
  assert.equal(window.location.pathname, '/workshop/today', 'still on the page they landed on');
});

test('after a PIN was cleared it opens in the cleared words; Keep this PIN keeps it and records the ask', async () => {
  const t = await open('/workshop/today', { who: JO, ask: 'cleared' });
  const pop = t.within(await t.ui.findByRole('dialog', { name: 'Your till PIN' }));
  assert.ok(pop.queryByText(/^Your old PIN was cleared, so here’s a new one\. Wheelhouse picked it/));
  await pop.findByText('New PIN 7 3 0 5');
  t.fireEvent.click(pop.getByRole('button', { name: 'Keep this PIN' }));
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog', { name: 'Your till PIN' }) === null));
  assert.deepEqual(t.calls.filter((c) => c.method === 'POST' && c.url === '/api/your-settings/till-pin').map((c) => c.body), [{ pin: '7305' }]);
  assert.equal(t.calls.filter((c) => c.method === 'POST' && c.url === '/api/your-settings/till-pin/ask').length, 1);
});

const pinPopUp = (t) => t.ui.queryByRole('dialog', { name: 'Your till PIN' });
const settle = () => new Promise((r) => setTimeout(r, 60));

test('the PIN pop-up waits while the float check is showing, then opens once it\'s done', async () => {
  const t = await open('/workshop/till', { who: JO, ask: 'first', floatCheck: FLOAT_DUE });
  const check = t.within(await t.ui.findByRole('dialog', { name: 'Hello, Jo' }));
  await t.waitFor(() => assert.ok(t.calls.some((c) => c.url === '/api/your-settings/till-pin/ask')));
  await settle();
  assert.ok(pinPopUp(t) === null, 'never over another pop-up');
  t.fireEvent.click(check.getByRole('button', { name: 'Looks right' }));
  assert.ok(await t.ui.findByRole('dialog', { name: 'Your till PIN' }));
  assert.ok(t.ui.queryByRole('dialog', { name: 'Hello, Jo' }) === null);
});

test('the PIN pop-up waits while a sale is open, then opens once it\'s cleared', async () => {
  const t = await open('/workshop/till', { who: JO, ask: null });
  t.fireEvent.click(await t.ui.findByRole('button', { name: /Fit & adjust brakes/ }));
  await t.ui.findByRole('button', { name: 'Take payment · £18.00' });
  // The ask arrives late, with the sale open.
  current.shell.queryClient.setQueryData(['till-pin-ask'], { ask: 'first' });
  await settle();
  assert.ok(pinPopUp(t) === null, 'never over an open sale');
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Clear' }));
  assert.ok(await t.ui.findByRole('dialog', { name: 'Your till PIN' }));
});

test('the PIN pop-up waits while the pay box is open', async () => {
  const t = await open('/workshop/till', { who: JO, ask: null });
  t.fireEvent.click(await t.ui.findByRole('button', { name: /Fit & adjust brakes/ }));
  t.fireEvent.click(await t.ui.findByRole('button', { name: 'Take payment · £18.00' }));
  await t.ui.findAllByRole('dialog');
  current.shell.queryClient.setQueryData(['till-pin-ask'], { ask: 'first' });
  await settle();
  assert.ok(pinPopUp(t) === null, 'never over the pay box');
});

test('Late only once the due time has passed: at 09:30 exactly it is still Not in yet', async () => {
  const t = await open('/workshop/today', { now: at('09:30') });
  const who = await card(t, 'Who’s in');
  assert.ok(await who.findByText('Not in yet'));
  assert.ok(who.queryByText('Late') === null);
});

test('Tills: a float look at closing with nobody checked in is still Not open yet', async () => {
  const t = await open('/workshop/today', { till: { openedAt: null, openedBy: null, floatCheck: { byName: 'Jack Lewis', at: '2026-10-21T16:55:00Z', short: false, seenByName: null } } });
  const tills = await card(t, 'Tills');
  assert.ok(await tills.findByText('Not open yet'));
  assert.ok(tills.queryByText(/float checked/) === null);
});

test('the PIN pop-up is described by its intro', async () => {
  const t = await open('/workshop/today', { who: JO, ask: 'first' });
  const pop = await t.ui.findByRole('dialog', { name: 'Your till PIN' });
  const id = pop.getAttribute('aria-describedby');
  assert.ok(id, 'aria-describedby is set');
  assert.match(document.getElementById(id)?.textContent ?? '', /^Welcome to North Street Cycles, Jo\./);
});

test('nobody to ask: no pop-up, and no PIN asked for', async () => {
  const t = await open('/workshop/today', { who: JO, ask: null });
  await card(t, 'Who’s in');
  await t.waitFor(() => assert.ok(t.calls.some((c) => c.url === '/api/your-settings/till-pin/ask')));
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(t.ui.queryByRole('dialog') === null);
  assert.ok(!t.calls.some((c) => c.url === '/api/your-settings/till-pin/offer'));
});
