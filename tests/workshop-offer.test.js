// Offering another time for a booking request (Jack, 20 Oct,
// docs/decisions/2026-10-20-offer-another-time.md; openspec/changes/offer-another-time):
// staff move the request to a time they suggest, held for the customer with
// the first time let go; the customer accepts it (confirmed) or cancels.
// Link calls in this file must stay under 30 (the limiter is per server).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedJobTypes } from './helpers/bookable.js';
import { jsonRequest } from './helpers/http.js';
import { linkActions, bookOnline, liveHolds, jobRow, setJob, dayMaker } from './helpers/linkActions.js';

let server;
let owner;
let sam;
let alex;
let types;
let customer;
let link;
const nextDay = dayMaker();

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  alex = await seedMechanic(owner.shop.id, { name: 'Alex' });
  types = await seedJobTypes(owner.shop.id);
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
  link = linkActions(server.baseUrl, owner.shop.slug);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const book = (jobDate = nextDay(), startTime = '10:00') => bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, {
  mechanicId: sam, jobDate, startTime, serviceIds: [types.repair],
});
const version = async (id) => (await staff(`/api/workshop-jobs/${id}`)).body.version;
const offer = async (id, body) => staff(`/api/workshop-jobs/${id}/offer`, { method: 'POST', body: { version: await version(id), ...body } });
// Accept says which time it was shown (Jack, 22 Oct, Mark's audit P2 2): by
// default the time on the job now, as the customer's page shows it.
const acceptBody = (code, body) => jsonRequest(server.baseUrl, null, `/api/portal/${owner.shop.slug}/booking-links/${code}/accept-offer`, { method: 'POST', body });
async function acceptOffer(code, id) {
  const row = await jobRow(shopId(), id);
  return acceptBody(code, { jobDate: row.job_date, startTime: row.start_time || null });
}
const shopId = () => owner.shop.id;

test('offering moves the request to the suggested time and its hold with it, and keeps where it was asked', async () => {
  const asked = nextDay();
  const booked = await book(asked, '10:00');
  const to = nextDay();
  const res = await offer(booked.id, { jobDate: to, startTime: '14:00', mechanicId: alex, message: '  Would Friday at 14:00 suit?  ' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.bookingState, 'offered');
  const row = await jobRow(shopId(), booked.id);
  assert.equal(row.job_date, to);
  assert.equal(row.start_time, '14:00');
  assert.equal(row.mechanic_id, alex);
  assert.equal(row.offered_from_date, asked);
  assert.equal(row.offered_from_time, '10:00');
  assert.equal(row.offer_message, 'Would Friday at 14:00 suit?');
  assert.equal(row.status, 'pending', 'the old screens read an offer as a request');
  const holds = await liveHolds(shopId(), booked.id);
  assert.equal(holds.length, 1);
  assert.equal(holds[0].job_date, to);
  assert.equal(holds[0].start_time, '14:00');
});

test('offering again keeps the time first asked for', async () => {
  const asked = nextDay();
  const booked = await book(asked, '10:00');
  await offer(booked.id, { jobDate: nextDay(), startTime: '14:00', mechanicId: alex });
  const again = nextDay();
  const res = await offer(booked.id, { jobDate: again, startTime: '11:00', mechanicId: sam });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const row = await jobRow(shopId(), booked.id);
  assert.equal(row.job_date, again);
  assert.equal(row.offered_from_date, asked);
  assert.equal(row.offer_message, null);
});

test('an offer needs a free time, a version, and a request to offer', async () => {
  const day = nextDay();
  const first = await book(day, '10:00');
  const second = await book(day, '14:00');
  const taken = await offer(second.id, { jobDate: day, startTime: '10:00', mechanicId: sam });
  assert.equal(taken.status, 409, JSON.stringify(taken.body));
  assert.equal(taken.body.code, 'capacity');
  const noVersion = await staff(`/api/workshop-jobs/${first.id}/offer`, { method: 'POST', body: { jobDate: nextDay(), startTime: '10:00', mechanicId: sam } });
  assert.equal(noVersion.status, 400);
  await staff(`/api/workshop-jobs/${first.id}/accept`, { method: 'POST', body: { version: await version(first.id) } });
  const confirmed = await offer(first.id, { jobDate: nextDay(), startTime: '10:00', mechanicId: sam });
  assert.equal(confirmed.status, 409);
  assert.equal(confirmed.body.code, 'illegal');
  const long = await offer(second.id, { jobDate: nextDay(), startTime: '10:00', mechanicId: sam, message: 'x'.repeat(1001) });
  assert.equal(long.status, 400);
});

test('the customer’s link shows the offer, and the customer can accept it or cancel, not change it', async () => {
  const asked = nextDay();
  const booked = await book(asked, '10:00');
  const to = nextDay();
  await offer(booked.id, { jobDate: to, startTime: '14:00', mechanicId: alex, message: 'Would this suit?' });
  const view = (await link.read(booked.code)).body;
  assert.equal(view.stage, 'time_offered');
  assert.equal(view.jobDate, to);
  assert.equal(view.startTime, '14:00');
  assert.deepEqual(view.offer, { fromDate: asked, fromTime: '10:00', message: 'Would this suit?' });
  assert.equal(view.canAccept, true);
  assert.equal(view.canCancel, true);
  assert.equal(view.canChange, false);
  const change = await link.change(booked.code, { jobDate: nextDay(), mechanicId: sam, startTime: '10:00' });
  assert.equal(change.status, 409);
  assert.deepEqual(change.body, { error: "This booking can't be changed online", code: 'illegal' });
  const accepted = await acceptOffer(booked.code, booked.id);
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  assert.equal(accepted.body.stage, 'confirmed');
  assert.equal(accepted.body.offer, null);
  assert.equal(accepted.body.canAccept, false);
  const row = await jobRow(shopId(), booked.id);
  assert.equal(row.booking_state, 'scheduled');
  assert.equal(row.job_date, to);
  assert.equal(row.offered_from_date, null);
  const again = await acceptOffer(booked.code, booked.id);
  assert.equal(again.status, 200, 'a second press returns the same');
  assert.equal(again.body.stage, 'confirmed');
});

test('accepting is refused when nothing is offered, and cancelling an offer cancels it', async () => {
  const booked = await book();
  const none = await acceptOffer(booked.code, booked.id);
  assert.equal(none.status, 409);
  assert.deepEqual(none.body, { error: "There's no time offered to accept", code: 'illegal' });
  await offer(booked.id, { jobDate: nextDay(), startTime: '14:00', mechanicId: alex });
  const cancelled = await link.cancel(booked.code);
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
  assert.equal(cancelled.body.stage, 'cancelled');
  assert.deepEqual(await liveHolds(shopId(), booked.id), []);
});

test('an offer is nothing for staff to answer: Waiting for you leaves it out', async () => {
  const booked = await book();
  await offer(booked.id, { jobDate: nextDay(), startTime: '14:00', mechanicId: alex });
  const waiting = (await staff('/api/workshop-waiting')).body;
  const items = Array.isArray(waiting) ? waiting : waiting.items;
  assert.ok(!items.some((i) => i.jobId === booked.id || i.id === booked.id), JSON.stringify(items));
});

test('saving a status can’t confirm an offer', async () => {
  const booked = await book();
  await offer(booked.id, { jobDate: nextDay(), startTime: '14:00', mechanicId: alex });
  const job = (await staff(`/api/workshop-jobs/${booked.id}`)).body;
  const saved = await staff(`/api/workshop-jobs/${booked.id}`, { method: 'PUT', body: { ...job, status: 'scheduled' } });
  assert.equal(saved.status, 400, JSON.stringify(saved.body));
  assert.equal((await jobRow(shopId(), booked.id)).booking_state, 'offered');
});

test('a link that is too late can’t accept', async () => {
  const booked = await book();
  await offer(booked.id, { jobDate: nextDay(), startTime: '14:00', mechanicId: alex });
  await setJob(shopId(), booked.id, "custody_state = 'in_shop'");
  const res = await acceptOffer(booked.code, booked.id);
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'in_shop');
});

// Fresh review: a day gone by can't be offered (the customer couldn't accept
// it), and staff can still decline an offer, letting its time go.
test('a day gone by can’t be offered', async () => {
  const booked = await book();
  const res = await offer(booked.id, { jobDate: '2026-08-01', startTime: '10:00', mechanicId: sam });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'That date has passed - please choose another day.');
});

// Audit items 15-17 (docs/reviews/2026-10-22-flagged-merges-audit.md, #315).
// The server's clock is pinned to 1 Sep 2026, 06:00 UTC: 07:00 in the shop.
test('a time already gone today can’t be offered, and a later one today can', async () => {
  const booked = await book();
  const gone = await offer(booked.id, { jobDate: '2026-09-01', startTime: '06:30', mechanicId: sam });
  assert.equal(gone.status, 400, JSON.stringify(gone.body));
  assert.equal(gone.body.error, 'That time has passed - please choose a later time.');
  assert.equal((await jobRow(shopId(), booked.id)).booking_state, 'pending');
  const later = await offer(booked.id, { jobDate: '2026-09-01', startTime: '09:00', mechanicId: sam });
  assert.equal(later.status, 200, JSON.stringify(later.body));
});

// The case the pinned 07:00 can't show: a time inside opening hours that has
// already gone. A second server's clock reads 10:00 UTC, 11:00 in the shop.
test('a time gone today inside opening hours can’t be offered', async () => {
  const late = await startLiveServer({ env: { WHEELHOUSE_TEST_CLOCK: '2026-09-01T10:00:00.000Z' } });
  try {
    const booked = await book();
    const at = (path, options) => staffRequest(late.baseUrl, owner.cookie, path, options);
    const v = (await at(`/api/workshop-jobs/${booked.id}`)).body.version;
    const gone = await at(`/api/workshop-jobs/${booked.id}/offer`, { method: 'POST', body: { version: v, jobDate: '2026-09-01', startTime: '10:00', mechanicId: sam } });
    assert.equal(gone.status, 400, JSON.stringify(gone.body));
    assert.equal(gone.body.error, 'That time has passed - please choose a later time.');
    assert.equal((await jobRow(shopId(), booked.id)).booking_state, 'pending');
  } finally {
    await late.stop();
  }
});

test('a request whose bike is already in the shop, or whose work has started, can’t be offered another time', async () => {
  const inShop = await book();
  await setJob(shopId(), inShop.id, "custody_state = 'in_shop'");
  const a = await offer(inShop.id, { jobDate: nextDay(), startTime: '10:00', mechanicId: sam });
  assert.equal(a.status, 409, JSON.stringify(a.body));
  assert.equal(a.body.code, 'illegal');
  assert.equal(a.body.error, 'The bike is already in the shop, so this can’t be offered another time.');
  const started = await book();
  await setJob(shopId(), started.id, "work_state = 'in_progress'");
  const b = await offer(started.id, { jobDate: nextDay(), startTime: '10:00', mechanicId: sam });
  assert.equal(b.status, 409, JSON.stringify(b.body));
  assert.equal(b.body.error, 'The work has already started, so this can’t be offered another time.');
  for (const id of [inShop.id, started.id]) assert.equal((await jobRow(shopId(), id)).booking_state, 'pending');
});

test('the message with an offer must be text', async () => {
  const booked = await book();
  for (const message of [{ a: 1 }, 5, true, ['x']]) {
    const res = await offer(booked.id, { jobDate: nextDay(), startTime: '10:00', mechanicId: sam, message });
    assert.equal(res.status, 400, JSON.stringify([message, res.body]));
    assert.equal(res.body.error, 'The message must be text');
  }
  assert.equal((await jobRow(shopId(), booked.id)).offer_message, null);
  const none = await offer(booked.id, { jobDate: nextDay(), startTime: '10:00', mechanicId: sam, message: null });
  assert.equal(none.status, 200, JSON.stringify(none.body));
});

test('staff can decline an offer, and its time goes', async () => {
  const booked = await book();
  await offer(booked.id, { jobDate: nextDay(), startTime: '14:00', mechanicId: alex });
  const res = await staff(`/api/workshop-jobs/${booked.id}/decline`, { method: 'POST', body: { version: await version(booked.id) } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.bookingState, 'declined');
  assert.deepEqual(await liveHolds(shopId(), booked.id), []);
});

test('staff see the offer while it waits: the day first asked for and the message, and none once answered', async () => {
  const booked = await book();
  assert.equal((await staff(`/api/workshop-jobs/${booked.id}`)).body.offer, null);
  await offer(booked.id, { jobDate: nextDay(), startTime: '14:00', mechanicId: alex, message: 'Would 14:00 work?' });
  const seen = (await staff(`/api/workshop-jobs/${booked.id}`)).body;
  assert.deepEqual(seen.offer, { fromDate: booked.jobDate, fromTime: booked.startTime, message: 'Would 14:00 work?' });
  await staff(`/api/workshop-jobs/${booked.id}/decline`, { method: 'POST', body: { version: await version(booked.id) } });
  assert.equal((await staff(`/api/workshop-jobs/${booked.id}`)).body.offer, null);
});

// ---------- Accepting the time shown (Jack, 22 Oct, Mark's audit P2 2) ----------

test('an Accept for a time the shop has since changed is refused, and nothing is confirmed', async () => {
  const booked = await book();
  const friday = nextDay();
  await offer(booked.id, { jobDate: friday, startTime: '12:00', mechanicId: alex });
  // The customer's page shows Friday 12:00; the shop offers again meanwhile.
  await offer(booked.id, { jobDate: nextDay(), startTime: '09:00', mechanicId: alex });
  const stale = await acceptBody(booked.code, { jobDate: friday, startTime: '12:00' });
  assert.equal(stale.status, 409, JSON.stringify(stale.body));
  assert.equal(stale.body.code, 'stale');
  assert.equal(stale.body.error, 'The shop has changed the time it’s offering. Here’s the new one.');
  assert.equal((await jobRow(shopId(), booked.id)).booking_state, 'offered');
  // Accepting the new time works.
  assert.equal((await acceptOffer(booked.code, booked.id)).status, 200);
});

test('an Accept that doesn’t say its time (a page from before) is sent back to show the time', async () => {
  const booked = await book();
  await offer(booked.id, { jobDate: nextDay(), startTime: '14:00', mechanicId: alex });
  for (const body of [{}, { jobDate: 'Friday', startTime: '14:00' }]) {
    const res = await acceptBody(booked.code, body);
    assert.equal(res.status, 409, JSON.stringify([body, res.body]));
    assert.equal(res.body.code, 'stale');
  }
  assert.equal((await jobRow(shopId(), booked.id)).booking_state, 'offered');
});

test('an offered booking can’t be moved by an edit; staff offer again instead', async () => {
  const booked = await book();
  const day = nextDay();
  await offer(booked.id, { jobDate: day, startTime: '14:00', mechanicId: alex });
  const job = (await staff(`/api/workshop-jobs/${booked.id}`)).body;
  for (const change of [{ jobDate: nextDay() }, { startTime: '15:00', endTime: '16:00' }, { mechanicId: sam }]) {
    const res = await staff(`/api/workshop-jobs/${booked.id}`, { method: 'PUT', body: { version: job.version, ...change } });
    assert.equal(res.status, 409, JSON.stringify([change, res.body]));
    assert.equal(res.body.code, 'illegal');
    assert.equal(res.body.error, 'This time is on offer to the customer. To change it, use Offer another time.');
  }
  const row = await jobRow(shopId(), booked.id);
  assert.deepEqual([row.job_date, row.start_time, row.mechanic_id], [day, '14:00', alex]);
  // Notes can still change.
  assert.equal((await staff(`/api/workshop-jobs/${booked.id}`, { method: 'PUT', body: { version: job.version, notes: 'Bring the lock key' } })).status, 200);
});

test('the booking page’s own values for the time are what Accept compares', async () => {
  const booked = await book();
  await offer(booked.id, { jobDate: nextDay(), startTime: '14:00', mechanicId: alex });
  const view = (await link.read(booked.code)).body;
  const res = await acceptBody(booked.code, { jobDate: view.jobDate, startTime: view.startTime });
  assert.equal(res.status, 200, JSON.stringify(res.body));
});
