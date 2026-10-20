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
const acceptOffer = (code) => jsonRequest(server.baseUrl, null, `/api/portal/${owner.shop.slug}/booking-links/${code}/accept-offer`, { method: 'POST', body: {} });
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
  const accepted = await acceptOffer(booked.code);
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  assert.equal(accepted.body.stage, 'confirmed');
  assert.equal(accepted.body.offer, null);
  assert.equal(accepted.body.canAccept, false);
  const row = await jobRow(shopId(), booked.id);
  assert.equal(row.booking_state, 'scheduled');
  assert.equal(row.job_date, to);
  assert.equal(row.offered_from_date, null);
  const again = await acceptOffer(booked.code);
  assert.equal(again.status, 200, 'a second press returns the same');
  assert.equal(again.body.stage, 'confirmed');
});

test('accepting is refused when nothing is offered, and cancelling an offer cancels it', async () => {
  const booked = await book();
  const none = await acceptOffer(booked.code);
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

test('the old job form can’t confirm an offer by saving its status', async () => {
  const booked = await book();
  await offer(booked.id, { jobDate: nextDay(), startTime: '14:00', mechanicId: alex });
  const job = (await staff(`/api/workshop-jobs/${booked.id}`)).body;
  const saved = await staff(`/api/workshop-jobs/${booked.id}`, { method: 'PUT', body: { ...job, status: 'scheduled' } });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal((await jobRow(shopId(), booked.id)).booking_state, 'offered');
});

test('a link that is too late can’t accept', async () => {
  const booked = await book();
  await offer(booked.id, { jobDate: nextDay(), startTime: '14:00', mechanicId: alex });
  await setJob(shopId(), booked.id, "custody_state = 'in_shop'");
  const res = await acceptOffer(booked.code);
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
