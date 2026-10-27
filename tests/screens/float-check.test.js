// Opening the shop with a float check (openspec/changes/opening-float-check):
// the pop-ups over the till (op-float-check, op-float-check-first,
// op-float-count, op-float-matched, op-float-short, op-float-over), the
// float in Settings › End of day (set-eod), and a short float on Today
// (op-today-short, op-today-seen). Opening the shop decisions 2 and 8.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const JO = { id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false, shopName: 'North Street Cycles', shopSlug: 'north-street', employee: { id: 21, name: 'Jo Taylor', isCashier: true } };
const JACK = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const DUE = { day: '2026-09-01', floatPence: 15000, takesPayments: true, firstDay: false, check: null };
const madeCheck = (body) => ({ id: 7, how: body.countedPence === null ? 'looked' : 'counted', expectedPence: 15000, countedPence: body.countedPence, reason: body.reason ?? '', checkedByName: 'Jo Taylor', checkedAt: '2026-09-01T08:02:00Z' });
const SHORT = { kind: 'float_short', checkId: 7, day: new Date().toLocaleDateString('en-CA'), shortPence: 420, countedByName: 'Jo Taylor', checkedAt: new Date().toISOString(), reason: 'change given wrong' };

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let server;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

async function open(path, { me = JO, floatCheck = DUE, saveStatus = 201, float = 15000, items = [SHORT] } = {}) {
  calls = [];
  server = { floatCheck, float, items };
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, me);
    if (u.pathname === '/api/float-check' && method === 'POST') {
      if (saveStatus !== 201) return reply(saveStatus, { error: saveStatus === 400 ? 'The count must be pounds and pence' : 'Internal error' });
      server.floatCheck = { ...server.floatCheck, check: madeCheck(body) };
      return reply(201, { check: server.floatCheck.check });
    }
    if (u.pathname === '/api/float-check') return server.floatCheck ? reply(200, server.floatCheck) : reply(404, { error: 'Not found' });
    if (u.pathname === '/api/end-of-day-settings' && method === 'PUT') { server.float = body.floatPence; return reply(200, { floatPence: server.float }); }
    if (u.pathname === '/api/end-of-day-settings') return reply(200, { floatPence: server.float });
    if (u.pathname === '/api/float-check/7/seen') { server.items = []; return reply(200, { ok: true }); }
    if (u.pathname === '/api/needs-attention') return reply(200, { items: server.items });
    if (u.pathname === '/api/workshop-services') return reply(200, []);
    if (u.pathname === '/api/shop-details') return reply(200, { name: 'North Street Cycles' });
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/workshop-jobs') return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom(`http://localhost${path}`);
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui };
}
const openTill = (options) => open('/workshop/till', options);
const saves = () => calls.filter((c) => c.method === 'POST' && c.url === '/api/float-check').map((c) => c.body);
const settled = async (t) => { await t.ui.findByRole('region', { name: 'Sale' }); await t.waitFor(() => assert.equal(shell.queryClient.isFetching(), 0)); };
const popUp = async (t, name) => t.within(await t.ui.findByRole('dialog', { name }));

test('first in: a one-tap float check, with Count it and Looks right and no ✕', async () => {
  const t = await openTill();
  const check = await popUp(t, 'Hello, Jo');
  assert.ok(check.queryByText('first in today to take payments'));
  assert.ok(check.queryByText('The drawer should have'));
  assert.ok(check.queryByText('£150.00'));
  assert.ok(check.queryByText('The shop’s float'));
  assert.ok(check.queryByText('Have a quick look. If it doesn’t look right, count it — it only takes a minute.'));
  assert.deepEqual(check.getAllByRole('button').map((b) => b.textContent), ['Count it', 'Looks right']);
  // Escape doesn't close it: both ways out are answers (audit M1).
  const dialog = t.ui.getByRole('dialog', { name: 'Hello, Jo' });
  const escape = new window.Event('cancel', { cancelable: true });
  dialog.dispatchEvent(escape);
  assert.equal(escape.defaultPrevented, true);
});

test('Looks right saves a look and the till says so', async () => {
  const t = await openTill();
  const check = await popUp(t, 'Hello, Jo');
  t.fireEvent.click(check.getByRole('button', { name: 'Looks right' }));
  await t.waitFor(() => assert.deepEqual(saves(), [{ countedPence: null }]));
  assert.ok(await t.ui.findByText('Float checked · looked right · Jo Taylor'));
  assert.ok(t.ui.queryByRole('dialog') === null);
});

test('nobody is asked when the float is checked, not set, the person doesn\'t take payments, or the check can\'t be read', async () => {
  for (const floatCheck of [{ ...DUE, check: madeCheck({ countedPence: null }) }, { ...DUE, floatPence: null }, { ...DUE, takesPayments: false }, null]) {
    const t = await openTill({ floatCheck });
    await settled(t);
    assert.ok(t.ui.queryByRole('dialog') === null, JSON.stringify(floatCheck));
    t.cleanup();
    shell.queryClient.clear();
    uninstall();
  }
});

test('the first day on Wheelhouse is counted: Count it only', async () => {
  const t = await openTill({ floatCheck: { ...DUE, firstDay: true } });
  const check = await popUp(t, 'Hello, Jo');
  assert.ok(check.queryByText('first in on the first day on Wheelhouse'));
  assert.ok(check.queryByText('This is the first day the till takes real money, and nothing has been counted in Wheelhouse before. Count the float once, so today starts from a real figure.'));
  assert.deepEqual(check.getAllByRole('button').map((b) => b.textContent), ['Count it']);
});

test('Count it opens the count; Done counting stays off until something is counted; a match starts the day', async () => {
  const t = await openTill();
  t.fireEvent.click((await popUp(t, 'Hello, Jo')).getByRole('button', { name: 'Count it' }));
  const count = await popUp(t, 'Count the float');
  assert.ok(count.queryByText('count every note and coin'));
  assert.ok(count.queryByRole('group', { name: 'Count each note and coin' }));
  // Blind: the count never shows what the drawer should have.
  assert.ok(count.queryByText('£150.00') === null);
  const done = count.getByRole('button', { name: 'Done counting' });
  assert.equal(done.disabled, true);
  t.fireEvent.change(count.getByLabelText('Number of £50'), { target: { value: '3' } });
  assert.equal(done.disabled, false);
  t.fireEvent.click(done);
  await t.waitFor(() => assert.deepEqual(saves(), [{ countedPence: 15000 }]));
  assert.ok(await t.ui.findByText('Float checked · counted by Jo Taylor'));
  assert.ok(t.ui.queryByRole('dialog') === null);
});

test('Back goes from the count to the float check', async () => {
  const t = await openTill();
  t.fireEvent.click((await popUp(t, 'Hello, Jo')).getByRole('button', { name: 'Count it' }));
  t.fireEvent.click((await popUp(t, 'Count the float')).getByRole('button', { name: 'Back' }));
  assert.ok(await popUp(t, 'Hello, Jo'));
  assert.deepEqual(saves(), []);
});

async function countTo(t, total) {
  const count = await popUp(t, 'Count the float');
  t.fireEvent.change(count.getByLabelText('Cash counted, total'), { target: { value: total } });
  t.fireEvent.click(count.getByRole('button', { name: 'Done counting' }));
}

test('a short count says so, Count again goes back, and Start the day saves the count and the reason', async () => {
  const t = await openTill();
  t.fireEvent.click((await popUp(t, 'Hello, Jo')).getByRole('button', { name: 'Count it' }));
  await countTo(t, '145.80');
  let diff = await popUp(t, 'The float is short');
  assert.ok(diff.queryByText('counted by Jo Taylor'));
  assert.deepEqual([...t.ui.getByRole('dialog', { name: 'The float is short' }).querySelectorAll('[data-row]')].map((r) => r.textContent), ['Should have£150.00', 'Counted£145.80', 'Difference£4.20 short']);
  assert.ok(diff.queryByText('A manager sees this on Today. The till starts with what you counted.'));
  assert.deepEqual(diff.getAllByRole('button').map((b) => b.textContent), ['Count again', 'Start the day']);
  assert.deepEqual(saves(), [], 'nothing saved until Start the day');
  t.fireEvent.click(diff.getByRole('button', { name: 'Count again' }));
  await countTo(t, '145.80');
  diff = await popUp(t, 'The float is short');
  t.fireEvent.change(diff.getByLabelText(/Any idea why\?/), { target: { value: 'change given wrong' } });
  t.fireEvent.click(diff.getByRole('button', { name: 'Start the day' }));
  await t.waitFor(() => assert.deepEqual(saves(), [{ countedPence: 14580, reason: 'change given wrong' }]));
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog') === null));
});

test('an over count says the float is over', async () => {
  const t = await openTill();
  t.fireEvent.click((await popUp(t, 'Hello, Jo')).getByRole('button', { name: 'Count it' }));
  await countTo(t, '151.00');
  const diff = await popUp(t, 'The float is over');
  assert.ok(diff.queryByText('£1.00 over'));
});

test('a save that fails says so and keeps the pop-up', async () => {
  const t = await openTill({ saveStatus: 500 });
  t.fireEvent.click((await popUp(t, 'Hello, Jo')).getByRole('button', { name: 'Looks right' }));
  const check = await popUp(t, 'Hello, Jo');
  assert.ok(await check.findByText('Wheelhouse couldn’t save that. Try again in a moment.'));
});

test('Settings › End of day › Float: the float, saved in whole pence when the box is left', async () => {
  const t = await open('/workshop/settings?room=front-desk', { me: JACK, float: null });
  await t.ui.findByRole('heading', { level: 2, name: 'Front desk' });
  assert.ok(t.ui.queryByRole('heading', { name: 'End of day' }));
  assert.ok(t.ui.queryByText('How the till closes each day.'));
  const fold = await t.ui.findByRole('button', { name: /^Float/ });
  await t.waitFor(() => assert.match(fold.textContent, /Not set yet/));
  if (fold.getAttribute('aria-expanded') !== 'true') t.fireEvent.click(fold);
  const box = await t.ui.findByLabelText('Leave this much in the drawer each night');
  assert.ok(t.ui.queryByText('Close the day works out the rest to bank, so every day starts with the same float.'));
  t.fireEvent.change(box, { target: { value: '12.345' } });
  t.fireEvent.blur(box);
  assert.ok(await t.ui.findByText('Pounds and pence, like 150.00'));
  t.fireEvent.change(box, { target: { value: '£150' } });
  t.fireEvent.blur(box);
  await t.waitFor(() => assert.deepEqual(calls.filter((c) => c.method === 'PUT').map((c) => c.body), [{ floatPence: 15000 }]));
  assert.ok(await t.ui.findByText('Saved.'));
  await t.waitFor(() => assert.match(fold.textContent, /£150\.00/));
});

test('Today: a short float, who counted it and why, cleared by Seen', async () => {
  const t = await open('/workshop/today', { me: JACK });
  const line = await t.ui.findByText('The float was £4.20 short this morning');
  const row = line.closest('li');
  assert.match(row.textContent, /Counted by Jo Taylor at \d\d:\d\d · “change given wrong”/);
  t.fireEvent.click(t.within(row).getByRole('button', { name: 'Seen' }));
  await t.waitFor(() => assert.ok(calls.some((c) => c.method === 'POST' && c.url === '/api/float-check/7/seen')));
  await t.waitFor(() => assert.ok(t.ui.queryByText('The float was £4.20 short this morning') === null));
});

// Review, 27 Oct: each step opens fresh, with the focus in it, so Enter on one
// step's button can't press the next step's, and a screen reader hears the new title.
test('each step takes the focus: the first box to count, then Any idea why?', async () => {
  const t = await openTill();
  const count = (await popUp(t, 'Hello, Jo')).getByRole('button', { name: 'Count it' });
  count.focus();
  t.fireEvent.click(count);
  const counting = await popUp(t, 'Count the float');
  await t.waitFor(() => assert.ok(document.activeElement === counting.getByLabelText('Number of £50')));
  t.fireEvent.change(counting.getByLabelText('Cash counted, total'), { target: { value: '145.80' } });
  const done = counting.getByRole('button', { name: 'Done counting' });
  done.focus();
  t.fireEvent.click(done);
  const diff = await popUp(t, 'The float is short');
  await t.waitFor(() => assert.ok(document.activeElement === diff.getByLabelText(/Any idea why\?/)));
  // Each step is its own pop-up, not the last one's reused.
  assert.equal(t.ui.getAllByRole('dialog').length, 1);
});

test('a count the server refuses shows its words', async () => {
  const t = await openTill({ saveStatus: 400 });
  t.fireEvent.click((await popUp(t, 'Hello, Jo')).getByRole('button', { name: 'Looks right' }));
  assert.ok(await (await popUp(t, 'Hello, Jo')).findByText('The count must be pounds and pence'));
});

// Review, 27 Oct: a till left open overnight asks again the next morning.
test('the float check is read again when the till comes back into view', async () => {
  const t = await openTill({ floatCheck: { ...DUE, check: madeCheck({ countedPence: null }) } });
  await settled(t);
  assert.ok(t.ui.queryByRole('dialog') === null);
  server.floatCheck = { ...DUE, day: '2026-09-02' };
  window.dispatchEvent(new window.Event('focus'));
  window.dispatchEvent(new window.Event('visibilitychange'));
  assert.ok(await popUp(t, 'Hello, Jo'));
});

test('Today: an earlier day\'s short float gives its date', async () => {
  const t = await open('/workshop/today', { me: JACK, items: [{ ...SHORT, day: '2026-08-31', checkedAt: '2026-08-31T08:02:00Z' }] });
  assert.ok(await t.ui.findByText('The float was £4.20 short on Mon 31 Aug'));
});
