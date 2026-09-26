// The details screen: the guard, the summary, the contact fields and the
// default update channel, each message, the email label, and the terms
// dialog. Sending is tested in the second half of this file (Task 4).
// Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderBookScreen, PRIVATE_LINK } from '../helpers/book-screen.js';

let current;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current?.client.clear();
  current?.uninstall();
  current = undefined;
});

const choiceQ = (id, wording, choices) => ({ id, wording, kind: 'choice', required: true, choices, allowNotSure: true });
const SERVICES = {
  shopName: 'North Street Cycles', showPrices: true, full: [], categories: [],
  uncategorised: [
    { id: 11, name: 'Brake service', price: 20, minutes: 30, questions: [choiceQ('b1', "What's wrong with the brakes?", ['Squeaking', 'Not stopping well'])] },
    { id: 12, name: 'Gear service', price: 25, minutes: 45, questions: [] },
  ],
};
const MECHANICS = {
  mechanics: [{ id: 1, name: 'Alex', workingDays: [1, 2, 3, 4, 5] }, { id: 2, name: 'Jo', workingDays: [1, 2, 3, 4, 5] }],
  openingTime: '09:00', closingTime: '17:00', openingDays: [1, 2, 3, 4, 5],
};
const AVAILABILITY = {
  busy: [], fullDays: [],
  days: [{ date: '2026-10-06', mode: 'dropoff', dropoffWindow: { start: '08:30', end: '10:00' }, mechanics: [{ mechanicId: 2, bookable: true }] }],
};
const TIMED = {
  serviceIds: [11, 12], answers: [{ serviceId: 11, questionId: 'b1', choice: 'Squeaking' }], bikeNote: 'Blue Trek road bike',
  date: '2026-10-05', mechanicId: 1, startTime: '09:30',
};
const DROPOFF = {
  notSure: true, serviceIds: [], answers: [], description: 'Clicks when pedalling', date: '2026-10-06', mechanicId: 2, anyMechanic: true,
};
const CONTACT = { name: 'Gina Guest', phone: '07700 900123' };
const CHECK = 'Please check the answers marked above';

const open = async ({ draft = TIMED, ...rest } = {}) => {
  current = await renderBookScreen({
    file: 'screens/book/details.js', exportName: 'DetailsScreen', at: 'details', url: '/book/north/details',
    services: SERVICES, mechanics: MECHANICS, availability: AVAILABILITY, draft, ...rest,
  });
  await current.ui.findByRole('heading', { level: 1, name: 'How can we reach you?' });
  return current;
};
const rtl = () => import('@testing-library/react');
const click = async (el) => (await rtl()).fireEvent.click(el);
const type = async (el, value) => (await rtl()).fireEvent.change(el, { target: { value } });
const pinned = () => document.querySelector('[data-book-pinned]');
const describedText = (el) => document.getElementById(el.getAttribute('aria-describedby') ?? '')?.textContent ?? null;
const press = async (ui) => click(ui.getByRole('button', { name: 'Request booking' }));
const posts = (requests) => requests.filter((r) => r.method === 'POST');

test('step 4, the heading, and Back goes to the date screen', async () => {
  const { ui } = await open();
  assert.ok(ui.getByText('Step 4 of 4'));
  await click(ui.getByRole('link', { name: /Back/ }));
  assert.ok(await ui.findByText('At /book/north/date'));
});

test('without a day and a mechanic it goes back to the date screen', async () => {
  current = await renderBookScreen({
    file: 'screens/book/details.js', exportName: 'DetailsScreen', at: 'details', url: '/book/north/details',
    services: SERVICES, mechanics: MECHANICS, draft: { serviceIds: [12] },
  });
  assert.ok(await current.ui.findByText('At /book/north/date'));
});

test('the summary: services, day, time and mechanic, the price, and the bike note', async () => {
  const { ui } = await open();
  assert.ok(await ui.findByText('Monday 5 October, 09:30 with Alex'));
  assert.ok(ui.getByText('Brake service, Gear service'));
  assert.ok(ui.getByText('From £45'));
  assert.ok(ui.getByText('Blue Trek road bike'));
});

test("Not sure on a drop-off day: \"Not sure\", that day's drop-off window, and no price", async () => {
  const { ui, requests } = await open({ draft: DROPOFF });
  assert.ok(await ui.findByText('Tuesday 6 October, drop off 08:30–10:00'));
  assert.ok(ui.getByText('Not sure'));
  assert.equal(ui.queryByText(/^From £/), null);
  assert.ok(requests.some((r) => r.url === '/api/portal/north/availability?start=2026-10-06&end=2026-10-06&minutes=60'), JSON.stringify(requests));
});

test('the fields start empty with Text message chosen, and typing saves to the draft', async () => {
  const { ui, readDraft } = await open();
  const name = ui.getByRole('textbox', { name: 'Your name' });
  const phone = ui.getByRole('textbox', { name: 'Mobile number' });
  assert.equal(name.value, '');
  assert.equal(phone.value, '');
  assert.equal(phone.getAttribute('type'), 'tel');
  const { within } = await rtl();
  const radios = within(ui.getByRole('group', { name: 'How should we send updates?' })).getAllByRole('radio');
  assert.deepEqual(radios.map((r) => [r.closest('label').textContent, r.checked]), [['Text message', true], ['WhatsApp', false], ['Email', false]]);
  assert.equal(ui.getByRole('checkbox', { name: 'I agree to the booking terms' }).checked, false);
  await type(name, 'Gina Guest');
  await type(phone, '07700 900123');
  await click(ui.getByRole('radio', { name: 'WhatsApp' }));
  await click(ui.getByRole('checkbox', { name: 'I agree to the booking terms' }));
  const saved = readDraft();
  assert.deepEqual([saved.name, saved.phone, saved.updateChannel, saved.termsAccepted], ['Gina Guest', '07700 900123', 'whatsapp', true]);
});

test('the email is optional until Email is chosen', async () => {
  const { ui, readDraft } = await open();
  assert.equal(ui.getByRole('textbox', { name: 'Email (optional)' }).getAttribute('aria-required'), null);
  await click(ui.getByRole('radio', { name: 'Email' }));
  assert.equal(readDraft().updateChannel, 'email');
  assert.equal(ui.getByRole('textbox', { name: 'Email' }).getAttribute('aria-required'), 'true');
  assert.equal(ui.queryByRole('textbox', { name: 'Email (optional)' }), null);
});

test('Request booking with nothing filled in: each message under its field, a note in the pinned area, focus on the name, nothing sent', async () => {
  const { ui, requests } = await open();
  await press(ui);
  const name = ui.getByRole('textbox', { name: 'Your name' });
  assert.equal(describedText(name), 'Please enter your name');
  assert.equal(name.getAttribute('aria-invalid'), 'true');
  assert.equal(describedText(ui.getByRole('textbox', { name: 'Mobile number' })), 'Please enter your mobile number');
  assert.equal(describedText(ui.getByRole('textbox', { name: 'Email (optional)' })), null, 'no email needed for text messages');
  assert.equal(describedText(ui.getByRole('checkbox', { name: 'I agree to the booking terms' })), 'Please accept the booking terms');
  const { within } = await rtl();
  assert.equal(within(pinned()).getByRole('alert').textContent, CHECK);
  assert.ok(document.activeElement === name, 'focus is not on the name');
  assert.equal(posts(requests).length, 0);
  assert.equal(ui.queryByText(/^At /), null);
});

test('the first problem gets the focus', async () => {
  const { ui } = await open({ draft: { ...TIMED, name: 'Gina Guest' } });
  await press(ui);
  assert.ok(document.activeElement === ui.getByRole('textbox', { name: 'Mobile number' }));
});

test('an email that is not an email address, or none when Email is chosen, is refused', async () => {
  const { ui } = await open({ draft: { ...TIMED, ...CONTACT, termsAccepted: true, email: 'gina@' } });
  await press(ui);
  assert.equal(describedText(ui.getByRole('textbox', { name: 'Email (optional)' })), 'Please enter a valid email address');
  assert.ok(document.activeElement === ui.getByRole('textbox', { name: 'Email (optional)' }));
  await type(ui.getByRole('textbox', { name: 'Email (optional)' }), '');
  await click(ui.getByRole('radio', { name: 'Email' }));
  assert.equal(describedText(ui.getByRole('textbox', { name: 'Email' })), 'Please enter a valid email address');
  await type(ui.getByRole('textbox', { name: 'Email' }), 'gina@example.com');
  assert.equal(describedText(ui.getByRole('textbox', { name: 'Email' })), null);
});

test('each message goes as soon as its field is fixed, and the pinned note with the last', async () => {
  const { ui } = await open();
  await press(ui);
  await type(ui.getByRole('textbox', { name: 'Your name' }), 'Gina Guest');
  assert.equal(ui.queryByText('Please enter your name'), null);
  await type(ui.getByRole('textbox', { name: 'Mobile number' }), '07700 900123');
  await click(ui.getByRole('checkbox', { name: 'I agree to the booking terms' }));
  assert.equal(ui.queryByText('Please accept the booking terms'), null);
  assert.equal(ui.queryByText(CHECK), null);
});

test('"booking terms" opens the terms in a dialog on the same screen, without ticking the box', async () => {
  const { ui, requests } = await open();
  assert.equal(requests.some((r) => r.url.endsWith('/terms')), false, 'the terms are fetched before they are opened');
  await click(ui.getByRole('button', { name: 'booking terms' }));
  const dialog = await ui.findByRole('dialog', { name: 'Booking terms' });
  const { within } = await rtl();
  assert.ok(await within(dialog).findByText('1. Your booking is a request.'));
  assert.equal(ui.getByRole('checkbox', { name: 'I agree to the booking terms' }).checked, false);
  assert.ok(requests.some((r) => r.url === '/api/portal/north/terms'), JSON.stringify(requests));
  await click(within(dialog).getByRole('button', { name: 'Close' }));
  assert.equal(ui.queryByRole('dialog'), null);
  assert.ok(ui.getByRole('heading', { level: 1, name: 'How can we reach you?' }));
});

test('if the terms fail to load, the dialog says so and Try again asks again', async () => {
  let calls = 0;
  const terms = () => (++calls === 1
    ? { status: 500, body: { error: 'Something went wrong' } }
    : { status: 200, body: { title: 'Booking terms', text: '1. Your booking is a request.', standard: true } });
  const { ui } = await open({ terms });
  await click(ui.getByRole('button', { name: 'booking terms' }));
  assert.ok(await ui.findByText("We couldn't load the booking terms"));
  await click(ui.getByRole('button', { name: 'Try again' }));
  assert.ok(await ui.findByText('1. Your booking is a request.'));
  assert.equal(calls, 2);
});
