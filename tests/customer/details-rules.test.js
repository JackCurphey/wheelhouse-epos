// The details screen's rules: the field messages, the summary, the request
// body, sorting a refusal, and reading a photo to bare base64.
// Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md
import test from 'node:test';
import assert from 'node:assert/strict';

const BUILD = new URL('../../.test-build/', import.meta.url);
const r = await import(new URL('screens/book/details-rules.js', BUILD).href);
const s = await import(new URL('screens/book/send.js', BUILD).href);
const { ApiError } = await import(new URL('lib/api/client.js', BUILD).href);

const choiceQ = (id, wording, choices) => ({ id, wording, kind: 'choice', required: true, choices, allowNotSure: true });
const SERVICES = {
  shopName: 'North Street Cycles', showPrices: true, full: [], categories: [],
  uncategorised: [
    { id: 11, name: 'Brake service', price: 20, minutes: 30, questions: [choiceQ('b1', "What's wrong with the brakes?", ['Squeaking', 'Not stopping well'])] },
    { id: 12, name: 'Gear service', price: 25.5, minutes: 45, questions: [] },
    { id: 13, name: 'Wheel true', price: null, minutes: 30, questions: [] },
  ],
};
const MECHANICS = [{ id: 1, name: 'Alex', workingDays: [] }, { id: 2, name: 'Jo', workingDays: [] }];
const CONTACT = { name: 'Gina Guest', phone: '07700 900123', termsAccepted: true };

test('the messages, word for word', () => {
  assert.deepEqual(r.FIELD_MESSAGES, {
    name: 'Please enter your name',
    phone: 'Please enter your mobile number',
    email: 'Please enter a valid email address',
    terms: 'Please accept the booking terms',
  });
  assert.equal(r.CHECK_ANSWERS, 'Please check the answers marked above');
  assert.equal(r.PHOTOS_QUESTION, 'Your photos were cleared - add them again, or send without them?');
  assert.equal(r.TIME_TAKEN_MESSAGE, 'Sorry, that time was booked while you were filling in your details - please choose another');
  assert.equal(r.TOO_MANY_REQUESTS, 'Too many booking requests from this network - please try again later.');
  assert.equal(r.SEND_FAILED, "We couldn't send your booking - please check your connection and try again");
});

test('every field is checked, in screen order; blank counts as empty', () => {
  assert.deepEqual(r.fieldErrors({}), [
    { field: 'name', message: 'Please enter your name' },
    { field: 'phone', message: 'Please enter your mobile number' },
    { field: 'terms', message: 'Please accept the booking terms' },
  ]);
  assert.deepEqual(r.fieldErrors({ name: '  ', phone: ' ', termsAccepted: true }).map((p) => p.field), ['name', 'phone']);
  assert.deepEqual(r.fieldErrors(CONTACT), []);
});

test('an email is needed for Email updates, and must look like one whenever it is given', () => {
  const email = (d) => r.fieldErrors({ ...CONTACT, ...d }).find((p) => p.field === 'email')?.message ?? null;
  assert.equal(email({}), null, 'text message, no email');
  assert.equal(email({ updateChannel: 'email' }), 'Please enter a valid email address');
  assert.equal(email({ updateChannel: 'email', email: '   ' }), 'Please enter a valid email address');
  assert.equal(email({ email: 'gina@' }), 'Please enter a valid email address');
  assert.equal(email({ email: 'gina example.com' }), 'Please enter a valid email address');
  assert.equal(email({ updateChannel: 'email', email: ' gina@example.com ' }), null);
  assert.equal(email({ updateChannel: 'whatsapp', email: 'gina@example.com' }), null);
  assert.equal(r.looksLikeEmail('gina@example.com'), true);
  assert.equal(r.looksLikeEmail('gina@@'), false);
});

test('updates default to text message; the email label says optional unless Email is chosen', () => {
  assert.equal(r.DEFAULT_CHANNEL, 'sms');
  assert.equal(r.channelOf({}), 'sms');
  assert.equal(r.channelOf({ updateChannel: 'whatsapp' }), 'whatsapp');
  assert.deepEqual(r.CHANNEL_OPTIONS, [
    { value: 'sms', label: 'Text message' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'email', label: 'Email' },
  ]);
  assert.equal(r.emailLabel('email'), 'Email');
  assert.equal(r.emailLabel('sms'), 'Email (optional)');
  assert.equal(r.emailLabel('whatsapp'), 'Email (optional)');
});

test('the summary: services in list order, or Not sure; the price when shown; the bike note', () => {
  assert.equal(r.serviceNames(SERVICES, { serviceIds: [12, 11] }), 'Brake service, Gear service');
  assert.equal(r.serviceNames(SERVICES, { notSure: true, serviceIds: [] }), 'Not sure');
  assert.equal(r.priceText(SERVICES, { serviceIds: [11, 12] }), 'From £45.50');
  assert.equal(r.priceText({ ...SERVICES, showPrices: false }, { serviceIds: [11, 12] }), null);
  assert.equal(r.priceText(SERVICES, { serviceIds: [11, 13] }), null, 'a service with no price');
  assert.equal(r.priceText(SERVICES, { notSure: true, serviceIds: [] }), null);
  assert.deepEqual(
    r.summaryLines(SERVICES, { serviceIds: [11], bikeNote: ' Blue Trek ' }, 'Monday 5 October, 09:30 with Alex'),
    ['Brake service', 'Monday 5 October, 09:30 with Alex', 'From £20', 'Blue Trek'],
  );
  assert.deepEqual(r.summaryLines(SERVICES, { notSure: true, serviceIds: [], bikeNote: '  ' }, 'Tuesday 6 October'), ['Not sure', 'Tuesday 6 October']);
});

test('the day and time read as on the date screen', () => {
  assert.equal(r.whenText({ date: '2026-10-05', mechanicId: 1, startTime: '09:30' }, MECHANICS), 'Monday 5 October, 09:30 with Alex');
  assert.equal(r.whenText({ date: '2026-10-05', mechanicId: 9, startTime: '09:30' }, MECHANICS), 'Monday 5 October, 09:30', 'mechanic not known');
  assert.equal(r.whenText({ date: '2026-10-06', mechanicId: 2 }, MECHANICS, { start: '08:30', end: '10:00' }), 'Tuesday 6 October, drop off 08:30–10:00');
  assert.equal(r.whenText({ date: '2026-10-06', mechanicId: 2 }), 'Tuesday 6 October', 'window not known');
  assert.equal(r.whenText({}), '');
  const av = {
    busy: [], fullDays: [],
    days: [
      { date: '2026-10-06', mode: 'dropoff', dropoffWindow: { start: '08:30', end: '10:00' }, mechanics: [] },
      { date: '2026-10-05', mode: 'timed', mechanics: [] },
    ],
  };
  assert.deepEqual(r.dropoffWindowOn(av, '2026-10-06'), { start: '08:30', end: '10:00' });
  assert.equal(r.dropoffWindowOn(av, '2026-10-05'), undefined);
  assert.equal(r.dropoffWindowOn(av, '2026-10-07'), undefined);
});

test('the body on a timed day: services, cleaned answers, the bike note, photos, the time and the contact', () => {
  const draft = {
    serviceIds: [11, 12],
    answers: [{ serviceId: 11, questionId: 'b1', choice: 'Squeaking', text: 'Front only' }, { serviceId: 11, questionId: 'gone', text: 'old' }],
    bikeNote: ' Blue Trek road bike ', description: '  ',
    date: '2026-10-05', mechanicId: 1, startTime: '09:30',
    name: ' Gina Guest ', phone: ' 07700 900123 ', updateChannel: 'whatsapp', termsAccepted: true, hadPhotos: true,
  };
  assert.deepEqual(r.bookingBody(SERVICES, draft, ['AAAA']), {
    serviceIds: [11, 12],
    answers: [{ serviceId: 11, questionId: 'b1', choice: 'Squeaking', text: 'Front only' }],
    bikeNote: 'Blue Trek road bike',
    photos: [{ dataBase64: 'AAAA' }],
    jobDate: '2026-10-05', mechanicId: 1, startTime: '09:30',
    guestName: 'Gina Guest', guestPhone: '07700 900123',
    updateChannel: 'whatsapp', termsAccepted: true,
  });
});

test('Not sure on a drop-off day: no services or answers, the description, no start time, and the email when given', () => {
  const draft = {
    notSure: true, serviceIds: [], answers: [], description: ' Clicks when pedalling ',
    date: '2026-10-06', mechanicId: 2, anyMechanic: true,
    ...CONTACT, email: ' gina@example.com ', updateChannel: 'email',
  };
  assert.deepEqual(r.bookingBody(SERVICES, draft, []), {
    notSure: true, description: 'Clicks when pedalling', photos: [],
    jobDate: '2026-10-06', mechanicId: 2,
    guestName: 'Gina Guest', guestPhone: '07700 900123', email: 'gina@example.com',
    updateChannel: 'email', termsAccepted: true,
  });
  const plain = r.bookingBody(SERVICES, { serviceIds: [12], date: '2026-10-05', mechanicId: 1, startTime: '09:30', ...CONTACT }, []);
  assert.equal(plain.updateChannel, 'sms', 'the default channel is sent');
  assert.equal('email' in plain, false);
});

const refused = (status, body) => r.refusalRoute(new ApiError(status, body));

test('a refusal is sorted: taken or too soon to date, changed questions to problem, the rest stays', () => {
  assert.deepEqual(
    refused(409, { error: 'That mechanic does not have enough free time that day - please choose another day, or a shorter job.', code: 'capacity' }),
    { to: 'date' },
  );
  for (const error of [
    'That time is no longer available - please choose another.',
    "That's too soon for the shop - please choose a later time or day.",
    'That date has passed - please choose another day.',
  ]) assert.deepEqual(refused(400, { error }), { to: 'date' }, error);
  const changed = 'The questions for this service have changed — please check them and try again';
  assert.deepEqual(refused(400, { error: changed }), { to: 'problem', message: changed });
  assert.deepEqual(refused(429, { error: 'anything' }), { to: 'stay', message: 'Too many booking requests from this network - please try again later.' });
  assert.deepEqual(refused(400, { error: 'Please answer: Tubeless?' }), { to: 'stay', message: 'Please answer: Tubeless?' });
  assert.deepEqual(refused(500, null), { to: 'stay', message: 'request failed with 500' });
  assert.deepEqual(r.refusalRoute(new TypeError('Failed to fetch')), {
    to: 'stay', message: "We couldn't send your booking - please check your connection and try again",
  });
});

test('a choice made stale since the date screen also goes back to date (decision 4; Jack approves)', () => {
  for (const error of [
    'That mechanic is unavailable at that time - please choose another time or day.',
    'This shop takes drop-offs on that day - choose the day, not a time.',
    'A start time is required',
    'Please choose a mechanic',
  ]) assert.deepEqual(refused(400, { error }), { to: 'date' }, error);
});

test('a photo is read as bare base64: no data: prefix, no line breaks, a large file in chunks', async () => {
  const bytes = Uint8Array.from({ length: 100_000 }, (_, i) => (i * 7) % 256);
  const encoded = await s.photoBase64(new File([bytes], 'brake.png', { type: 'image/png' }));
  assert.equal(encoded, Buffer.from(bytes).toString('base64'));
  assert.doesNotMatch(encoded, /^data:|\n/);
});

test("the booking goes to the shop's bookings address", () => {
  assert.equal(s.bookingsPath('north shop'), '/api/portal/north%20shop/bookings');
});
