// A service reminder's booking link, the customer's side (openspec/changes/
// finish-account design 4; drawn as ac-reminder-landing; Jack, 9 Nov, answer 4;
// question 10): the link fills a fresh booking with the service, the bike and
// her details partly hidden, and opens "When?" with the drawn box. Booking
// from it sends the code instead of typed details; Change clears them; a
// missing service or bike opens that step; a bad code opens Book a repair.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderBookScreen } from '../helpers/book-screen.js';
import { REMINDER_BOOK_ROUTE } from '../../src/customer/routes.ts';
import { reminderBookPath } from '../../server/messaging/reminder-links.js';

let current;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current?.client.clear();
  current?.uninstall();
  current = undefined;
});

const rtl = () => import('@testing-library/react');
const CODE = 'e'.repeat(64);
const BIKE = 'Trek Domane AL 3 · green · black mudguards';
const STANDARD = { id: 7, name: 'Standard service', price: 65, minutes: 60, questions: [] };
const SERVICES = { shopName: 'North Street Cycles', showPrices: true, full: [], categories: [], uncategorised: [STANDARD] };
const LINK = { serviceId: 7, serviceName: 'Standard service', bikeId: 31, bikeLabel: BIKE, details: { name: 'Maya P.', phone: '07700 ••• 142' } };
const REMINDER = { code: CODE, serviceId: 7, serviceName: 'Standard service', bikeId: 31, bikeLabel: BIKE, name: 'Maya P.', phone: '07700 ••• 142', details: true };

const land = async (reminderLink, extra = {}) => {
  current = await renderBookScreen({
    file: 'screens/book/reminder-landing.js', exportName: 'ReminderLandingScreen', at: 'from-reminder/:code',
    url: `/book/north/from-reminder/${CODE}`, services: SERVICES, reminderLink, ...extra,
  });
  return current;
};

test('the page lives where the reminder’s link sends the customer', () => {
  assert.equal(REMINDER_BOOK_ROUTE, reminderBookPath(':shopSlug', ':code'));
});

test('a working code fills a fresh booking and opens “When?”', async () => {
  const { ui, readDraft, requests } = await land(LINK, { draft: { serviceIds: [99], description: 'Old booking' } });
  assert.ok((await ui.findByText('At /book/north/date')) !== null);
  assert.deepEqual(readDraft(), { serviceIds: [7], bikeNote: BIKE, reminder: REMINDER });
  assert.ok(requests.some((r) => r.url.endsWith(`/api/portal/north/reminder-links/${CODE}`)));
});

test('a service no longer booked online opens the service step; a removed bike, the bike step (question 10)', async () => {
  let { ui } = await land({ ...LINK, serviceId: null, serviceName: null });
  assert.ok((await ui.findByText('At /book/north')) !== null);
  const { cleanup } = await rtl();
  cleanup(); current.uninstall();
  ({ ui } = await land({ ...LINK, bikeId: null, bikeLabel: null }));
  assert.ok((await ui.findByText('At /book/north/problem')) !== null);
});

test('a service with a question still to answer opens the bike step', async () => {
  const asks = { ...SERVICES, uncategorised: [{ ...STANDARD, questions: [{ id: 'q1', wording: 'Anything else?', kind: 'text', required: true }] }] };
  const { ui } = await land(LINK, { services: asks });
  assert.ok((await ui.findByText('At /book/north/problem')) !== null);
});

test('a code that doesn’t work opens Book a repair as for anyone, with nothing filled', async () => {
  const { ui, readDraft } = await land(() => ({ status: 404, body: { error: 'This link doesn’t work' } }), { draft: { serviceIds: [7] } });
  assert.ok((await ui.findByText('At /book/north')) !== null);
  assert.equal(readDraft().reminder, undefined);
});

const DATE_DRAFT = { serviceIds: [7], bikeNote: BIKE, reminder: REMINDER };
const onDate = async (draft = DATE_DRAFT) => {
  current = await renderBookScreen({
    file: 'screens/book/date.js', exportName: 'DateScreen', at: 'date', url: '/book/north/date', services: SERVICES, draft,
  });
  return current;
};
const BOX = `From your reminder: booking the next Standard service for your ${BIKE}. Change either above.`;
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

test('“When?” shows the drawn box: what the reminder chose, and the details filled in with Change', async () => {
  const { ui } = await onDate();
  const box = await ui.findByText((_, el) => el?.tagName === 'P' && text(el).startsWith('From your reminder'));
  assert.equal(text(box), `${BOX}Your details are filled in from your reminder: Maya P. · 07700 ••• 142 · Change`);
});

test('Change clears the filled details; a service chosen instead drops the first line', async () => {
  const { ui, readDraft } = await onDate({ ...DATE_DRAFT, serviceIds: [7, 8] });
  const { fireEvent } = await rtl();
  const box = await ui.findByText((_, el) => el?.tagName === 'P' && text(el).startsWith('Your details are filled in'));
  assert.ok(!text(box).includes('From your reminder: booking'));
  fireEvent.click(ui.getByRole('button', { name: 'Change' }));
  assert.equal(readDraft().reminder.details, false);
  assert.ok(ui.queryByText((_, el) => el?.tagName === 'P' && text(el).startsWith('Your details are filled in')) === null);
});

const DETAILS_DRAFT = { ...DATE_DRAFT, date: '2026-09-02', mechanicId: 1, startTime: '10:00', termsAccepted: true };
const MECHANICS = { mechanics: [{ id: 1, name: 'Sam', workingDays: [1, 2, 3, 4, 5] }], openingTime: '09:00', closingTime: '17:00', openingDays: [1, 2, 3, 4, 5] };
const onDetails = async (draft, booking) => {
  current = await renderBookScreen({
    file: 'screens/book/details.js', exportName: 'DetailsScreen', at: 'details', url: '/book/north/details',
    services: SERVICES, draft, mechanics: MECHANICS, ...(booking ? { booking } : {}),
  });
  return current;
};
const sent = (requests) => requests.find((r) => r.method === 'POST' && r.url.endsWith('/bookings'))?.body;

test('booking from it skips typing details: it sends the code and her bike, no name or mobile', async () => {
  const { ui, requests } = await onDetails(DETAILS_DRAFT);
  const { fireEvent } = await rtl();
  await ui.findByText((_, el) => el?.tagName === 'P' && text(el) === 'Your details are filled in from your reminder: Maya P. · 07700 ••• 142 · Change');
  assert.ok(ui.queryByRole('textbox', { name: /Your name/ }) === null);
  assert.ok(ui.queryByRole('textbox', { name: /Mobile number/ }) === null);
  fireEvent.click(ui.getByRole('button', { name: 'Request booking' }));
  assert.ok((await ui.findByText(/^At \/book\/north\/booking\//)) !== null);
  const body = sent(requests);
  assert.equal(body.reminderCode, CODE);
  assert.equal(body.bikeId, 31);
  assert.equal(body.bikeNote, undefined);
  assert.deepEqual([body.guestName, body.guestPhone], ['', '']);
});

test('after Change, the details step asks as for anyone and sends no code', async () => {
  const { ui, requests } = await onDetails({ ...DETAILS_DRAFT, reminder: { ...REMINDER, details: false }, name: 'Sam Lee', phone: '07700 900555' });
  const { fireEvent } = await rtl();
  assert.ok((await ui.findByRole('textbox', { name: /Your name/ })) !== null);
  fireEvent.click(ui.getByRole('button', { name: 'Request booking' }));
  await ui.findByText(/^At \/book\/north\/booking\//);
  const body = sent(requests);
  assert.equal(body.reminderCode, undefined);
  assert.equal(body.bikeId, undefined);
  assert.equal(body.bikeNote, BIKE);
  assert.deepEqual([body.guestName, body.guestPhone], ['Sam Lee', '07700 900555']);
});

test('a link that stopped working on sending says so, and the details step asks', async () => {
  const EXPIRED = 'This reminder’s link has expired. Choose your bike and service to book.';
  const { ui, readDraft } = await onDetails(DETAILS_DRAFT, () => ({ status: 400, body: { error: EXPIRED, code: 'reminder_expired' } }));
  const { fireEvent } = await rtl();
  fireEvent.click(await ui.findByRole('button', { name: 'Request booking' }));
  assert.ok((await ui.findByText(EXPIRED)) !== null);
  assert.ok((await ui.findByRole('textbox', { name: /Your name/ })) !== null);
  assert.equal(readDraft().reminder, undefined);
});
