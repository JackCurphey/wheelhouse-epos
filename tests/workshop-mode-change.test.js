// Scheduling a booking-mode change from a date the shop chooses.
// Spec: docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md (2b)
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer, TEST_CLOCK_PIN } from './helpers/liveServer.js';
import { shopToday } from '../server/clock.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { futureDate } from './helpers/workshopFixtures.js';

let server;
let owner;

before(async () => {
  server = await startLiveServer();
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

async function freshShop() {
  if (owner) await deleteTestShop(owner.shop.id);
  owner = await staffSignup(server.baseUrl);
}

const settings = (body) => staffRequest(server.baseUrl, owner.cookie, '/api/workshop-settings', body ? { method: 'PUT', body } : undefined);
// The shop's today on the server's pinned clock (UK time), and the day before.
const today = () => shopToday('Europe/London', new Date(TEST_CLOCK_PIN));
const yesterday = () => shopToday('Europe/London', new Date(new Date(TEST_CLOCK_PIN).getTime() - 86_400_000));

test('a shop schedules drop-off mode from a future date, and can cancel it', async () => {
  await freshShop();
  const from = futureDate(1);
  const put = await settings({ nextBookingMode: 'dropoff', nextBookingModeFrom: from });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  assert.equal(put.body.bookingMode, 'timed');
  assert.equal(put.body.nextBookingMode, 'dropoff');
  assert.equal(put.body.nextBookingModeFrom, from);
  const cancelled = await settings({ nextBookingMode: null, nextBookingModeFrom: null });
  assert.equal(cancelled.body.nextBookingMode, null);
  assert.equal(cancelled.body.nextBookingModeFrom, null);
});

test('a change dated today, half a change, or the same mode is refused', async () => {
  await freshShop();
  assert.equal((await settings({ nextBookingMode: 'dropoff', nextBookingModeFrom: today() })).status, 400);
  assert.equal((await settings({ nextBookingMode: 'dropoff' })).status, 400);
  assert.equal((await settings({ nextBookingMode: 'timed', nextBookingModeFrom: futureDate(1) })).status, 400);
});

test('other settings saves keep a scheduled change', async () => {
  await freshShop();
  const from = futureDate(2);
  await settings({ nextBookingMode: 'dropoff', nextBookingModeFrom: from });
  const res = await settings({ showPricesOnline: true });
  assert.equal(res.body.nextBookingMode, 'dropoff');
  assert.equal(res.body.nextBookingModeFrom, from);
});

test('a change whose date has arrived becomes the mode, and a save settles it', async () => {
  await freshShop();
  await runWithShop(owner.shop.id, () => prepare(
    "UPDATE workshop_settings SET next_booking_mode = 'dropoff', next_booking_mode_from = ?"
  ).run(yesterday()));
  const read = await settings();
  assert.equal(read.body.bookingMode, 'dropoff');
  assert.equal(read.body.nextBookingMode, null);
  await settings({ showPricesOnline: false });
  const row = await runWithShop(owner.shop.id, () => prepare(
    'SELECT booking_mode, next_booking_mode, next_booking_mode_from FROM workshop_settings LIMIT 1'
  ).get());
  assert.deepEqual({ ...row }, { booking_mode: 'dropoff', next_booking_mode: null, next_booking_mode_from: null });
});

test('setting bookingMode directly to the already-scheduled mode clears the schedule', async () => {
  await freshShop();
  const from = futureDate(1);
  await settings({ nextBookingMode: 'dropoff', nextBookingModeFrom: from });
  const put = await settings({ bookingMode: 'dropoff' });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  assert.equal(put.body.bookingMode, 'dropoff');
  assert.equal(put.body.nextBookingMode, null);
  assert.equal(put.body.nextBookingModeFrom, null);
  const row = await runWithShop(owner.shop.id, () => prepare(
    'SELECT next_booking_mode, next_booking_mode_from FROM workshop_settings LIMIT 1'
  ).get());
  assert.deepEqual({ ...row }, { next_booking_mode: null, next_booking_mode_from: null });
});

// Piece 10: "today" for a scheduled change is the shop's today, in its own
// time zone. At the pinned moment (06:00 UTC, 1 Sep) it is 07:00 on 1 Sep in
// the UK but 23:00 on 31 Aug in Los Angeles.
// Spec: docs/superpowers/specs/2026-09-26-book-server-10-notice-timezone-design.md
test("the mode change's today is the shop's today, in the shop's time zone", async () => {
  await freshShop();
  assert.equal(today(), '2026-09-01');
  const uk = await settings({ nextBookingMode: 'dropoff', nextBookingModeFrom: '2026-09-01' });
  assert.equal(uk.status, 400, 'a UK shop scheduled a change for its own today');
  await settings({ timeZone: 'America/Los_Angeles' });
  const la = await settings({ nextBookingMode: 'dropoff', nextBookingModeFrom: '2026-09-01' });
  assert.equal(la.status, 200, JSON.stringify(la.body));
  assert.equal(la.body.bookingMode, 'timed', 'in Los Angeles 1 Sep is tomorrow, so the change has not arrived');
  assert.equal(la.body.nextBookingModeFrom, '2026-09-01');
});
