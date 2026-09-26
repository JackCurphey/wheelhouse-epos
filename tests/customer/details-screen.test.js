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
  assert.ok(ui.queryByText(/^From £/) === null);
  assert.ok(requests.some((r) => r.url === '/api/portal/north/availability?start=2026-10-06&end=2026-10-06&minutes=60'), JSON.stringify(requests));
});

test('the fields start empty with Text message chosen, and typing saves to the draft', async () => {
  const { ui, readDraft } = await open();
  const name = ui.getByRole('textbox', { name: 'Your name' });
  const phone = ui.getByRole('textbox', { name: 'Mobile number' });
  assert.equal(name.value, '');
  assert.equal(phone.value, '');
  assert.equal(phone.getAttribute('type'), 'tel');
  assert.equal(name.getAttribute('autocomplete'), 'name');
  assert.equal(phone.getAttribute('autocomplete'), 'tel');
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
  const email = ui.getByRole('textbox', { name: 'Email' });
  assert.equal(email.getAttribute('aria-required'), 'true');
  assert.equal(email.getAttribute('type'), 'email');
  assert.equal(email.getAttribute('autocomplete'), 'email');
  assert.ok(ui.queryByRole('textbox', { name: 'Email (optional)' }) === null);
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
  assert.ok(ui.queryByText(/^At /) === null);
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
  assert.ok(ui.queryByText('Please enter your name') === null);
  await type(ui.getByRole('textbox', { name: 'Mobile number' }), '07700 900123');
  await click(ui.getByRole('checkbox', { name: 'I agree to the booking terms' }));
  // Compared as a boolean, not the node itself (common.md): a DOM node's
  // circular fiber references make assert's failure-message formatting for
  // "not null" prohibitively slow if this ever regresses.
  assert.equal(ui.queryByText('Please accept the booking terms') === null, true);
  assert.equal(ui.queryByText(CHECK) === null, true);
});

test('"Read the booking terms" is a separate button above the tick box, whose label has no button inside it', async () => {
  const { ui } = await open();
  const checkbox = ui.getByRole('checkbox', { name: 'I agree to the booking terms' });
  const { within } = await rtl();
  const label = checkbox.closest('label');
  assert.ok(label);
  assert.equal(within(label).queryAllByRole('button').length, 0, 'the tick box label contains no button');
});

test('"Read the booking terms" opens the terms in a dialog on the same screen, without ticking the box', async () => {
  const { ui, requests } = await open();
  assert.equal(requests.some((r) => r.url.endsWith('/terms')), false, 'the terms are fetched before they are opened');
  await click(ui.getByRole('button', { name: 'Read the booking terms' }));
  const dialog = await ui.findByRole('dialog', { name: 'Booking terms' });
  const { within } = await rtl();
  assert.ok(await within(dialog).findByText('1. Your booking is a request.'));
  assert.equal(ui.getByRole('checkbox', { name: 'I agree to the booking terms' }).checked, false);
  assert.ok(requests.some((r) => r.url === '/api/portal/north/terms'), JSON.stringify(requests));
  await click(within(dialog).getByRole('button', { name: 'Close' }));
  assert.ok(ui.queryByRole('dialog') === null);
  assert.ok(ui.getByRole('heading', { level: 1, name: 'How can we reach you?' }));
});

test('if the terms fail to load, the dialog says so and Try again asks again', async () => {
  let calls = 0;
  const terms = () => (++calls === 1
    ? { status: 500, body: { error: 'Something went wrong' } }
    : { status: 200, body: { title: 'Booking terms', text: '1. Your booking is a request.', standard: true } });
  const { ui } = await open({ terms });
  await click(ui.getByRole('button', { name: 'Read the booking terms' }));
  assert.ok(await ui.findByText("We couldn't load the booking terms"));
  await click(ui.getByRole('button', { name: 'Try again' }));
  assert.ok(await ui.findByText('1. Your booking is a request.'));
  assert.equal(calls, 2);
});

// Sending (Task 4).
const READY = { ...TIMED, ...CONTACT, termsAccepted: true };
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const pngFile = () => new File([PNG], 'brake.png', { type: 'image/png' });
const refuse = (status, error, extra = {}) => () => ({ status, body: { error, ...extra } });
const DATE_STATE = 'At /book/north/date {"timeTaken":true}';
const CHANGED = 'The questions for this service have changed — please check them and try again';

test('a good request reads the services again, then sends the booking', async () => {
  const { ui, requests } = await open({ draft: READY });
  // Counted from here, not just "the request right before the POST": the
  // frame reads /services too, so an incidental background refetch at mount
  // (React Query's default staleTime is 0) must not be mistaken for the
  // send's own refetch.
  const before = requests.length;
  await press(ui);
  assert.ok(await ui.findByText(`At ${PRIVATE_LINK}`));
  const sent = requests.slice(before);
  assert.equal(sent.length, 2, JSON.stringify(sent));
  assert.equal(`${sent[0].method} ${sent[0].url}`, 'GET /api/portal/north/services');
  assert.equal(sent[1].url, '/api/portal/north/bookings');
  assert.deepEqual(sent[1].body, {
    serviceIds: [11, 12], answers: [{ serviceId: 11, questionId: 'b1', choice: 'Squeaking' }],
    bikeNote: 'Blue Trek road bike', photos: [],
    jobDate: '2026-10-05', mechanicId: 1, startTime: '09:30',
    guestName: 'Gina Guest', guestPhone: '07700 900123', updateChannel: 'sms', termsAccepted: true,
  });
});

test('answers are cleaned against the services read just before sending', async () => {
  let fresh = false;
  const reworded = {
    ...SERVICES,
    uncategorised: [
      { ...SERVICES.uncategorised[0], questions: [choiceQ('b1', "What's wrong with the brakes?", ['Squeal', 'Not stopping well'])] },
      SERVICES.uncategorised[1],
    ],
  };
  const services = () => ({ status: 200, body: fresh ? reworded : SERVICES });
  const { ui, requests } = await open({ draft: READY, services });
  fresh = true;
  await press(ui);
  assert.ok(await ui.findByText(`At ${PRIVATE_LINK}`));
  assert.deepEqual(posts(requests)[0].body.answers, []);
});

test('Not sure on a drop-off day sends notSure, the description, no answers or start time, and the email', async () => {
  const draft = { ...DROPOFF, ...CONTACT, termsAccepted: true, updateChannel: 'email', email: 'gina@example.com' };
  const { ui, requests } = await open({ draft });
  await press(ui);
  assert.ok(await ui.findByText(`At ${PRIVATE_LINK}`));
  assert.deepEqual(posts(requests)[0].body, {
    notSure: true, description: 'Clicks when pedalling', photos: [], jobDate: '2026-10-06', mechanicId: 2,
    guestName: 'Gina Guest', guestPhone: '07700 900123', email: 'gina@example.com', updateChannel: 'email', termsAccepted: true,
  });
});

test('photos held in memory are sent as bare base64', async () => {
  const { ui, requests } = await open({ draft: { ...READY, hadPhotos: true }, photos: [pngFile()] });
  await press(ui);
  assert.ok(await ui.findByText(`At ${PRIVATE_LINK}`));
  assert.deepEqual(posts(requests)[0].body.photos, [{ dataBase64: Buffer.from(PNG).toString('base64') }]);
});

test('while sending, the button reads "Sending…" and cannot be pressed again', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const booking = async () => {
    await gate;
    return { status: 201, body: { id: 1, reference: 'WH-1001', privateLink: PRIVATE_LINK, services: [], totalPrice: null } };
  };
  const { ui, requests } = await open({ draft: READY, booking });
  await press(ui);
  const sending = await ui.findByRole('button', { name: 'Sending…' });
  assert.equal(sending.disabled, true);
  await click(sending);
  release();
  assert.ok(await ui.findByText(`At ${PRIVATE_LINK}`));
  assert.equal(posts(requests).length, 1);
});

test('success clears the draft and opens the private link', async () => {
  const { ui, readPhotos } = await open({ draft: { ...READY, hadPhotos: true }, photos: [pngFile()] });
  await press(ui);
  assert.ok(await ui.findByText(`At ${PRIVATE_LINK}`));
  assert.equal(window.sessionStorage.getItem('wh-book-draft:north'), null);
  // Not only the saved draft: the photos held in the provider's memory too.
  assert.equal(readPhotos().length, 0);
});

test('photos cleared by a refresh: the question, and "Add photos" goes back to problem without sending', async () => {
  const { ui, requests } = await open({ draft: { ...READY, hadPhotos: true } });
  await press(ui);
  const dialog = await ui.findByRole('dialog', { name: 'Your photos were cleared - add them again, or send without them?' });
  const { within } = await rtl();
  await click(within(dialog).getByRole('button', { name: 'Add photos' }));
  assert.ok(await ui.findByText('At /book/north/problem'));
  assert.equal(posts(requests).length, 0);
});

test('"Send without photos" sends with none', async () => {
  const { ui, requests } = await open({ draft: { ...READY, hadPhotos: true } });
  await press(ui);
  const dialog = await ui.findByRole('dialog', { name: 'Your photos were cleared - add them again, or send without them?' });
  const { within } = await rtl();
  await click(within(dialog).getByRole('button', { name: 'Send without photos' }));
  assert.ok(await ui.findByText(`At ${PRIVATE_LINK}`));
  assert.deepEqual(posts(requests)[0].body.photos, []);
});

test('a capacity refusal clears the day, mechanic and time, keeps everything else, and goes to date', async () => {
  const booking = refuse(409, 'That mechanic does not have enough free time that day - please choose another day, or a shorter job.', { code: 'capacity' });
  const { ui, readDraft } = await open({ draft: { ...DROPOFF, ...CONTACT, termsAccepted: true }, booking });
  await press(ui);
  assert.ok(await ui.findByText(DATE_STATE));
  const saved = readDraft();
  assert.deepEqual([saved.date, saved.mechanicId, saved.startTime, saved.anyMechanic], [undefined, undefined, undefined, undefined]);
  assert.deepEqual([saved.name, saved.phone, saved.description, saved.termsAccepted], ['Gina Guest', '07700 900123', 'Clicks when pedalling', true]);
});

for (const error of [
  'That time is no longer available - please choose another.',
  "That's too soon for the shop - please choose a later time or day.",
  'That date has passed - please choose another day.',
  'That mechanic is unavailable at that time - please choose another time or day.',
  'This shop takes drop-offs on that day - please choose a timed slot or another day.',
  'A start time is required - please choose one.',
  'Please choose a mechanic to book this time.',
  'The shop is closed that day - please choose another date.',
  'That mechanic does not work that day - please choose another day or another mechanic.',
  "That job doesn't fit in the shop's opening hours (09:00–17:30) - please choose an earlier time or a shorter job type.",
]) {
  test(`"${error}" goes back to date`, async () => {
    const { ui, readDraft } = await open({ draft: READY, booking: refuse(400, error) });
    await press(ui);
    assert.ok(await ui.findByText(DATE_STATE));
    assert.equal(readDraft().startTime, undefined);
  });
}

test("changed questions go back to problem with the server's message", async () => {
  const { ui } = await open({ draft: READY, booking: refuse(400, CHANGED) });
  await press(ui);
  assert.ok(await ui.findByText(`At /book/north/problem ${JSON.stringify({ questionsChanged: CHANGED })}`));
});

test('a required question left unanswered also goes back to problem, with the server\'s own wording', async () => {
  const required = "Please answer: What's wrong with the brakes?";
  const { ui } = await open({ draft: READY, booking: refuse(400, required) });
  await press(ui);
  assert.ok(await ui.findByText(`At /book/north/problem ${JSON.stringify({ questionsChanged: required })}`));
});

const SEND_FAILED = "We couldn't send your booking - please check your connection and try again";

test('if the services refetch fails with a 5xx, it stays on details with the generic lost-connection message, not the server\'s raw wording', async () => {
  // Flipped only once the screen (and everything else reading /services) has
  // settled - as in "answers are cleaned..." above - so this fails the
  // refetch just before sending, not the screen's own load.
  let failing = false;
  const services = () => (failing
    ? { status: 500, body: { error: 'Something went wrong' } }
    : { status: 200, body: SERVICES });
  const { within } = await rtl();
  const { ui, requests } = await open({ draft: READY, services });
  failing = true;
  await press(ui);
  const alert = await within(pinned()).findByRole('alert');
  assert.equal(alert.textContent, SEND_FAILED);
  assert.equal(ui.getByRole('button', { name: 'Request booking' }).disabled, false);
  assert.equal(posts(requests).length, 0, 'the booking is never sent');
});

test('a proxy page with no JSON body (a 502) is also shown as a lost connection', async () => {
  const { within } = await rtl();
  const { ui, requests } = await open({ draft: READY, booking: () => ({ status: 502, body: undefined }) });
  await press(ui);
  const alert = await within(pinned()).findByRole('alert');
  assert.equal(alert.textContent, SEND_FAILED);
  assert.equal(posts(requests).length, 1, 'the send was attempted');
});

const staysWith = async (booking, message) => {
  // `within` is fetched before pressing, not after: an `await` between the
  // press and the first testing-library query would let the refused POST's
  // state update land outside act() (a bare import await isn't wrapped the
  // way findBy/within's own waiting is), which prints an act() warning even
  // though every assertion still passes.
  const { within } = await rtl();
  const { ui, readDraft } = await open({ draft: READY, booking });
  await press(ui);
  const alert = await within(pinned()).findByRole('alert');
  assert.equal(alert.textContent, message);
  assert.equal(ui.getByRole('button', { name: 'Request booking' }).disabled, false);
  assert.ok(ui.queryByText(/^At /) === null);
  assert.equal(readDraft().startTime, '09:30', 'the choice is kept');
};

test('too many requests: the message on the details screen', async () => {
  await staysWith(refuse(429, 'Too many booking requests from this network - please try again later.'),
    'Too many booking requests from this network - please try again later.');
});

test('no response: asks the customer to check their connection', async () => {
  await staysWith(() => { throw new TypeError('Failed to fetch'); },
    "We couldn't send your booking - please check your connection and try again");
});

test("any other JSON refusal: the server's own message is kept, shown as is, on the details screen", async () => {
  await staysWith(refuse(400, 'version is required - send the version you last read'), 'version is required - send the version you last read');
});
