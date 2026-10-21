// Settings › Messages (the messages engine, Jack 20 Oct; drawn as set-msg-list
// and set-msg-edit, the booking messages' editor in book.mjs): the messages
// that send today, each with when it goes, "Customer’s choice", On or Off and
// Edit; Edit opens the wording with its tap-ins, a text and an email preview,
// Go back to Wheelhouse’s wording and Done.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const READY_WORDS = 'Hi [Customer’s first name], your [Bike] is ready to collect from [Shop name]. [Amount to pay] to pay on collection. See what we did: [Link to the job]. Job [Job number]. We’re open [Opening hours].';
const READY_TAPS = ['Customer’s first name', 'Bike', 'Job number', 'Amount to pay', 'Link to the job', 'Shop name', 'Opening hours'];
const template = (over) => ({
  key: 'bike_ready', name: 'Bike ready', when: 'When a job is marked ready', enabled: true, wording: READY_WORDS,
  subject: 'Your bike is ready — [Shop name]', changed: false, tapIns: READY_TAPS, live: true, ...over,
});
const TEMPLATES = () => [
  template({ key: 'quote_to_approve', name: 'Quote to approve', when: 'When a job needs the customer’s OK', wording: 'Hi [Customer’s first name], a quote. [Link to the quote]', tapIns: ['Customer’s first name', 'Link to the quote'] }),
  template({}),
  template({ key: 'booking_confirmed', name: 'Booking confirmed', when: 'When a booking is accepted, or confirmed straight away', group: 'booking' }),
  template({ key: 'booking_cancelled', name: 'Booking cancelled', when: 'When a booking is cancelled', group: 'booking', live: false }),
];
const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let templates;
let failPut;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

// The preview the server fills in: the drawings' example.
const fill = (words) => words.replace('[Customer’s first name]', 'Maya').replace('[Bike]', 'Trek Domane AL 3').replace('[Shop name]', 'North Street Cycles');

async function openSettings() {
  calls = [];
  templates = TEMPLATES();
  failPut = false;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [], bookingMode: 'day', showPricesOnline: true, confirmationNote: null, bookingTerms: null, fullDayThresholdMinutes: 0, minNoticeMinutes: 0, minNoticeDays: null });
    if (u.pathname === '/api/shop-details') return reply(200, { name: 'North Street Cycles' });
    if (u.pathname === '/api/message-templates') return reply(200, templates);
    const put = u.pathname.match(/^\/api\/message-templates\/(\w+)$/);
    if (put && method === 'PUT') {
      if (failPut) return reply(500, { error: 'Internal error' });
      templates = templates.map((t) => (t.key === put[1] ? {
        ...t, ...('enabled' in body ? { enabled: body.enabled } : {}),
        ...('wording' in body ? { wording: body.wording ?? READY_WORDS, changed: body.wording !== null } : {}),
      } : t));
      return reply(200, templates.find((t) => t.key === put[1]));
    }
    const preview = u.pathname.match(/^\/api\/message-templates\/(\w+)\/preview$/);
    if (preview) {
      const words = body.wording ?? templates.find((t) => t.key === preview[1]).wording;
      return reply(200, { text: fill(words), email: { subject: 'Your bike is ready — North Street Cycles', body: fill(words) } });
    }
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom('http://localhost/workshop/settings?room=front-desk');
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  // Front desk › Messages › Automatic messages, a fold (Settings frame, WP-1.3).
  await ui.findByRole('heading', { name: 'Messages' });
  rtl.fireEvent.click(ui.getByRole('button', { name: /^Automatic messages/ }));
  return { ...rtl, ui };
}
const has = (q) => Boolean(q);
const puts = () => calls.filter((c) => c.method === 'PUT').map((c) => `${c.url} ${JSON.stringify(c.body)}`);

test('Messages lists the messages that send today, each with when, the customer’s choice, On and Edit', async () => {
  const { ui } = await openSettings();
  assert.ok(has(ui.queryByText('The texts and emails customers get from the shop.')));
  const list = await ui.findByText((_, el) => el?.getAttribute('data-msg-list') === 'true');
  assert.ok(list !== null);
  await ui.findByText('Bike ready');
  assert.ok(list.textContent.includes('Bike ready'));
  assert.ok(has(ui.queryByText('When a job is marked ready')));
  assert.ok(has(ui.queryByText('Quote to approve')));
  // A message the server marks as not sent (this fixture's Booking cancelled) isn't listed.
  assert.equal(list.textContent.includes('Booking cancelled'), false, 'a message not sent is not listed');
  // The booking messages under their own heading, as drawn (msgListOpen).
  const heading = list.querySelector('h5');
  assert.ok(heading !== null && heading.textContent === 'Booking messages');
  assert.ok(list.textContent.includes('Sent the way each customer chose when booking: text, WhatsApp or email.'));
  const inList = (t) => [...list.querySelectorAll('span')].find((el) => el.textContent === t);
  assert.ok(heading.compareDocumentPosition(inList('Booking confirmed')) & 4, 'Booking confirmed under it');
  assert.ok(inList('Bike ready').compareDocumentPosition(heading) & 4, 'job messages first');
  assert.equal(ui.getAllByText('Customer’s choice').length, 3);
  assert.ok(has(ui.queryByRole('button', { name: 'Bike ready: On' })));
  assert.ok(has(ui.queryByRole('button', { name: 'Edit the wording of Bike ready' })));
});

test('On switches a message off, saved at once', async () => {
  const { ui, fireEvent, waitFor } = await openSettings();
  fireEvent.click(await ui.findByRole('button', { name: 'Bike ready: On' }));
  await waitFor(() => assert.deepEqual(puts(), ['/api/message-templates/bike_ready {"enabled":false}']));
  assert.ok(has(await ui.findByRole('button', { name: 'Bike ready: Off' })));
});

test('a switch that can’t be saved says so and stays as it was', async () => {
  const { ui, fireEvent } = await openSettings();
  failPut = true;
  fireEvent.click(await ui.findByRole('button', { name: 'Bike ready: On' }));
  assert.ok(has(await ui.findByText('Wheelhouse couldn’t save that. Try again in a moment.')));
  assert.ok(has(ui.queryByRole('button', { name: 'Bike ready: On' })));
});

async function openEdit() {
  const t = await openSettings();
  t.fireEvent.click(await t.ui.findByRole('button', { name: 'Edit the wording of Bike ready' }));
  const dlg = t.within(await t.ui.findByRole('dialog', { name: 'Bike ready' }));
  return { ...t, dlg };
}

test('Edit shows the wording, what it can put in, and the text and email previews', async () => {
  const { dlg } = await openEdit();
  assert.ok(has(dlg.queryByText('Sent when a job is marked ready')));
  assert.ok(has(dlg.queryByText('Sent the way each customer chose: text, WhatsApp or email.')));
  assert.equal(dlg.getByLabelText('Wording').value, READY_WORDS);
  const putIn = dlg.getByRole('group', { name: 'Put in' });
  assert.deepEqual([...putIn.querySelectorAll('button')].map((b) => b.textContent), READY_TAPS.map((t) => `+ ${t}`));
  assert.ok(has(dlg.queryByText('PREVIEW · TEXT TO MAYA PATEL')));
  assert.ok(has(dlg.queryByText('PREVIEW · EMAIL TO MAYA PATEL')));
  assert.ok(has(await dlg.findAllByText(fill(READY_WORDS))));
  assert.ok(has(dlg.queryByText('Your bike is ready — North Street Cycles')));
});

test('typing changes the preview; a tap-in goes in where the cursor is', async () => {
  const { dlg, fireEvent, waitFor } = await openEdit();
  const box = dlg.getByLabelText('Wording');
  fireEvent.change(box, { target: { value: 'Hi , ready.' } });
  box.setSelectionRange(3, 3);
  fireEvent.click(dlg.getByRole('button', { name: '+ Customer’s first name' }));
  assert.equal(box.value, 'Hi [Customer’s first name], ready.');
  await waitFor(() => assert.equal(dlg.getAllByText('Hi Maya, ready.').length, 2));
});

test('Done saves the wording; Go back to Wheelhouse’s wording saves none', async () => {
  const { ui, dlg, fireEvent, waitFor, within } = await openEdit();
  fireEvent.change(dlg.getByLabelText('Wording'), { target: { value: 'Ready: [Bike]' } });
  fireEvent.click(dlg.getByRole('button', { name: 'Done' }));
  await waitFor(() => assert.deepEqual(puts(), ['/api/message-templates/bike_ready {"wording":"Ready: [Bike]"}']));
  await waitFor(() => assert.equal(has(ui.queryByRole('dialog', { name: 'Bike ready' })), false));
  fireEvent.click(ui.getByRole('button', { name: 'Edit the wording of Bike ready' }));
  const again = within(await ui.findByRole('dialog', { name: 'Bike ready' }));
  assert.equal(again.getByLabelText('Wording').value, 'Ready: [Bike]');
  fireEvent.click(again.getByRole('button', { name: 'Go back to Wheelhouse’s wording' }));
  await waitFor(() => assert.equal(puts().at(-1), '/api/message-templates/bike_ready {"wording":null}'));
  await waitFor(() => assert.equal(again.getByLabelText('Wording').value, READY_WORDS));
});

test('Done with nothing changed saves nothing', async () => {
  const { ui, dlg, fireEvent, waitFor } = await openEdit();
  fireEvent.click(dlg.getByRole('button', { name: 'Done' }));
  await waitFor(() => assert.equal(has(ui.queryByRole('dialog', { name: 'Bike ready' })), false));
  assert.deepEqual(puts(), []);
});

test('a save that fails inside the edit box says so there, and the box stays open', async () => {
  const { ui, dlg, fireEvent } = await openEdit();
  failPut = true;
  fireEvent.change(dlg.getByLabelText('Wording'), { target: { value: 'Ready: [Bike]' } });
  fireEvent.click(dlg.getByRole('button', { name: 'Done' }));
  assert.ok(has(await dlg.findByText('Wheelhouse couldn’t save that. Try again in a moment.')));
  assert.ok(has(ui.queryByRole('dialog', { name: 'Bike ready' })));
});

test('after Done, focus goes back to the row’s Edit', async () => {
  const { ui, dlg, fireEvent, waitFor } = await openEdit();
  fireEvent.click(dlg.getByRole('button', { name: 'Done' }));
  await waitFor(() => assert.equal(document.activeElement?.getAttribute('aria-label'), 'Edit the wording of Bike ready'));
  assert.equal(has(ui.queryByRole('dialog', { name: 'Bike ready' })), false);
});

test('the edit box says how [Shop name] fills in, as drawn, and keeps the wording to 2,000 characters', async () => {
  const { dlg } = await openEdit();
  assert.ok(has(dlg.queryByText('Sent when a job is marked ready')));
  assert.ok(has(dlg.queryByText('With more than one shop, [Shop name] fills in as the business and the shop, like “North Street Cycles, Bolton”.')));
  assert.equal(dlg.getByLabelText('Wording').getAttribute('maxlength'), '2000');
});
