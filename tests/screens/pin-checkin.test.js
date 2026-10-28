// Till PINs and the PIN check-in (openspec/changes/pins-and-checkin; drawn
// in signin.mjs as till-checkin, till-pin-wrong, pin-change and pin-first,
// and app-map.mjs's tillBar and yourSettingsDialog). Enter your PIN on the
// till, the fourth digit checked at once, a wrong PIN, Serving and switch,
// the float check after the check-in, the pay box's serving name, and
// Your settings' Till PIN with Wheelhouse picking the PIN.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
// Signed in on the till as the Owner; Jo Taylor checks in with her PIN.
const JACK = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street', employee: null };
const JO_ME = { id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false, shopName: 'North Street Cycles', shopSlug: 'north-street', employee: { id: 21, name: 'Jo Taylor', isCashier: true } };
const JO = { id: 21, name: 'Jo Taylor' };
const ALEX = { id: 22, name: 'Alex Morgan' };
const SERVICES = [{ id: 1, name: 'Fit & adjust brakes', price: 18, minutes: 30, active: true }];
const WRONG = 'That PIN isn’t anyone’s — try again';

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

async function open(path, { me = JACK, serving = null, today = [ALEX], checkin = null, floatCheck = null, tillPin = { canHavePin: true, hasPin: true }, offers = ['7305', '4182'], keep = null } = {}) {
  const calls = [];
  const server = { serving, today, offers: [...offers] };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, me);
    if (u.pathname === '/api/till-checkin/end') { server.serving = null; return reply(200, { serving: null }); }
    if (u.pathname === '/api/till-checkin' && method === 'POST') {
      const answer = checkin ? await checkin(body.pin) : { status: 201, body: { serving: JO } };
      if (answer.status === 201) { server.serving = answer.body.serving; server.today = [...server.today, answer.body.serving]; }
      return reply(answer.status, answer.body);
    }
    if (u.pathname === '/api/till-checkin') return server.failCheckin ? reply(500, { error: 'Internal server error' }) : reply(200, { serving: server.serving, checkedInToday: server.today });
    if (u.pathname === '/api/your-settings/till-pin/offer') {
      if (server.offerReply) { const r = await server.offerReply(); return reply(r.status, r.body); }
      return reply(201, { pin: server.offers.shift() });
    }
    if (u.pathname === '/api/your-settings/till-pin' && method === 'POST') { const k = keep ?? { status: 200, body: { hasPin: true } }; return reply(k.status, k.body); }
    if (u.pathname === '/api/your-settings/till-pin') return reply(200, tillPin);
    if (u.pathname === '/api/your-settings') return reply(200, { accessibility: {} });
    if (u.pathname === '/api/float-check') return floatCheck ? reply(200, floatCheck) : reply(200, { day: '2026-09-01', floatPence: null, takesPayments: true, firstDay: false, check: null });
    if (u.pathname === '/api/workshop-services') return reply(200, SERVICES);
    if (u.pathname === '/api/sales' && method === 'POST') return reply(201, { id: 501 });
    if (u.pathname === '/api/shop-details') return reply(200, { name: 'North Street Cycles' });
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    return reply(404, { error: 'Not found' });
  };
  const uninstall = installDom(`http://localhost${path}`);
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
const press = (t, name) => t.fireEvent.click(t.ui.getByRole('button', { name }));
// The dots' status: hidden words a screen reader reads out (review, 28 Oct, item 7).
const dotsSay = () => document.querySelector('[data-pin-dots]')?.textContent;
const checkins = (t) => t.calls.filter((c) => c.method === 'POST' && c.url === '/api/till-checkin').map((c) => c.body);

test('nobody serving: the till asks Enter your PIN, with the pad and who’s checked in today', async () => {
  const t = await open('/workshop/till');
  await t.ui.findByRole('heading', { name: 'Enter your PIN' });
  assert.ok(t.ui.queryByText('Your PIN checks you in and puts your name on sales and workshop work.'));
  assert.equal(dotsSay(), '0 of 4 digits');
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'Clear', 'Delete the last digit']) assert.ok(t.ui.getByRole('button', { name: k }), k);
  assert.ok(t.ui.queryByText('Checked in today'));
  assert.ok(t.ui.queryByText('Alex Morgan'));
  assert.ok(t.ui.queryByText(/No PIN yet\?/));
  // No OK button, no sale and no float check until someone checks in.
  assert.ok(t.ui.queryByRole('button', { name: 'OK' }) === null);
  assert.ok(t.ui.queryByRole('region', { name: 'Sale' }) === null);
});

test('the fourth digit checks in at once, and the till is Jo’s', async () => {
  const t = await open('/workshop/till');
  await t.ui.findByRole('heading', { name: 'Enter your PIN' });
  for (const d of ['7', '3', '0']) press(t, d);
  assert.equal(dotsSay(), '3 of 4 digits');
  assert.deepEqual(checkins(t), [], 'nothing sent before the fourth digit');
  press(t, '5');
  await t.waitFor(() => assert.deepEqual(checkins(t), [{ pin: '7305' }]));
  await t.ui.findByRole('region', { name: 'Sale' });
  assert.ok(t.ui.getByRole('button', { name: 'Serving: Jo Taylor — switch who’s serving' }));
});

test('typed on the keyboard too, with Delete and Clear', async () => {
  const t = await open('/workshop/till');
  await t.ui.findByRole('heading', { name: 'Enter your PIN' });
  for (const key of ['7', '3']) t.fireEvent.keyDown(window, { key });
  assert.equal(dotsSay(), '2 of 4 digits');
  t.fireEvent.keyDown(window, { key: 'Backspace' });
  assert.equal(dotsSay(), '1 of 4 digits');
  press(t, 'Delete the last digit');
  assert.equal(dotsSay(), '0 of 4 digits');
  press(t, '1'); press(t, '2'); press(t, 'Clear');
  assert.equal(dotsSay(), '0 of 4 digits');
  for (const key of ['1', '2', '3', '4']) t.fireEvent.keyDown(window, { key });
  await t.waitFor(() => assert.deepEqual(checkins(t), [{ pin: '1234' }]));
});

test('a wrong PIN clears the dots and says so, with no lock', async () => {
  const t = await open('/workshop/till', { checkin: (pin) => (pin === '7305' ? { status: 201, body: { serving: JO } } : { status: 400, body: { error: WRONG, code: 'wrong_pin' } }) });
  await t.ui.findByRole('heading', { name: 'Enter your PIN' });
  for (const d of ['1', '1', '1', '1']) press(t, d);
  assert.equal((await t.ui.findByRole('alert')).textContent, WRONG);
  assert.equal(dotsSay(), '0 of 4 digits');
  // Straight on to the right one.
  for (const d of ['7', '3', '0', '5']) press(t, d);
  await t.ui.findByRole('region', { name: 'Sale' });
});

test('a check-in that fails says so without blaming the PIN', async () => {
  const t = await open('/workshop/till', { checkin: () => ({ status: 500, body: { error: 'Internal server error' } }) });
  await t.ui.findByRole('heading', { name: 'Enter your PIN' });
  for (const d of ['7', '3', '0', '5']) press(t, d);
  assert.equal((await t.ui.findByRole('alert')).textContent, 'Wheelhouse couldn’t check that PIN. Try again in a moment.');
  assert.equal(dotsSay(), '0 of 4 digits');
});

test('Serving: Jo Taylor switches back to Enter your PIN', async () => {
  const t = await open('/workshop/till', { serving: JO, today: [JO] });
  await t.ui.findByRole('region', { name: 'Sale' });
  press(t, 'Serving: Jo Taylor — switch who’s serving');
  await t.ui.findByRole('heading', { name: 'Enter your PIN' });
  assert.ok(t.calls.some((c) => c.method === 'POST' && c.url === '/api/till-checkin/end'));
});

test('the float check asks the person who checked in, not the till’s sign-in', async () => {
  const t = await open('/workshop/till', { floatCheck: { day: '2026-09-01', floatPence: 15000, takesPayments: true, firstDay: false, check: null } });
  await t.ui.findByRole('heading', { name: 'Enter your PIN' });
  assert.ok(t.ui.queryByRole('dialog', { name: 'Hello, Jo' }) === null, 'not before the check-in');
  for (const d of ['7', '3', '0', '5']) press(t, d);
  assert.ok(await t.ui.findByRole('dialog', { name: 'Hello, Jo' }));
});

test('the pay box names the person checked in and skips Who’s serving', async () => {
  const t = await open('/workshop/till', { serving: JO, today: [JO] });
  await t.ui.findByRole('region', { name: 'Sale' });
  t.fireEvent.click(await t.ui.findByRole('button', { name: /Fit & adjust brakes/ }));
  press(t, 'Take payment · £18.00');
  const pay = t.within(await t.ui.findByRole('dialog'));
  assert.ok(pay.queryByText('Jo Taylor serving · 1 item'));
  assert.ok(pay.queryByText('Who’s serving?') === null);
});

test('Your settings: Change PIN shows a PIN Wheelhouse picked, another on request, and keeps it', async () => {
  const t = await open('/workshop/your-settings', { me: JO_ME });
  await t.ui.findByText('Till PIN');
  assert.ok(t.ui.getByLabelText('PIN is set'));
  assert.ok(t.ui.queryByText('Checks you in at the till and puts your name on sales and workshop work. Only you know it.'));
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Change PIN' }));
  const pop = t.within(await t.ui.findByRole('dialog', { name: 'Your new till PIN' }));
  assert.ok(await pop.findByText('New PIN 7 3 0 5'));
  assert.ok(pop.queryByText('Wheelhouse picked this for you — nobody else at the shop has it. Learn it before you close this.'));
  assert.ok(pop.queryByText('Your old PIN stops working when you keep this one.'));
  assert.ok(pop.getByRole('button', { name: 'Close without changing your PIN' }));
  assert.ok(pop.queryByRole('button', { name: 'Skip for now' }) === null);
  t.fireEvent.click(pop.getByRole('button', { name: 'Give me a different one' }));
  assert.ok(await pop.findByText('New PIN 4 1 8 2'));
  t.fireEvent.click(pop.getByRole('button', { name: 'Keep this PIN' }));
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog', { name: 'Your new till PIN' }) === null));
  assert.deepEqual(t.calls.filter((c) => c.method === 'POST' && c.url === '/api/your-settings/till-pin').map((c) => c.body), [{ pin: '4182' }]);
});

test('Your settings: no PIN yet, Get your PIN, with Skip for now', async () => {
  const t = await open('/workshop/your-settings', { me: JO_ME, tillPin: { canHavePin: true, hasPin: false } });
  await t.ui.findByText('No PIN yet');
  assert.ok(t.ui.queryByText('You need one to check in at the till. Wheelhouse picks it, and only you see it.'));
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Get your PIN' }));
  const pop = t.within(await t.ui.findByRole('dialog', { name: 'Your till PIN' }));
  assert.ok(await pop.findByText('New PIN 7 3 0 5'));
  assert.ok(pop.queryByText(/^Welcome to North Street Cycles, Jo\. This PIN checks you in/));
  assert.ok(pop.queryByText('Not using the till? Skip it — you can get a PIN later in Your settings.'));
  t.fireEvent.click(pop.getByRole('button', { name: 'Skip for now' }));
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog', { name: 'Your till PIN' }) === null));
  assert.equal(t.calls.filter((c) => c.method === 'POST' && c.url === '/api/your-settings/till-pin').length, 0);
});

test('Your settings: a PIN someone kept meanwhile says so; no Till block without a team member', async () => {
  const t = await open('/workshop/your-settings', { me: JO_ME, keep: { status: 409, body: { error: 'Someone has just been given that PIN. Ask for a different one.', code: 'pin_taken' } } });
  t.fireEvent.click(await t.ui.findByRole('button', { name: 'Change PIN' }));
  const pop = t.within(await t.ui.findByRole('dialog', { name: 'Your new till PIN' }));
  await pop.findByText('New PIN 7 3 0 5');
  t.fireEvent.click(pop.getByRole('button', { name: 'Keep this PIN' }));
  assert.equal((await pop.findByRole('alert')).textContent, 'Someone has just been given that PIN. Ask for a different one.');
  t.cleanup();
  current.shell.queryClient.clear();
  current.uninstall();
  globalThis.fetch = current.realFetch;
  current = undefined;
  const s = await open('/workshop/your-settings', { me: JO_ME, tillPin: { canHavePin: false, hasPin: false } });
  await s.ui.findByText('Accessibility');
  await s.waitFor(() => assert.ok(s.calls.some((c) => c.url === '/api/your-settings/till-pin')));
  assert.ok(s.ui.queryByText('Till PIN') === null);
});

// Review, 28 Oct, item 2: only keys meant for the PIN pad count.
test('keys typed into the search, with Ctrl, Alt or Cmd held, or held down, are not PIN digits', async () => {
  const t = await open('/workshop/till');
  await t.ui.findByRole('heading', { name: 'Enter your PIN' });
  const search = t.ui.getByLabelText('Search jobs, customers and bikes');
  for (const key of ['1', '2', '3', '4']) t.fireEvent.keyDown(search, { key });
  t.fireEvent.keyDown(window, { key: '5', ctrlKey: true });
  t.fireEvent.keyDown(window, { key: '6', metaKey: true });
  t.fireEvent.keyDown(window, { key: '7', altKey: true });
  t.fireEvent.keyDown(window, { key: '8', repeat: true });
  assert.equal(dotsSay(), '0 of 4 digits');
  t.fireEvent.keyDown(window, { key: '9' });
  assert.equal(dotsSay(), '1 of 4 digits');
  assert.deepEqual(checkins(t), []);
});

// Review, 28 Oct, item 7: the pad stays focusable while a PIN is checked.
test('while a PIN is being checked the pad says it is busy without losing focus', async () => {
  let answer;
  const t = await open('/workshop/till', { checkin: () => new Promise((resolve) => { answer = resolve; }) });
  await t.ui.findByRole('heading', { name: 'Enter your PIN' });
  for (const d of ['7', '3', '0']) press(t, d);
  const last = t.ui.getByRole('button', { name: '5' });
  last.focus();
  t.fireEvent.click(last);
  await t.waitFor(() => assert.equal(last.getAttribute('aria-disabled'), 'true'));
  assert.equal(last.hasAttribute('disabled'), false);
  assert.ok(document.activeElement === last);
  press(t, '1');
  assert.equal(dotsSay(), '4 of 4 digits', 'nothing typed while checking');
  answer({ status: 201, body: { serving: JO } });
  await t.ui.findByRole('region', { name: 'Sale' });
});

// Review, 28 Oct, item 1: the till is never taken away mid-sale.
test('a failed re-check of who is serving keeps the till and its sale', async () => {
  const t = await open('/workshop/till', { serving: JO, today: [JO] });
  await t.ui.findByRole('region', { name: 'Sale' });
  t.fireEvent.click(await t.ui.findByRole('button', { name: /Fit & adjust brakes/ }));
  t.server.failCheckin = true;
  await current.shell.queryClient.invalidateQueries({ queryKey: ['till-checkin'] });
  await t.waitFor(() => assert.ok(current.shell.queryClient.getQueryState(['till-checkin']).status === 'error'));
  assert.ok(t.ui.queryByRole('region', { name: 'Sale' }));
  assert.ok(t.ui.getByRole('button', { name: 'Take payment · £18.00' }));
  assert.ok(t.ui.queryByText('Wheelhouse couldn’t load the till. Try again in a moment.') === null);
});

test('nobody serving any more mid-sale: the sale and the pay box stay until the sale is done', async () => {
  const t = await open('/workshop/till', { serving: JO, today: [JO] });
  await t.ui.findByRole('region', { name: 'Sale' });
  t.fireEvent.click(await t.ui.findByRole('button', { name: /Fit & adjust brakes/ }));
  press(t, 'Take payment · £18.00');
  await t.ui.findByRole('dialog');
  // The check-in ends elsewhere (the day ends, or it was cleared).
  t.server.serving = null;
  await current.shell.queryClient.invalidateQueries({ queryKey: ['till-checkin'] });
  await t.waitFor(() => assert.ok(current.shell.queryClient.getQueryData(['till-checkin']).serving === null));
  assert.ok(t.ui.queryByRole('dialog'), 'the pay box stays');
  assert.ok(t.within(t.ui.getByRole('dialog')).queryByText('Jo Taylor serving · 1 item'));
  assert.ok(t.ui.queryByRole('heading', { name: 'Enter your PIN' }) === null);
  // Closing the pay box and clearing the sale: then Enter your PIN.
  t.fireEvent.keyDown(t.ui.getByRole('dialog'), { key: 'Escape' });
  t.ui.getByRole('dialog').close();
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog') === null));
  assert.ok(t.ui.queryByRole('region', { name: 'Sale' }), 'a line still in the sale');
  press(t, 'Clear');
  await t.ui.findByRole('heading', { name: 'Enter your PIN' });
});

// Review, 28 Oct, item 5.
test('Give me a different one waits for the PIN it asked for, and says when to wait', async () => {
  let answer;
  const t = await open('/workshop/your-settings', { me: JO_ME });
  t.fireEvent.click(await t.ui.findByRole('button', { name: 'Change PIN' }));
  const pop = t.within(await t.ui.findByRole('dialog', { name: 'Your new till PIN' }));
  await pop.findByText('New PIN 7 3 0 5');
  t.server.offerReply = () => new Promise((resolve) => { answer = resolve; });
  const again = pop.getByRole('button', { name: 'Give me a different one' });
  t.fireEvent.click(again);
  await t.waitFor(() => assert.equal(again.getAttribute('aria-disabled'), 'true'));
  t.fireEvent.click(again);
  assert.equal(t.calls.filter((c) => c.url === '/api/your-settings/till-pin/offer').length, 2, 'one more asked for, not two');
  answer({ status: 429, body: { error: 'Wait a moment, then try again', code: 'slow_down' } });
  assert.equal((await pop.findByRole('alert')).textContent, 'Wait a moment, then try again');
  assert.equal(again.getAttribute('aria-disabled'), 'false');
});
