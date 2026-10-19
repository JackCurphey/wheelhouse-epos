// The first Settings page (Jack, 18 Oct, mechanic sign-off piece 3; drawn as
// set-workshop-sign-off): Workshop › Mechanics holds "Show who signed off to
// customers", off to start, saved as soon as it's switched.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let settings;
let putFails;
let details;
let detailsFail;
let holdDetails = null;
let refuseHours = null;
const WEEK = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, open: '09:00', close: '17:00' }));
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

async function openSettings({ me = OWNER } = {}) {
  calls = [];
  settings = { openingHours: WEEK, openingTime: '08:00', closingTime: '18:00', showSignOffToCustomers: false, fullDayThresholdMinutes: 120, bookingMode: 'timed', timedLeadMinutes: 30 };
  refuseHours = null;
  putFails = false;
  details = { name: 'North Street Cycles', address: null, phone: null, email: null, vatNumber: null, receiptFooter: null };
  detailsFail = false;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, me);
    if (u.pathname === '/api/shop-details' && method === 'PUT') {
      if (detailsFail) return reply(500, { error: 'Internal error' });
      details = { ...details, ...body };
      const answer = reply(200, { ...details });
      if (holdDetails) { const wait = holdDetails; holdDetails = null; await wait; }
      return answer;
    }
    if (u.pathname === '/api/shop-details') return reply(200, details);
    if (u.pathname === '/api/workshop-settings' && method === 'PUT') {
      if (putFails) return reply(500, { error: 'Internal error' });
      if (refuseHours && body.openingHours) return reply(400, { error: refuseHours });
      if (refuseHours && body.fullDayThresholdMinutes !== undefined) return reply(400, { error: refuseHours });
      settings = { ...settings, ...body };
      return reply(200, settings);
    }
    if (u.pathname === '/api/workshop-settings') return reply(200, settings);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom('http://localhost/workshop/settings');
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByRole('heading', { name: me.isOwner ? 'Workshop' : 'Settings aren’t part of your role' });
  return { ...rtl, ui };
}
const has = (q) => Boolean(q);

test('Settings › Workshop › Mechanics has the switch, off, with its note', async () => {
  const { ui } = await openSettings();
  // The staff frame's header names the page, once.
  assert.equal(ui.getAllByRole('heading', { level: 1, name: 'Settings' }).length, 1);
  assert.ok(has(ui.queryByText('Services, who works in the workshop, and how the diary looks.')));
  assert.ok(has(ui.queryByRole('heading', { name: 'Mechanics' })));
  const sw = await ui.findByRole('switch', { name: 'Show who signed off to customers' });
  assert.equal(sw.getAttribute('aria-checked'), 'false');
  assert.ok(has(ui.queryByText('Off')));
  assert.ok(has(ui.queryByText('Adds “Checked by [name]” to their receipt and booking link. Off: only staff see who signed a job off.')));
});

test('switching it on saves at once, and it reads On', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  const sw = await ui.findByRole('switch', { name: 'Show who signed off to customers' });
  fireEvent.click(sw);
  await waitFor(() => assert.deepEqual(calls.filter((c) => c.method === 'PUT').map((c) => c.body), [{ showSignOffToCustomers: true }]));
  await waitFor(() => assert.equal(sw.getAttribute('aria-checked'), 'true'));
  assert.ok(has(ui.queryByText('On')));
});

test('if it can’t be saved, it says so and stays as it was', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  putFails = true;
  const sw = await ui.findByRole('switch', { name: 'Show who signed off to customers' });
  fireEvent.click(sw);
  assert.ok(has(await ui.findByText('Wheelhouse couldn’t save that. Try again in a moment.')));
  await waitFor(() => assert.equal(sw.getAttribute('aria-checked'), 'false'));
});

// Shop details (Jack, 18 Oct, docs/decisions/2026-10-18-shop-details.md; drawn
// as set-shop-details): five boxes, each saved when it's left if it changed.
test('Shop and sites › Shop details shows the five boxes and the note', async () => {
  const { ui } = await openSettings();
  assert.ok(has(ui.queryByRole('heading', { name: 'Shop and sites' })));
  assert.ok(has(ui.queryByRole('heading', { name: 'Shop details' })));
  assert.equal((await ui.findByLabelText('Shop name')).value, 'North Street Cycles');
  for (const label of ['Address', 'Phone', 'Email', 'VAT number']) assert.equal(ui.getByLabelText(label).value, '', label);
  assert.ok(has(ui.queryByText('These show on receipts, emails and the website.')));
});

test('a box saves when it’s left, only if it changed, and says Saved', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  const address = await ui.findByLabelText('Address');
  fireEvent.blur(ui.getByLabelText('Phone'));
  fireEvent.change(address, { target: { value: '[Shop address]' } });
  fireEvent.blur(address);
  await waitFor(() => assert.deepEqual(calls.filter((c) => c.method === 'PUT' && c.url === '/api/shop-details').map((c) => c.body), [{ address: '[Shop address]' }]));
  assert.ok(has(await ui.findByText('Saved.')));
});

test('if a box can’t be saved, it says so and keeps what was typed', async () => {
  const { ui, fireEvent } = await openSettings();
  detailsFail = true;
  const vat = await ui.findByLabelText('VAT number');
  fireEvent.change(vat, { target: { value: '[VAT number]' } });
  fireEvent.blur(vat);
  assert.ok(has(await ui.findByText('Wheelhouse couldn’t save that. Try again in a moment.')));
  assert.equal(vat.value, '[VAT number]');
});

// Fresh review: what's typed while a save is on its way isn't lost, and a
// reply only updates the box it saved.
test('typing more while a box is saving keeps the new words, and they save too', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  let release;
  holdDetails = new Promise((r) => { release = r; });
  const address = await ui.findByLabelText('Address');
  fireEvent.change(address, { target: { value: '12 High St' } });
  fireEvent.blur(address);
  await waitFor(() => assert.equal(calls.filter((c) => c.method === 'PUT').length, 1));
  fireEvent.change(address, { target: { value: '12 High St, Leeds' } });
  release();
  assert.ok(has(await ui.findByText('Saved.')));
  assert.equal(address.value, '12 High St, Leeds');
  fireEvent.blur(address);
  await waitFor(() => assert.deepEqual(calls.filter((c) => c.method === 'PUT').map((c) => c.body), [{ address: '12 High St' }, { address: '12 High St, Leeds' }]));
});

// Words at the bottom (Jack, 19 Oct; drawn in set-till-receipts).
test('Till › Receipts has Words at the bottom, which saves when it’s left', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  assert.ok(has(ui.queryByRole('heading', { name: 'Till' })));
  assert.ok(has(ui.queryByText('What staff see and use at the till.')));
  assert.ok(has(ui.queryByRole('heading', { name: 'Receipts' })));
  const words = await ui.findByLabelText('Words at the bottom');
  assert.equal(words.tagName, 'TEXTAREA');
  assert.equal(words.getAttribute('placeholder'), 'e.g. your returns policy, a thank-you');
  assert.ok(has(ui.queryByText('The shop’s name and address come from Shop and sites. Every receipt carries a barcode so a refund can find the sale.')));
  fireEvent.change(words, { target: { value: '[Returns policy]' } });
  fireEvent.blur(words);
  await waitFor(() => assert.deepEqual(calls.filter((c) => c.method === 'PUT' && c.url === '/api/shop-details').map((c) => c.body), [{ receiptFooter: '[Returns policy]' }]));
  assert.ok(has(await ui.findByText('Saved.')));
});

// Opening hours (Jack, 19 Oct, docs/decisions/2026-10-19-opening-hours.md;
// drawn as set-shop-hours): Monday to Sunday, Open or Closed, hours on the
// hour; each change saves the whole week at once.
const hoursPuts = () => calls.filter((c) => c.method === 'PUT' && c.url === '/api/workshop-settings' && c.body.openingHours).map((c) => c.body.openingHours);

test('Opening hours shows Monday to Sunday, each with its hours or Closed', async () => {
  const { ui } = await openSettings();
  assert.ok(has(await ui.findByRole('heading', { name: 'Opening hours' })));
  // A fixed name per day; whether it's open is its pressed state (fresh review).
  const days = ui.getAllByRole('button', { name: /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) open$/ }).map((b) => [b.getAttribute('aria-label'), b.getAttribute('aria-pressed'), b.textContent]);
  assert.deepEqual(days, [['Monday open', 'true', 'Open'], ['Tuesday open', 'true', 'Open'], ['Wednesday open', 'true', 'Open'], ['Thursday open', 'true', 'Open'], ['Friday open', 'true', 'Open'], ['Saturday open', 'true', 'Open'], ['Sunday open', 'false', 'Closed']]);
  assert.equal(ui.getByLabelText('Monday opens').value, '09:00');
  assert.equal(ui.getByLabelText('Saturday closes').value, '17:00');
  assert.ok(ui.queryByLabelText('Sunday opens') === null);
  assert.ok(has(ui.queryByText('Online booking only offers mechanics on the days they’re in, set on each person.')));
});

test('switching Sunday open saves the whole week, Sunday at the shop’s usual hours', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  fireEvent.click(await ui.findByRole('button', { name: 'Sunday open' }));
  await waitFor(() => assert.equal(hoursPuts().length, 1));
  // The usual hours are the shop's own (openingTime and closingTime), not the first open day's.
  assert.deepEqual(hoursPuts()[0], [{ weekday: 0, open: '08:00', close: '18:00' }, ...WEEK]);
  await waitFor(() => assert.equal(ui.getByRole('button', { name: 'Sunday open' }).getAttribute('aria-pressed'), 'true'));
});

test('a shorter Saturday saves, and closing Monday drops it', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  fireEvent.change(await ui.findByLabelText('Saturday closes'), { target: { value: '16:00' } });
  await waitFor(() => assert.equal(hoursPuts().length, 1));
  assert.deepEqual(hoursPuts()[0].find((d) => d.weekday === 6), { weekday: 6, open: '09:00', close: '16:00' });
  fireEvent.click(ui.getByRole('button', { name: 'Monday open' }));
  await waitFor(() => assert.equal(hoursPuts().length, 2));
  assert.equal(hoursPuts()[1].some((d) => d.weekday === 1), false);
});

test('a refusal says why, and the week goes back as it was', async () => {
  const { ui, fireEvent } = await openSettings();
  refuseHours = 'Closing time must be after opening time';
  fireEvent.change(await ui.findByLabelText('Friday closes'), { target: { value: '08:00' } });
  assert.ok(has(await ui.findByText('Closing time must be after opening time')));
  assert.equal(ui.getByLabelText('Friday closes').value, '17:00');
});

// Fresh review: a time the old app saved outside 05:00 to 23:00 shows as it is.
test('an early time saved by the old app shows as it is', async () => {
  const { ui } = await openSettings();
  settings.openingHours = [{ weekday: 1, open: '04:00', close: '12:00' }];
  shell.queryClient.setQueryData(['workshop-settings'], { ...settings });
  await (await import('@testing-library/react')).waitFor(() => assert.equal(ui.getByLabelText('Monday opens').value, '04:00'));
});

// Fresh review: the time pickers stay usable while a save is on its way, and
// the latest choice is the one that's saved.
test('changing a time twice quickly saves the latest, and the picker stays usable', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  const closes = await ui.findByLabelText('Saturday closes');
  fireEvent.change(closes, { target: { value: '16:00' } });
  assert.equal(closes.disabled, false);
  fireEvent.change(closes, { target: { value: '14:00' } });
  await waitFor(() => assert.equal(hoursPuts().at(-1)?.find((d) => d.weekday === 6)?.close, '14:00'));
  await waitFor(() => assert.equal(closes.value, '14:00'));
});

// Settings for the Owner only, until roles are built (Jack, 19 Oct,
// docs/decisions/2026-10-19-owner-only-settings.md; drawn as auth-noaccess).
test('someone who isn’t the Owner sees Settings aren’t part of your role, and no settings', async () => {
  const { ui } = await openSettings({ me: { ...OWNER, name: 'Jo Taylor', isOwner: false, employee: { id: 21, name: 'Jo Taylor', isCashier: true } } });
  assert.ok(has(ui.queryByText('Only the shop’s owner can change settings for now. Ask the owner if you need something changed.')));
  assert.ok(has(ui.queryByRole('link', { name: 'Go to the till' })));
  assert.ok(ui.queryByRole('switch') === null);
  assert.ok(ui.queryByLabelText('Shop name') === null);
  assert.ok(ui.queryByRole('heading', { name: 'Opening hours' }) === null);
});

// The time kept free each day (Jack, 19 Oct, docs/decisions/2026-10-19-retire-old-workshop-settings.md;
// drawn as bk-settings-reserve): in hours, saved in minutes when the box is left.
const reservePuts = () => calls.filter((c) => c.method === 'PUT' && c.body.fullDayThresholdMinutes !== undefined).map((c) => c.body);

test('Online booking shows the time kept free each day in hours, with its hint and note', async () => {
  const { ui } = await openSettings();
  assert.ok(has(await ui.findByRole('heading', { name: 'Online booking' })));
  const box = await ui.findByLabelText('Time kept free each day');
  await (await import('@testing-library/react')).waitFor(() => assert.equal(box.value, '2'));
  assert.ok(has(ui.queryByText('For the little jobs between bikes')));
  assert.ok(has(ui.queryByText('Lunch and admin go in the diary as blocks, so don’t count them here. Online booking treats a day as full once less than this is left.')));
});

test('leaving the box saves the hours as minutes, only if they changed', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  const box = await ui.findByLabelText('Time kept free each day');
  await waitFor(() => assert.equal(box.value, '2'));
  fireEvent.blur(box);
  fireEvent.change(box, { target: { value: '2.5' } });
  fireEvent.blur(box);
  await waitFor(() => assert.deepEqual(reservePuts(), [{ fullDayThresholdMinutes: 150 }]));
});

test('hours that aren’t a half hour from 0 to 8 are refused without saving', async () => {
  const { ui, fireEvent } = await openSettings();
  const box = await ui.findByLabelText('Time kept free each day');
  for (const bad of ['9', '1.2', '-1', 'two']) {
    fireEvent.change(box, { target: { value: bad } });
    fireEvent.blur(box);
    assert.ok(has(await ui.findByText('Enter 0 to 8 hours, in half hours')), bad);
  }
  assert.deepEqual(reservePuts(), []);
});

test('a server refusal of the time kept free shows its words', async () => {
  const { ui, fireEvent } = await openSettings();
  refuseHours = 'Only the shop\'s owner can change settings';
  const box = await ui.findByLabelText('Time kept free each day');
  fireEvent.change(box, { target: { value: '3' } });
  fireEvent.blur(box);
  assert.ok(has(await ui.findByText('Only the shop\'s owner can change settings')));
});

// Drop off before the booking (Jack, 19 Oct, answers 3 and 7; drawn in bk-settings-reserve):
// minutes, shown while bikes are booked in for a set time, saved when left.
const leadPuts = () => calls.filter((c) => c.method === 'PUT' && c.body.timedLeadMinutes !== undefined).map((c) => c.body);

test('Drop off before the booking shows the lead time and saves a change', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  const box = await ui.findByLabelText('Drop off before the booking');
  await waitFor(() => assert.equal(box.value, '30'));
  assert.ok(has(ui.queryByText('How long before their booked time customers bring the bike in')));
  fireEvent.change(box, { target: { value: '60' } });
  fireEvent.blur(box);
  await waitFor(() => assert.deepEqual(leadPuts(), [{ timedLeadMinutes: 60 }]));
});

test('a lead time that isn’t 0 to 240 whole minutes is refused without saving', async () => {
  const { ui, fireEvent } = await openSettings();
  const box = await ui.findByLabelText('Drop off before the booking');
  for (const bad of ['300', '12.5', '-5', 'half']) {
    fireEvent.change(box, { target: { value: bad } });
    fireEvent.blur(box);
    assert.ok(has(await ui.findByText('Enter 0 to 240 minutes')), bad);
  }
  assert.deepEqual(leadPuts(), []);
});

test('with bikes booked in for the whole day there’s no Drop off before the booking', async () => {
  const { ui } = await openSettings();
  settings.bookingMode = 'dropoff';
  shell.queryClient.setQueryData(['workshop-settings'], { ...settings });
  await (await import('@testing-library/react')).waitFor(() => assert.ok(ui.queryByLabelText('Drop off before the booking') === null));
  assert.ok(ui.queryByLabelText('Time kept free each day') !== null);
});
