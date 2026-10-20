// Change the date on the booking page (Jack, 1 Oct, decision 10; 19 and 20 Oct;
// drawn as bk-change, bk-change-pending and bk-change-declined;
// openspec/changes/change-date): the day strip in place, the chosen day's
// times, then the change waits for the shop.
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
  bike: { make: 'Trek', model: 'Domane AL 3' }, stage: 'confirmed', photoCount: 0, services: [{ name: 'Standard service', price: 65 }], totalPrice: 65,
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

const open = async (link = MAYA, { onChange, onWithdraw } = {}) => {
  current = await renderBookScreen({
    file: 'screens/book/pending.js', exportName: 'PendingScreen', at: 'booking/:code',
    url: `/book/north/booking/${CODE}`, services: SERVICES,
    availability: AVAILABILITY,
    bookingLink: (address, init) => {
      const post = (init?.method ?? 'GET') === 'POST';
      if (post && address.endsWith('/change')) return onChange ? onChange(JSON.parse(init.body)) : { status: 200, body: { ...link, stage: 'change_requested', requested: { jobDate: plus(5), startTime: '14:00', mechanicId: 7 } } };
      if (post && address.endsWith('/withdraw-change')) return onWithdraw ? onWithdraw() : { status: 200, body: { ...link, stage: 'confirmed', requested: null } };
      return { status: 200, body: link };
    },
  });
  return current;
};
const rtl = () => import('@testing-library/react');
const click = async (el) => { const { act, fireEvent } = await rtl(); await act(async () => { fireEvent.click(el); }); };
const posts = (end) => current.requests.filter((r) => r.method === 'POST' && r.url.endsWith(end));

test('a confirmed booking offers Change the date before Cancel booking', async () => {
  const { ui } = await open();
  const change = await ui.findByRole('button', { name: 'Change the date' });
  const cancel = ui.getByRole('button', { name: 'Cancel booking' });
  assert.ok(change.compareDocumentPosition(cancel) & 4, 'Change the date comes first');
});

test('one that can’t be changed online doesn’t offer it', async () => {
  const { ui } = await open({ ...MAYA, canChange: false });
  await ui.findByRole('button', { name: 'Cancel booking' });
  assert.ok(ui.queryByRole('button', { name: 'Change the date' }) === null);
});

test('Change the date shows the strip of days, each with its words, asking for its own booking’s availability', async () => {
  const { ui } = await open();
  await click(await ui.findByRole('button', { name: 'Change the date' }));
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'Choose a new date' }));
  assert.ok(current.requests.some((r) => r.method === 'GET' && r.url.includes(`/booking-links/${CODE}/availability?start=${TODAY}&end=${plus(61)}`)));
  const days = await ui.findByRole('radiogroup', { name: 'Days' });
  const { within } = await rtl();
  const radios = within(days).getAllByRole('radio');
  assert.equal(radios.length, 10);
  assert.equal(within(days).getByRole('radio', { name: `${long(plus(1))}, closed` }).disabled, true);
  assert.equal(within(days).getByRole('radio', { name: `${long(plus(2))}, full` }).disabled, true);
  assert.ok(within(days).getByRole('radio', { name: `${long(BOOKED)}, your booking` }));
  assert.ok(within(days).getByRole('radio', { name: `${long(plus(5))}, 2 times free` }));
  assert.ok(ui.queryByText(`Your booking stays on ${WEEKDAYS[new Date(`${BOOKED}T00:00:00Z`).getUTCDay()]} until the shop confirms the new time.`) !== null);
});

test('Later weeks moves the strip on a week, and Earlier weeks back', async () => {
  const { ui } = await open();
  await click(await ui.findByRole('button', { name: 'Change the date' }));
  await click(await ui.findByRole('button', { name: /Later weeks/ }));
  const { within } = await rtl();
  const days = ui.getByRole('radiogroup', { name: 'Days' });
  assert.ok(within(days).getByRole('radio', { name: new RegExp(`^${long(plus(7))},`) }));
  await click(ui.getByRole('button', { name: /Earlier weeks/ }));
  assert.ok(within(ui.getByRole('radiogroup', { name: 'Days' })).getByRole('radio', { name: new RegExp(`^${long(TODAY)},`) }));
});

test('choosing a day shows its times; asking for one sends it and the page waits for the shop', async () => {
  const { ui } = await open();
  await click(await ui.findByRole('button', { name: 'Change the date' }));
  const ask = await ui.findByRole('button', { name: 'Ask for this date' });
  assert.equal(ask.disabled, true);
  await click(ui.getByRole('radio', { name: `${long(plus(5))}, 2 times free` }));
  const times = ui.getByRole('radiogroup', { name: `${long(plus(5))} — choose a time` });
  const { within } = await rtl();
  await click(within(times).getByRole('radio', { name: '14:00' }));
  await click(ui.getByRole('button', { name: 'Ask for this date' }));
  assert.ok(await ui.findByText('New date waiting for the shop'));
  assert.deepEqual(posts('/change').map((r) => r.body), [{ jobDate: plus(5), mechanicId: 7, startTime: '14:00' }]);
  assert.ok(ui.queryByText(`You asked to move to ${short(plus(5))}, 14:00. Your booking stays on ${long(BOOKED)} until the shop confirms the new time.`) !== null);
});

test('a drop-off day takes the day, saying the window', async () => {
  const { ui } = await open();
  await click(await ui.findByRole('button', { name: 'Change the date' }));
  await click(await ui.findByRole('radio', { name: `${long(plus(6))}, free` }));
  assert.ok(ui.queryByText('Drop off between 09:00 and 10:00') !== null);
  await click(ui.getByRole('button', { name: 'Ask for this date' }));
  const { waitFor } = await rtl();
  await waitFor(() => assert.deepEqual(posts('/change').map((r) => r.body), [{ jobDate: plus(6), mechanicId: 7 }]));
});

test('Keep closes it and sends nothing; a refusal shows the server’s words', async () => {
  const { ui } = await open(MAYA, { onChange: () => ({ status: 409, body: { error: 'That time is no longer available - please choose another.', code: 'capacity' } }) });
  await click(await ui.findByRole('button', { name: 'Change the date' }));
  const weekday = WEEKDAYS[new Date(`${BOOKED}T00:00:00Z`).getUTCDay()];
  await click(await ui.findByRole('radio', { name: `${long(plus(5))}, 2 times free` }));
  await click(ui.getByRole('radio', { name: '10:00' }));
  await click(ui.getByRole('button', { name: 'Ask for this date' }));
  assert.ok(await ui.findByText('That time is no longer available - please choose another.'));
  await click(ui.getByRole('button', { name: `Keep ${weekday}` }));
  assert.ok(ui.queryByRole('heading', { level: 2, name: 'Choose a new date' }) === null);
  assert.ok(await ui.findByRole('button', { name: 'Change the date' }));
});

test('a change waiting: Cancel my date change takes it back', async () => {
  const { ui } = await open({ ...MAYA, stage: 'change_requested', requested: { jobDate: plus(5), startTime: '14:00', mechanicId: 7 } });
  assert.ok(await ui.findByText('New date waiting for the shop'));
  assert.ok(ui.queryByRole('button', { name: 'Change the date' }) === null);
  await click(ui.getByRole('button', { name: 'Cancel my date change' }));
  assert.ok(await ui.findByText('Booking confirmed'));
  assert.equal(posts('/withdraw-change').length, 1);
});

test('a change the shop declined says so at the top', async () => {
  const { ui } = await open({ ...MAYA, changeDeclined: true });
  assert.ok(await ui.findByText(`The shop couldn’t do the new date you asked for. Your booking is still ${long(BOOKED)}, 11:30.`));
});

test('Ask for this date stays off for the booking’s own day and time', async () => {
  const { ui } = await open();
  await click(await ui.findByRole('button', { name: 'Change the date' }));
  await click(await ui.findByRole('radio', { name: `${long(BOOKED)}, your booking` }));
  await click(ui.getByRole('radio', { name: '11:30' }));
  assert.equal(ui.getByRole('button', { name: 'Ask for this date' }).disabled, true);
  await click(ui.getByRole('radio', { name: '09:00' }));
  assert.equal(ui.getByRole('button', { name: 'Ask for this date' }).disabled, false);
});
