// The booking messages staff actions send (Jack, 20 Oct,
// docs/decisions/2026-10-20-booking-messages.md answer 4; the messages engine,
// pretend for now): accepting sends Booking confirmed, offering another time
// sends New time offered, declining sends Request declined, accepting a date
// change sends Date change answered. Each goes the customer's way at once.
// While sending is pretend, a message shows "[link]" and the customer's own
// link keeps working.
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
import { linkActions, bookOnline, dayMaker } from './helpers/linkActions.js';

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
  const set = await staff('/api/workshop-settings', { method: 'PUT', body: { bookingMode: 'timed', timedLeadMinutes: 30, confirmationNote: 'Please bring the lock key.' } });
  assert.equal(set.status, 200, JSON.stringify(set.body));
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const version = async (id) => (await staff(`/api/workshop-jobs/${id}`)).body.version;
const act = async (id, action, body = {}) => staff(`/api/workshop-jobs/${id}/${action}`, { method: 'POST', body: { version: await version(id), ...body } });
const messagesFor = (jobId) => runWithShop(owner.shop.id, () => prepare('SELECT * FROM customer_messages WHERE job_id = ? ORDER BY id').all(jobId));
const book = (startTime = '10:00') => bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, { mechanicId: sam, jobDate: nextDay(), startTime, serviceIds: [types.service] });
const reference = async (id) => (await staff(`/api/workshop-jobs/${id}`)).body.reference;

test('accepting a request sends Booking confirmed by the customer’s way, at once, with the drop-off and the shop’s note', async () => {
  const booked = await book('10:00');
  const before = Date.now();
  const res = await act(booked.id, 'accept');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const [m] = await messagesFor(booked.id);
  assert.equal(m.template_key, 'booking_confirmed');
  assert.equal(m.channel, 'email');
  assert.equal(m.to_address, 'booker@example.com');
  assert.ok(Date.parse(m.send_after) <= Date.now() && Date.parse(m.send_after) >= before - 1000, 'at once');
  assert.match(m.body, /^Hi .*, your Test service at North Street Cycles \S* is booked for \w{3} \d{1,2} \w{3}, 10:00\. Drop your Dawes Galaxy off by 09:30, half an hour before your booking\. Please bring the lock key\. See or change your booking: \[link\] — no app or sign-in needed\. Your repair · WH-\d+\.$/);
  assert.ok(m.body.endsWith(`${await reference(booked.id)}.`));
  // Pretend: the customer's own link keeps working.
  assert.equal((await link.read(booked.code)).status, 200);
});

test('offering another time sends New time offered, with the time and the shop’s message', async () => {
  const booked = await book('11:00');
  const day = nextDay();
  const res = await act(booked.id, 'offer', { jobDate: day, startTime: '14:00', mechanicId: sam, message: 'Would 14:00 suit?' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const [m] = await messagesFor(booked.id);
  assert.equal(m.template_key, 'time_offered');
  assert.match(m.body, /can’t do \w{3} \d{1,2} \w{3}, 11:00 and suggests \w{3} \d{1,2} \w{3}, 14:00 instead\. “Would 14:00 suit\?” Accept it or cancel your request: \[link\]\./);
});

test('declining sends Request declined with the shop’s message; with none, the gap is tidied', async () => {
  const booked = await book('12:00');
  assert.equal((await act(booked.id, 'decline', { message: 'We’re full that week.' })).status, 200);
  const [m] = await messagesFor(booked.id);
  assert.equal(m.template_key, 'request_declined');
  assert.match(m.body, /can’t fit in your Test service on \w{3} \d{1,2} \w{3}, 12:00\. “We’re full that week\.” Choose another date: \[link\]\./);
  const quiet = await book('13:00');
  await act(quiet.id, 'decline');
  const [q] = await messagesFor(quiet.id);
  assert.match(q.body, /, 13:00\./);
  assert.equal(/“|”/.test(q.body), false, 'no empty quotes');
});

test('accepting a date change sends Date change answered with the new time', async () => {
  const booked = await book('14:00');
  await act(booked.id, 'accept');
  const day = nextDay();
  const asked = await link.change(booked.code, { jobDate: day, startTime: '15:00', mechanicId: sam });
  assert.equal(asked.status, 200, JSON.stringify(asked.body));
  assert.equal((await act(booked.id, 'accept-change')).status, 200);
  const messages = await messagesFor(booked.id);
  assert.deepEqual(messages.map((m) => m.template_key), ['booking_confirmed', 'date_change_answered']);
  assert.match(messages[1].body, /has moved your Test service to \w{3} \d{1,2} \w{3}, 15:00\. Drop your Dawes Galaxy off by 14:30, half an hour before your booking\./);
});

test('a message switched off sends nothing, and the answer still goes through', async () => {
  assert.equal((await staff('/api/message-templates/booking_confirmed', { method: 'PUT', body: { enabled: false } })).status, 200);
  try {
    const booked = await book('16:00');
    assert.equal((await act(booked.id, 'accept')).status, 200);
    assert.deepEqual(await messagesFor(booked.id), []);
  } finally {
    await staff('/api/message-templates/booking_confirmed', { method: 'PUT', body: { enabled: true } });
  }
});

test('declining a time already offered says the time the customer asked for, not the one offered', async () => {
  const booked = await book('09:00');
  await act(booked.id, 'offer', { jobDate: nextDay(), startTime: '16:00', mechanicId: sam });
  assert.equal((await act(booked.id, 'decline')).status, 200);
  const declined = (await messagesFor(booked.id)).find((m) => m.template_key === 'request_declined');
  assert.match(declined.body, /can’t fit in your Test service on \w{3} \d{1,2} \w{3}, 09:00\./);
});

test('a staff-made reschedule answered sends no booking message', async () => {
  const booked = await book('15:00');
  await act(booked.id, 'accept');
  const asked = await act(booked.id, 'request-reschedule');
  assert.equal(asked.status, 200, JSON.stringify(asked.body));
  assert.equal((await act(booked.id, 'decline')).status, 200);
  assert.deepEqual((await messagesFor(booked.id)).map((m) => m.template_key), ['booking_confirmed']);
});


// Telling staff when a booking message didn't go (Jack, 20 Oct, booking
// messages answer 5; drawn as diary-no-message): the answer's reply says so,
// with the message's name; switched off says nothing.
test('an answer whose message has no way to reach the customer says so, by name', async () => {
  const quiet = await portalSignup(server.baseUrl, owner.shop.slug, {});
  const booked = await bookOnline(server.baseUrl, quiet.cookie, owner.shop.slug, { mechanicId: sam, jobDate: nextDay(), startTime: '10:00', serviceIds: [types.service] });
  await runWithShop(owner.shop.id, async () => {
    const { customer_id: id } = await prepare('SELECT customer_id FROM workshop_jobs WHERE id = ?').get(booked.id);
    await prepare('UPDATE customers SET phone = NULL, email = NULL WHERE id = ?').run(id);
  });
  const res = await act(booked.id, 'accept');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.bookingMessage, { skipped: 'no_contact', name: 'Booking confirmed' });
  const sent = await book('11:00');
  const ok = await act(sent.id, 'accept');
  assert.equal(ok.body.bookingMessage, undefined, 'nothing to say when it went');
});

test('declining or offering for a customer with no way to reach them says so too, by name', async () => {
  const quiet = await portalSignup(server.baseUrl, owner.shop.slug, {});
  const unreachable = async (startTime) => {
    const booked = await bookOnline(server.baseUrl, quiet.cookie, owner.shop.slug, { mechanicId: sam, jobDate: nextDay(), startTime, serviceIds: [types.service] });
    await runWithShop(owner.shop.id, async () => {
      const { customer_id: id } = await prepare('SELECT customer_id FROM workshop_jobs WHERE id = ?').get(booked.id);
      await prepare('UPDATE customers SET phone = NULL, email = NULL WHERE id = ?').run(id);
    });
    return booked;
  };
  const declined = await unreachable('12:00');
  assert.deepEqual((await act(declined.id, 'decline')).body.bookingMessage, { skipped: 'no_contact', name: 'Request declined' });
  const offered = await unreachable('13:00');
  const res = await act(offered.id, 'offer', { jobDate: nextDay(), startTime: '15:00', mechanicId: sam });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.bookingMessage, { skipped: 'no_contact', name: 'New time offered' });
});
