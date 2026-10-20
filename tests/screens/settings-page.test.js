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
let termsFail = false;
const STANDARD_TERMS = '1. Your booking is a request.\n2. Payment is due when you collect your bike.';
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
  settings = { openingHours: WEEK, openingTime: '08:00', closingTime: '18:00', showSignOffToCustomers: false, fullDayThresholdMinutes: 120, bookingMode: 'timed', timedLeadMinutes: 30, minNoticeMinutes: 120, minNoticeDays: null, nextBookingMode: null, nextBookingModeFrom: null, dropoffWindowStart: '09:00', dropoffWindowEnd: '10:00', showPricesOnline: true, confirmationNote: 'Please bring the lock key, and tell us about any accessories.', bookingTerms: null };
  refuseHours = null;
  termsFail = false;
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
      if (refuseHours && body.nextBookingMode !== undefined) return reply(400, { error: refuseHours });
      if (refuseHours && body.showPricesOnline !== undefined) return reply(400, { error: refuseHours });
      if (refuseHours && body.confirmationNote !== undefined) return reply(400, { error: refuseHours });
      if (refuseHours && body.bookingTerms !== undefined) return reply(400, { error: refuseHours });
      settings = { ...settings, ...body };
      return reply(200, settings);
    }
    if (u.pathname === '/api/portal/north-street/terms' && termsFail) return reply(500, { error: 'Internal error' });
    if (u.pathname === '/api/portal/north-street/terms') return reply(200, { title: 'Booking terms', text: STANDARD_TERMS, standard: true });
    if (u.pathname === '/api/workshop-settings') return reply(200, settings);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom('http://localhost/workshop/settings');
  // jsdom has no <dialog> methods; the mode change pop-up opens in one.
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByRole('heading', { name: me.isOwner ? 'Workshop' : 'Settings aren’t part of your role' });
  return { ...rtl, ui };
}
const has = (q) => Boolean(q);
// Change the stub's settings by making a new object: the app's cache holds the
// one the stub returned, so changing it in place makes setQueryData a no-op.

test('Settings › Workshop › Mechanics has the switch, off, with its note', async () => {
  const { ui } = await openSettings();
  // The staff frame's header names the page, once.
  assert.equal(ui.getAllByRole('heading', { level: 1, name: 'Settings' }).length, 1);
  assert.ok(has(ui.queryByText('Services, who works in the workshop, and how the diary looks.')));
  assert.ok(has(ui.queryByRole('heading', { name: 'Mechanics' })));
  const sw = await ui.findByRole('switch', { name: 'Show who signed off to customers' });
  assert.equal(sw.getAttribute('aria-checked'), 'false');
  assert.ok(sw.textContent.includes('Off'));
  assert.ok(has(ui.queryByText('Adds “Checked by [name]” to their receipt and booking link. Off: only staff see who signed a job off.')));
});

test('switching it on saves at once, and it reads On', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  const sw = await ui.findByRole('switch', { name: 'Show who signed off to customers' });
  fireEvent.click(sw);
  await waitFor(() => assert.deepEqual(calls.filter((c) => c.method === 'PUT').map((c) => c.body), [{ showSignOffToCustomers: true }]));
  await waitFor(() => assert.equal(sw.getAttribute('aria-checked'), 'true'));
  // Its own On, not the prices switch's.
  assert.ok(sw.textContent.includes('On'));
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
  settings = { ...settings, openingHours: [{ weekday: 1, open: '04:00', close: '12:00' }] };
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
  settings = { ...settings, bookingMode: 'dropoff' };
  shell.queryClient.setQueryData(['workshop-settings'], { ...settings });
  await (await import('@testing-library/react')).waitFor(() => assert.ok(ui.queryByLabelText('Drop off before the booking') === null));
  assert.ok(ui.queryByLabelText('Time kept free each day') !== null);
});

// Notice in hours or days (Jack, 19 Oct, answers 4 and 8; drawn as bk-settings-notice-days).
const noticePuts = () => calls.filter((c) => c.method === 'PUT' && (c.body.minNoticeMinutes !== undefined || c.body.minNoticeDays !== undefined)).map((c) => c.body);
const HOURS_NOTE = 'Hours: counted from now. Days: counted in whole days, so 1 day lets a customer book any time tomorrow.';
const DAYS_NOTE = 'Days: a customer can book from that many days on, whatever the time now. 1 day lets them book any time tomorrow.';

test('Notice shows the hours, with hours chosen and its note', async () => {
  const { ui, waitFor } = await openSettings();
  const box = await ui.findByLabelText('Notice');
  await waitFor(() => assert.equal(box.value, '2'));
  assert.ok(has(ui.queryByText('How far ahead customers must book')));
  const unit = ui.getByRole('radiogroup', { name: 'Notice in' });
  assert.equal((await import('@testing-library/react')).within(unit).getByRole('radio', { name: 'hours' }).getAttribute('aria-checked'), 'true');
  assert.ok(has(ui.queryByText(HOURS_NOTE)));
});

test('a new number of hours saves as minutes, in hours', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  const box = await ui.findByLabelText('Notice');
  await waitFor(() => assert.equal(box.value, '2'));
  fireEvent.change(box, { target: { value: '3' } });
  fireEvent.blur(box);
  await waitFor(() => assert.deepEqual(noticePuts(), [{ minNoticeMinutes: 180, minNoticeDays: null }]));
});

test('choosing days saves the number as days, and the note changes', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  const box = await ui.findByLabelText('Notice');
  await waitFor(() => assert.equal(box.value, '2'));
  fireEvent.change(box, { target: { value: '1' } });
  fireEvent.click(ui.getByRole('radio', { name: 'days' }));
  await waitFor(() => assert.deepEqual(noticePuts().at(-1), { minNoticeDays: 1 }));
  assert.ok(has(await ui.findByText(DAYS_NOTE)));
  await waitFor(() => assert.equal(ui.getByRole('radio', { name: 'days' }).getAttribute('aria-checked'), 'true'));
});

test('notice out of range is refused in the screen', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  const box = await ui.findByLabelText('Notice');
  await waitFor(() => assert.equal(box.value, '2'));
  fireEvent.change(box, { target: { value: '200' } });
  fireEvent.blur(box);
  assert.ok(has(await ui.findByText('Enter 0 to 168 hours')));
  fireEvent.change(box, { target: { value: '0' } });
  fireEvent.click(ui.getByRole('radio', { name: 'days' }));
  assert.ok(has(await ui.findByText('Enter 1 to 28 days')));
  assert.deepEqual(noticePuts(), []);
});

// Fresh review: a part-hour saved before switches to days rounded up.
test('a part-hour switches to days rounded up', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  settings = { ...settings, minNoticeMinutes: 90 };
  shell.queryClient.setQueryData(['workshop-settings'], { ...settings });
  const box = await ui.findByLabelText('Notice');
  await waitFor(() => assert.equal(box.value, '1.5'));
  fireEvent.click(ui.getByRole('radio', { name: 'days' }));
  await waitFor(() => assert.deepEqual(noticePuts().at(-1), { minNoticeDays: 2 }));
});

// Switching between a set time and the whole day (Jack, 19 Oct, answers 2, 9, 10;
// drawn as bk-settings-mode-change, bk-settings-mode-scheduled, bk-settings-whole-day).
const modePuts = () => calls.filter((c) => c.method === 'PUT' && ('nextBookingMode' in c.body || 'dropoffWindowStart' in c.body)).map((c) => c.body);

test('the pills show today’s mode, with the drawn note', async () => {
  const { ui, waitFor } = await openSettings();
  const group = await ui.findByRole('radiogroup', { name: 'Bikes are booked in for' });
  const { within } = await import('@testing-library/react');
  await waitFor(() => assert.equal(within(group).getByRole('radio', { name: 'A set time' }).getAttribute('aria-checked'), 'true'));
  assert.equal(within(group).getByRole('radio', { name: 'The whole day' }).getAttribute('aria-checked'), 'false');
  assert.ok(has(ui.queryByText('A set time: the customer drops the bike off before the time they booked. The whole day: they drop it off in the drop-off window, for example 09:00 to 10:00.')));
  assert.ok(ui.queryByLabelText('Drop-off window starts') === null, 'no window while set times');
});

test('choosing the whole day asks from when; the change then shows, with the window', async () => {
  const { ui, fireEvent, waitFor, within } = await openSettings();
  fireEvent.click(await ui.findByRole('radio', { name: 'The whole day' }));
  const dlg = within(await ui.findByRole('dialog', { name: 'Book bikes in for the whole day?' }));
  assert.ok(has(dlg.queryByText('Tomorrow at the earliest')));
  assert.ok(has(dlg.queryByText('Bookings already made keep their set times. From that day, customers book a day and drop their bike off in the drop-off window.')));
  const go = dlg.getByRole('button', { name: 'Change from…' });
  assert.equal(go.disabled, true);
  fireEvent.change(dlg.getByLabelText('Starting on'), { target: { value: '2026-11-05' } });
  assert.equal(dlg.getByRole('button', { name: 'Change from Thu 5 Nov' }).disabled, false);
  fireEvent.click(dlg.getByRole('button', { name: 'Change from Thu 5 Nov' }));
  await waitFor(() => assert.deepEqual(modePuts(), [{ nextBookingMode: 'dropoff', nextBookingModeFrom: '2026-11-05' }]));
  assert.ok(has(await ui.findByText((_, el) => el?.getAttribute('data-mode-change') === 'true' && el.textContent === 'Changing to the whole day from Thu 5 Nov. Bookings already made keep their set times.')));
  assert.ok(ui.queryByRole('dialog') === null);
  // As drawn (bk-settings-mode-scheduled): the window shows once the whole day is the shop's mode.
  assert.ok(ui.queryByLabelText('Drop-off window starts') === null, 'no window until the whole day starts');
});

test('the dialog’s Cancel saves nothing', async () => {
  const { ui, fireEvent, within } = await openSettings();
  fireEvent.click(await ui.findByRole('radio', { name: 'The whole day' }));
  const dlg = within(await ui.findByRole('dialog'));
  fireEvent.click(dlg.getByRole('button', { name: 'Cancel' }));
  assert.ok(ui.queryByRole('dialog') === null);
  assert.deepEqual(modePuts(), []);
});

test('a change coming up shows, and Cancel the change clears it', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  settings = { ...settings, nextBookingMode: 'dropoff', nextBookingModeFrom: '2026-11-05' };
  shell.queryClient.setQueryData(['workshop-settings'], { ...settings });
  fireEvent.click(await ui.findByRole('button', { name: 'Cancel the change' }));
  await waitFor(() => assert.deepEqual(modePuts(), [{ nextBookingMode: null, nextBookingModeFrom: null }]));
  await waitFor(() => assert.ok(ui.queryByRole('button', { name: 'Cancel the change' }) === null));
});

test('a refused change shows its words in the dialog', async () => {
  const { ui, fireEvent, within } = await openSettings();
  refuseHours = 'A mode change must start tomorrow or later';
  fireEvent.click(await ui.findByRole('radio', { name: 'The whole day' }));
  const dlg = within(await ui.findByRole('dialog'));
  fireEvent.change(dlg.getByLabelText('Starting on'), { target: { value: '2026-11-05' } });
  fireEvent.click(dlg.getByRole('button', { name: 'Change from Thu 5 Nov' }));
  assert.ok(has(await dlg.findByText('A mode change must start tomorrow or later')));
});

test('a whole-day shop sets its drop-off window', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  settings = { ...settings, bookingMode: 'dropoff' };
  shell.queryClient.setQueryData(['workshop-settings'], { ...settings });
  const from = await ui.findByLabelText('Drop-off window starts');
  await waitFor(() => assert.equal(from.value, '09:00'));
  assert.equal(ui.getByLabelText('Drop-off window ends').value, '10:00');
  assert.ok(has(ui.queryByText('Whole-day customers drop their bike off between these times')));
  fireEvent.change(from, { target: { value: '08:30' } });
  await waitFor(() => assert.deepEqual(modePuts(), [{ dropoffWindowStart: '08:30', dropoffWindowEnd: '10:00' }]));
});

// Fresh review: a refusal doesn't stay on the page once the pop-up closes; the
// change back to a set time has its own words; changing the date of a coming
// change starts from the date already chosen.
test('a refusal clears when the pop-up is cancelled', async () => {
  const { ui, fireEvent, within } = await openSettings();
  refuseHours = 'A mode change must start tomorrow or later';
  fireEvent.click(await ui.findByRole('radio', { name: 'The whole day' }));
  const dlg = within(await ui.findByRole('dialog'));
  fireEvent.change(dlg.getByLabelText('Starting on'), { target: { value: '2026-11-05' } });
  fireEvent.click(dlg.getByRole('button', { name: 'Change from Thu 5 Nov' }));
  await dlg.findByText('A mode change must start tomorrow or later');
  fireEvent.click(dlg.getByRole('button', { name: 'Cancel' }));
  assert.ok(ui.queryByText('A mode change must start tomorrow or later') === null);
});

test('a whole-day shop changing to a set time sees its own words', async () => {
  const { ui, fireEvent, within, waitFor } = await openSettings();
  settings = { ...settings, bookingMode: 'dropoff' };
  shell.queryClient.setQueryData(['workshop-settings'], { ...settings });
  const pill = await ui.findByRole('radio', { name: 'A set time' });
  await waitFor(() => assert.equal(pill.getAttribute('aria-checked'), 'false'));
  fireEvent.click(pill);
  const dlg = within(await ui.findByRole('dialog', { name: 'Book bikes in for a set time?' }));
  assert.ok(has(dlg.queryByText('Bookings already made keep their days. From that day, customers book a time and drop their bike off before it.')));
  fireEvent.change(dlg.getByLabelText('Starting on'), { target: { value: '2026-11-05' } });
  fireEvent.click(dlg.getByRole('button', { name: 'Change from Thu 5 Nov' }));
  assert.ok(has(await ui.findByText('Changing to a set time from Thu 5 Nov. Bookings already made keep their days.')));
});

test('changing the date of a coming change starts from the date already chosen', async () => {
  const { ui, fireEvent, within } = await openSettings();
  settings = { ...settings, nextBookingMode: 'dropoff', nextBookingModeFrom: '2026-11-05' };
  shell.queryClient.setQueryData(['workshop-settings'], { ...settings });
  await ui.findByRole('button', { name: 'Cancel the change' });
  fireEvent.click(ui.getByRole('radio', { name: 'The whole day' }));
  const dlg = within(await ui.findByRole('dialog'));
  assert.equal(dlg.getByLabelText('Starting on').value, '2026-11-05');
});

// Show prices on the booking page (Jack, 19 Oct, answer 11; drawn in bk-settings).
test('Show prices on the booking page shows its value and saves a switch at once', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  const sw = await ui.findByRole('switch', { name: 'Show prices on the booking page' });
  await waitFor(() => assert.equal(sw.getAttribute('aria-checked'), 'true'));
  fireEvent.click(sw);
  await waitFor(() => assert.deepEqual(calls.filter((c) => c.method === 'PUT' && 'showPricesOnline' in c.body).map((c) => c.body), [{ showPricesOnline: false }]));
  await waitFor(() => assert.equal(sw.getAttribute('aria-checked'), 'false'));
});

test('a refused prices switch says why and stays as it was', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  refuseHours = "Only the shop's owner can change settings";
  const sw = await ui.findByRole('switch', { name: 'Show prices on the booking page' });
  await waitFor(() => assert.equal(sw.getAttribute('aria-checked'), 'true'));
  fireEvent.click(sw);
  assert.ok(has(await ui.findByText("Only the shop's owner can change settings")));
  assert.equal(sw.getAttribute('aria-checked'), 'true');
});

// The additional note on the confirmation (Jack, 19 Oct, docs/decisions/2026-10-19-confirmation-note.md;
// drawn in bk-settings): the shop's own words, saved when the box is left.
const notePuts = () => calls.filter((c) => c.method === 'PUT' && c.body.confirmationNote !== undefined).map((c) => c.body);
const NOTE_HINT = 'Shown after the drop-off time once a booking is confirmed. Leave it empty to show nothing.';

test('Additional note on the confirmation shows the shop’s note, with its hint', async () => {
  const { ui, waitFor } = await openSettings();
  const box = await ui.findByLabelText('Additional note on the confirmation');
  await waitFor(() => assert.equal(box.value, 'Please bring the lock key, and tell us about any accessories.'));
  assert.ok(has(ui.queryByText(NOTE_HINT)));
  assert.equal(box.getAttribute('maxlength'), '300');
});

test('the note saves when the box is left, only if it changed, and can be emptied', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  const box = await ui.findByLabelText('Additional note on the confirmation');
  await waitFor(() => assert.ok(box.value.length > 0));
  fireEvent.blur(box);
  fireEvent.change(box, { target: { value: '  Please bring the lock key, and tell us about any accessories.  ' } });
  fireEvent.blur(box);
  await waitFor(() => assert.equal(box.value, 'Please bring the lock key, and tell us about any accessories.'));
  fireEvent.change(box, { target: { value: 'Park round the back and ring the bell.' } });
  fireEvent.blur(box);
  await waitFor(() => assert.deepEqual(notePuts(), [{ confirmationNote: 'Park round the back and ring the bell.' }]));
  assert.ok(has(await ui.findByText('Saved.')));
  fireEvent.change(box, { target: { value: '' } });
  fireEvent.blur(box);
  await waitFor(() => assert.deepEqual(notePuts().at(-1), { confirmationNote: '' }));
});

test('a refused note says why and keeps what was typed', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  const box = await ui.findByLabelText('Additional note on the confirmation');
  await waitFor(() => assert.ok(box.value.length > 0));
  refuseHours = 'Only the shop’s owner can change settings';
  fireEvent.change(box, { target: { value: 'Ring the bell.' } });
  fireEvent.blur(box);
  assert.ok(has(await ui.findByText('Only the shop’s owner can change settings')));
  assert.equal(box.value, 'Ring the bell.');
});

// Preview what the customer sees (Jack, 19 Oct, docs/decisions/2026-10-19-booking-preview.md;
// drawn as bk-settings-preview): a pop-up of the confirmed page with the shop's saved settings.
test('Preview opens What the customer sees, with the shop’s saved note and prices, and Close closes it', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  settings = { ...settings, confirmationNote: 'Park round the back and ring the bell.', showPricesOnline: false };
  shell.queryClient.setQueryData(['workshop-settings'], { ...settings });
  fireEvent.click(await ui.findByRole('button', { name: 'Preview' }));
  const dialog = await ui.findByRole('dialog', { name: 'What the customer sees' });
  const { within } = await import('@testing-library/react');
  const box = within(dialog);
  assert.ok(has(box.queryByText('An example booking, with your settings as they are now')));
  assert.equal(dialog.getAttribute('aria-describedby'), 'preview-sub');
  assert.ok(has(box.queryByText('Booking confirmed')));
  assert.ok(has(box.queryByText('See you on Thursday 17 September, Maya')));
  assert.ok(has(box.queryByText('Drop your Trek Domane AL 3 off by 11:00, half an hour before your booking at 11:30. Park round the back and ring the bell.')));
  assert.ok(has(box.queryByText('Standard service')));
  assert.ok(box.queryByText(/£65/) === null);
  assert.ok(has(box.queryByText('Customers see this once a booking is confirmed. Change a setting and preview again to see the difference.')));
  // The header's ✕ and the footer's Close, as drawn; the footer's is the last.
  const closes = box.getAllByRole('button', { name: 'Close' });
  assert.equal(closes.length, 2);
  fireEvent.click(closes[1]);
  await waitFor(() => assert.ok(ui.queryByRole('dialog', { name: 'What the customer sees' }) === null));
});

// A shop's own booking terms (Jack, 8 Oct, not-drawn pages row 95; 20 Oct;
// drawn as bk-settings' Terms row): Use your own starts from the standard terms.
const termsPuts = () => calls.filter((c) => c.method === 'PUT' && c.body.bookingTerms !== undefined).map((c) => c.body);

test('the standard terms: the row says so, with Use your own', async () => {
  const { ui } = await openSettings();
  assert.ok(await ui.findByText('Wheelhouse’s standard terms · a copy is kept with each booking'));
  assert.ok(ui.getByRole('button', { name: 'Use your own' }));
  assert.ok(ui.queryByLabelText('Your booking terms') === null);
});

test('Use your own opens the box with the standard terms; leaving it unchanged saves nothing', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  fireEvent.click(await ui.findByRole('button', { name: 'Use your own' }));
  const box = await ui.findByLabelText('Your booking terms');
  await waitFor(() => assert.equal(box.value, STANDARD_TERMS));
  assert.ok(ui.queryByText('Customers agree to these when they book. A copy is kept with each booking.') !== null);
  fireEvent.blur(box);
  // Typed back to the same words (spaces aside) is unchanged too.
  fireEvent.change(box, { target: { value: `${STANDARD_TERMS}  ` } });
  fireEvent.blur(box);
  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(termsPuts(), []);
});

test('changed words save when the box is left, and the row then says they’re the shop’s own', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  fireEvent.click(await ui.findByRole('button', { name: 'Use your own' }));
  const box = await ui.findByLabelText('Your booking terms');
  await waitFor(() => assert.equal(box.value, STANDARD_TERMS));
  fireEvent.change(box, { target: { value: 'Our own terms.' } });
  fireEvent.blur(box);
  await waitFor(() => assert.deepEqual(termsPuts(), [{ bookingTerms: 'Our own terms.' }]));
  assert.ok(await ui.findByText('Your own terms · a copy is kept with each booking'));
});

test('own terms show in the box; Go back to Wheelhouse’s standard terms saves null', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  settings = { ...settings, bookingTerms: 'Our own terms.' };
  shell.queryClient.setQueryData(['workshop-settings'], { ...settings });
  const box = await ui.findByLabelText('Your booking terms');
  assert.equal(box.value, 'Our own terms.');
  fireEvent.click(ui.getByRole('button', { name: 'Go back to Wheelhouse’s standard terms' }));
  await waitFor(() => assert.deepEqual(termsPuts(), [{ bookingTerms: null }]));
  assert.ok(await ui.findByRole('button', { name: 'Use your own' }));
});

test('a refused save shows its words and keeps what was typed', async () => {
  const { ui, fireEvent } = await openSettings();
  fireEvent.click(await ui.findByRole('button', { name: 'Use your own' }));
  const box = await ui.findByLabelText('Your booking terms');
  refuseHours = 'Booking terms can be up to 20,000 characters';
  fireEvent.change(box, { target: { value: 'Too long, say.' } });
  fireEvent.blur(box);
  assert.ok(await ui.findByText('Booking terms can be up to 20,000 characters'));
  assert.equal(box.value, 'Too long, say.');
});

test('Use your own puts the cursor in the box once it has the words', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  fireEvent.click(await ui.findByRole('button', { name: 'Use your own' }));
  const box = await ui.findByLabelText('Your booking terms');
  await waitFor(() => assert.ok(document.activeElement === box));
});

test('if the standard terms can’t be loaded, it says so', async () => {
  const { ui, fireEvent } = await openSettings();
  termsFail = true;
  shell.queryClient.setDefaultOptions({ queries: { retry: false } });
  fireEvent.click(await ui.findByRole('button', { name: 'Use your own' }));
  assert.ok(await ui.findByText('Wheelhouse couldn’t load the standard terms to start from. Try again in a moment.'));
});
