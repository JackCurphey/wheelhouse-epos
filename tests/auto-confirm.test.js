// Confirming online bookings automatically, the server half (Jack, 19 Oct,
// docs/decisions/2026-10-19-auto-confirm.md; openspec/changes/auto-confirm):
// a shop setting, off to start; with it on, a booking that fits is saved
// confirmed, marked new until staff open it, and its customer gets Booking
// confirmed (pretend for now). Built by Jack under the working agreement (#349).
// Link calls in this file must stay under 30 (the limiter is per server).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedJobTypes } from './helpers/bookable.js';
import { linkActions, bookOnline, tryBooking, dayMaker } from './helpers/linkActions.js';

let server;
let owner;
let sam;
let types;
let customer;
let link;
const nextDay = dayMaker();

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
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
const setAuto = async (on) => {
  const res = await staff('/api/workshop-settings', { method: 'PUT', body: { confirmBookingsAutomatically: on } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body;
};
const book = (startTime) => bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, { mechanicId: sam, jobDate: nextDay(), startTime, serviceIds: [types.service] });
const messagesFor = (jobId) => runWithShop(owner.shop.id, () => prepare('SELECT template_key, body FROM customer_messages WHERE job_id = ? ORDER BY id').all(jobId));
const portalServices = async () => (await fetch(`${server.baseUrl}/api/portal/${owner.shop.slug}/services`)).json();

test('the setting starts off and saves', async () => {
  assert.equal((await staff('/api/workshop-settings')).body.confirmBookingsAutomatically, false);
  assert.equal((await setAuto(true)).confirmBookingsAutomatically, true);
  assert.equal((await staff('/api/workshop-settings')).body.confirmBookingsAutomatically, true);
  // Leaving it out keeps what is stored.
  const other = await staff('/api/workshop-settings', { method: 'PUT', body: { showPricesOnline: true } });
  assert.equal(other.body.confirmBookingsAutomatically, true);
  await setAuto(false);
});

test('the booking screens are told whether a booking confirms at once', async () => {
  assert.equal((await portalServices()).confirmsAutomatically, false);
  await setAuto(true);
  try {
    assert.equal((await portalServices()).confirmsAutomatically, true);
  } finally {
    await setAuto(false);
  }
});

test('off: a booking waits for the shop, as before, with no mark and no message', async () => {
  const booked = await book('10:00');
  const job = (await staff(`/api/workshop-jobs/${booked.id}`)).body;
  assert.equal(job.bookingState, 'pending');
  assert.equal(job.newOnline, false);
  assert.equal((await link.read(booked.code)).body.stage, 'awaiting_confirmation');
  assert.deepEqual(await messagesFor(booked.id), []);
});

test('on: a booking that fits is confirmed at once, marked new, and Booking confirmed goes; the link keeps working', async () => {
  await setAuto(true);
  try {
    const booked = await book('11:00');
    const job = (await staff(`/api/workshop-jobs/${booked.id}`)).body;
    assert.equal(job.bookingState, 'scheduled');
    assert.equal(job.newOnline, true);
    assert.ok((await staff(`/api/workshop-jobs?start=${job.jobDate}&end=${job.jobDate}`)).body.find((j) => j.id === booked.id).newOnline);
    const read = await link.read(booked.code);
    assert.equal(read.status, 200);
    assert.equal(read.body.stage, 'confirmed');
    const messages = await messagesFor(booked.id);
    assert.deepEqual(messages.map((m) => m.template_key), ['booking_confirmed']);
    assert.match(messages[0].body, /\[link\]/, 'pretend: the link is a placeholder');
    // Not waiting for the shop: it isn't on Waiting for you.
    const waiting = (await staff('/api/workshop-waiting')).body;
    assert.equal(waiting.items.some((i) => i.jobId === booked.id), false);
  } finally {
    await setAuto(false);
  }
});

test('on: a booking that doesn’t fit is still refused', async () => {
  await setAuto(true);
  try {
    const day = nextDay();
    const first = await bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, { mechanicId: sam, jobDate: day, startTime: '13:00', serviceIds: [types.service] });
    assert.ok(first.id);
    const second = await tryBooking(server.baseUrl, customer.cookie, owner.shop.slug, { mechanicId: sam, jobDate: day, startTime: '13:00', serviceIds: [types.service] });
    assert.equal(second.status, 409, JSON.stringify(second.body));
  } finally {
    await setAuto(false);
  }
});

test('opening the job clears its mark; seen again changes nothing', async () => {
  await setAuto(true);
  let booked;
  try {
    booked = await book('15:00');
  } finally {
    await setAuto(false);
  }
  const before = (await staff(`/api/workshop-jobs/${booked.id}`)).body;
  const seen = await staff(`/api/workshop-jobs/${booked.id}/seen`, { method: 'POST', body: {} });
  assert.equal(seen.status, 204);
  const afterSeen = (await staff(`/api/workshop-jobs/${booked.id}`)).body;
  assert.equal(afterSeen.newOnline, false);
  assert.equal(afterSeen.version, before.version, 'seeing it is not an edit');
  assert.equal((await staff(`/api/workshop-jobs/${booked.id}/seen`, { method: 'POST', body: {} })).status, 204);
  assert.equal((await staff('/api/workshop-jobs/999999/seen', { method: 'POST', body: {} })).status, 404);
});
