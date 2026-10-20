// The waiting-for-the-shop page, to its drawing (Jack, 1 Oct, decisions 10 and
// 12; 20 Oct; drawn as bk-page-request; openspec/changes/booking-page-request):
// "Your booking request", the purple badge, the rows, Change the date (which
// moves a request at once) and Cancel request.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderBookScreen } from '../helpers/book-screen.js';

let current;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current?.client.clear();
  current?.uninstall();
  current = undefined;
});

const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const TODAY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const plus = (n) => { const d = new Date(`${TODAY}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const long = (date) => { const d = new Date(`${date}T00:00:00Z`); return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
const SHORT_D = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (date) => { const d = new Date(`${date}T00:00:00Z`); return `${SHORT_D[d.getUTCDay()]} ${d.getUTCDate()} ${SHORT_M[d.getUTCMonth()]}`; };

const BOOKED = plus(3);
const SERVICES = { shopName: 'North Street Cycles', showPrices: true, full: [], categories: [], uncategorised: [] };
const CODE = 'b'.repeat(64);
const MAYA = {
  reference: 'WH-1042', shopName: 'North Street Cycles', jobDate: BOOKED, startTime: '11:30', description: null, bikeNote: null, answers: [],
  bike: { make: 'Trek', model: 'Domane AL 3' }, stage: 'awaiting_confirmation', photoCount: 0, services: [{ name: 'Standard service', price: 65 }], totalPrice: 65,
  dropOff: null, confirmationNote: null, canCancel: true, canChange: true, requested: null, changeDeclined: false,
};
// Day 1 closed, day 2 full, the booked day with its own time, day 5 with two times.
const DAYS = Array.from({ length: 62 }, (_, i) => {
  const date = plus(i);
  if (i === 1) return { date, mode: 'timed', closed: true, startTimes: [] };
  if (i === 2) return { date, mode: 'timed', closed: false, startTimes: [] };
  if (i === 3) return { date, mode: 'timed', closed: false, startTimes: ['09:00', '11:30'] };
  if (i === 5) return { date, mode: 'timed', closed: false, startTimes: ['10:00', '14:00'] };
  if (i === 6) return { date, mode: 'dropoff', closed: false, bookable: true, dropoffWindow: { start: '09:00', end: '10:00' } };
  return { date, mode: 'timed', closed: false, startTimes: ['09:00'] };
});
const AVAILABILITY = { mechanicId: 7, minutes: 60, days: DAYS };

const open = async (link = MAYA) => {
  current = await renderBookScreen({
    file: 'screens/book/pending.js', exportName: 'PendingScreen', at: 'booking/:code',
    url: `/book/north/booking/${CODE}`, services: SERVICES, availability: AVAILABILITY,
    bookingLink: (address, init) => {
      const post = (init?.method ?? 'GET') === 'POST';
      if (post && address.endsWith('/change')) { const b = JSON.parse(init.body); return { status: 200, body: { ...link, jobDate: b.jobDate, startTime: b.startTime ?? '' } }; }
      if (post && address.endsWith('/cancel')) return { status: 200, body: { ...link, stage: 'cancelled', canCancel: false, canChange: false } };
      return { status: 200, body: link };
    },
  });
  return current;
};
const rtl = () => import('@testing-library/react');
const click = async (el) => { const { act, fireEvent } = await rtl(); await act(async () => { fireEvent.click(el); }); };

test('a request: Your repair over Your booking request, the purple badge, the words, the rows, the shop', async () => {
  const { ui } = await open();
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Your booking request' }));
  assert.ok(ui.queryByText('Your repair · WH-1042') !== null);
  assert.ok(ui.queryByText('Waiting for the shop to confirm') !== null);
  assert.ok(ui.queryByText('Please wait for the shop to confirm before bringing your bike in. Check this page to see when it does.') !== null);
  assert.ok(ui.queryByText(`${long(BOOKED)}, 11:30`) !== null);
  assert.ok(ui.queryByText('Reference') === null);
  assert.ok(ui.queryByText('Booking confirmed') === null);
});

test('it offers Change the date and Cancel request, and no contact line', async () => {
  const { ui } = await open();
  const change = await ui.findByRole('button', { name: 'Change the date' });
  const cancel = ui.getByRole('button', { name: 'Cancel request' });
  assert.ok(change.compareDocumentPosition(cancel) & 4);
  assert.ok(ui.queryByText(/^Need to change/) === null);
});

test('changing a request moves it straight away, and says so first', async () => {
  const { ui } = await open();
  await click(await ui.findByRole('button', { name: 'Change the date' }));
  assert.ok(await ui.findByText('Your request moves to the new date straight away; the shop still needs to confirm it.'));
  await click(await ui.findByRole('radio', { name: `${long(plus(5))}, 2 times free` }));
  await click(ui.getByRole('radio', { name: '14:00' }));
  await click(ui.getByRole('button', { name: 'Move my request' }));
  assert.ok(await ui.findByText(`${long(plus(5))}, 14:00`));
  assert.ok(ui.queryByText('Waiting for the shop to confirm') !== null);
  assert.ok(ui.queryByRole('heading', { level: 2, name: 'Choose a new date' }) === null);
});

test('Cancel request asks in a request’s words, then shows the cancelled page', async () => {
  const { ui } = await open();
  await click(await ui.findByRole('button', { name: 'Cancel request' }));
  const dialog = await ui.findByRole('dialog', { name: 'Cancel this request?' });
  const { within } = await rtl();
  assert.ok(within(dialog).getByRole('button', { name: 'Keep my request' }));
  await click(within(dialog).getByRole('button', { name: 'Cancel request' }));
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Your booking is cancelled' }));
});

test('a request that can’t be changed or cancelled online offers neither, and keeps the contact line', async () => {
  const { ui } = await open({ ...MAYA, canChange: false, canCancel: false });
  await ui.findByRole('heading', { level: 1, name: 'Your booking request' });
  assert.ok(ui.queryByRole('button', { name: 'Change the date' }) === null);
  assert.ok(ui.queryByRole('button', { name: 'Cancel request' }) === null);
  assert.ok(ui.queryByText('Need to change or cancel? Contact North Street Cycles') !== null);
});
