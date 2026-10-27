// The Settings frame (WP-1.3; drawn in settings-frame.mjs, Owner setup
// decisions 3, 17 and 21): rooms down the left, each room's areas with Jump
// to, folds with a one-line summary; on a phone, the list of rooms first.
// Only what works is shown (stage 1 drawing gaps decision 6).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const WEEK = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, open: '09:00', close: '17:00' }));
const SETTINGS = { openingHours: WEEK, openingTime: '09:00', closingTime: '17:00', showSignOffToCustomers: false, fullDayThresholdMinutes: 120, bookingMode: 'timed', timedLeadMinutes: 30, minNoticeMinutes: 120, minNoticeDays: null, nextBookingMode: null, nextBookingModeFrom: null, dropoffWindowStart: '09:00', dropoffWindowEnd: '10:00', showPricesOnline: true, confirmationNote: null, bookingTerms: null };
const DETAILS = { name: 'North Street Cycles', address: null, phone: null, email: null, vatNumber: null, receiptFooter: null };
const TEMPLATE = (key, name, enabled = true, group = null) => ({ key, name, when: 'When', enabled, wording: 'Hi', subject: 'S', changed: false, tapIns: [], live: true, group });
const TEMPLATES = [TEMPLATE('quote_to_approve', 'Quote to approve'), TEMPLATE('bike_ready', 'Bike ready', false), TEMPLATE('booking_confirmed', 'Booking confirmed', true, 'booking')];

const realFetch = globalThis.fetch;
let uninstall;
let shell;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

async function openSettings(path = '/workshop/settings') {
  globalThis.fetch = async (url) => {
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/workshop-settings') return reply(200, SETTINGS);
    if (u.pathname === '/api/shop-details') return reply(200, DETAILS);
    if (u.pathname === '/api/message-templates') return reply(200, TEMPLATES);
    if (u.pathname === '/api/portal/north-street/terms') return reply(200, { title: 'Booking terms', text: 'Terms', standard: true });
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom(`http://localhost${path}`);
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByRole('navigation', { name: 'Settings' });
  return { ...rtl, ui };
}
const fold = (ui, name) => ui.getByRole('button', { name: new RegExp(`^${name}`) });
// A fold's summary, once its data has loaded.
async function summary(t, name, words) {
  await t.waitFor(() => assert.ok(fold(t.ui, name).textContent.includes(words), fold(t.ui, name).textContent));
}

test('the rooms down the left, built ones only; a computer opens on Front desk', async () => {
  const { ui, within } = await openSettings();
  const nav = within(ui.getByRole('navigation', { name: 'Settings' }));
  assert.deepEqual(nav.getAllByRole('link').map((a) => a.textContent), ['Front desk', 'Workshop', 'Office']);
  assert.equal(nav.getByRole('link', { name: 'Front desk' }).getAttribute('aria-current'), 'page');
  assert.ok(ui.getByRole('heading', { level: 2, name: 'Front desk' }));
  assert.ok(ui.getByText('The till, payments, messages to customers and closing the day.'));
});

test('a room with more than one area has Jump to, and each area its own heading and folds', async () => {
  const t = await openSettings('/workshop/settings?room=front-desk');
  const { ui, within } = t;
  const jump = within(ui.getByRole('navigation', { name: 'Jump to' }));
  assert.deepEqual(jump.getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')]), [['Till', '#set-till'], ['Payments', '#set-payments'], ['Messages', '#set-messages'], ['End of day', '#set-end-of-day']]);
  assert.ok(ui.getByRole('heading', { level: 3, name: 'Till' }));
  assert.ok(ui.getByRole('heading', { level: 4, name: /^Receipts/ }));
  // The first fold is open, the next closed, each with its summary.
  assert.equal(fold(ui, 'Receipts').getAttribute('aria-expanded'), 'true');
  assert.equal(fold(ui, 'Automatic messages').getAttribute('aria-expanded'), 'false');
  await summary(t, 'Automatic messages', '2 on');
  await summary(t, 'Receipts', 'Nothing at the bottom yet');
});

test('a fold opens and closes on its own', async () => {
  const { ui, fireEvent } = await openSettings('/workshop/settings?room=front-desk');
  fireEvent.click(fold(ui, 'Automatic messages'));
  assert.equal(fold(ui, 'Automatic messages').getAttribute('aria-expanded'), 'true');
  assert.equal(fold(ui, 'Receipts').getAttribute('aria-expanded'), 'true', 'the other stays open');
  assert.ok(await ui.findByText('Quote to approve'));
  fireEvent.click(fold(ui, 'Receipts'));
  assert.equal(fold(ui, 'Receipts').getAttribute('aria-expanded'), 'false');
});

test('a room with one area shows that area’s words, no Jump to, and its folds as h3', async () => {
  const t = await openSettings('/workshop/settings?room=office');
  const { ui } = t;
  assert.ok(ui.getByRole('heading', { level: 2, name: 'Office' }));
  assert.ok(ui.getByText('The shop’s details, its sites and their opening hours.'));
  assert.ok(ui.queryByRole('navigation', { name: 'Jump to' }) === null);
  assert.ok(ui.getByRole('heading', { level: 3, name: /^Shop details/ }));
  await summary(t, 'Shop details', 'North Street Cycles');
  await summary(t, 'Opening hours', 'Closed Sundays');
});

test('Workshop: Online booking and Mechanics, each summed up', async () => {
  const t = await openSettings('/workshop/settings?room=workshop');
  await summary(t, 'Online booking', 'Set times · 2 hours’ notice');
  await summary(t, 'Mechanics', 'Who signed off: staff only');
});

test('on a phone, Settings opens on the rooms, each with what’s in it; a room has ‹ Settings back', async () => {
  const first = await openSettings();
  const list = first.within(first.ui.getByRole('navigation', { name: 'Settings rooms' }));
  assert.deepEqual(list.getAllByRole('link').map((a) => a.textContent), ['Front deskTill, payments, messages, end of day', 'WorkshopServices, checklists, online booking, mechanics, diary blocks, storage slots, collection', 'OfficeShop details, opening hours']);
  first.cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  const room = await openSettings('/workshop/settings?room=office');
  assert.ok(room.ui.queryByRole('navigation', { name: 'Settings rooms' }) === null);
  // "‹ Settings", its arrow hidden from screen readers.
  const back = room.ui.getAllByRole('link', { name: 'Settings' }).find((a) => a.textContent === '‹\u00a0Settings');
  assert.ok(back, 'the back link');
  assert.equal(back.getAttribute('href'), '/workshop/settings');
});
