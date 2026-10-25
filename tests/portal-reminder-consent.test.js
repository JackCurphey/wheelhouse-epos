// Saying yes to service reminders when booking (openspec/changes/reminder-consent;
// account and reminders decisions 2 and 8): a ticked booking records a yes to
// service reminders and review requests on its customer, with when and how;
// anything else leaves the customer's answers as they were.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, seedMechanic } from './helpers/staff.js';
import { portalSignup, portalRequest } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { futureDate } from './helpers/workshopFixtures.js';
import { seedJobTypes, BOOKING_CONTACT } from './helpers/bookable.js';

let server;
let owner;
let sam;
let types;
let customer;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  types = await seedJobTypes(owner.shop.id);
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

let day = 0;
const nextDate = () => {
  const n = day++;
  const d = new Date(`${futureDate(1 + (n % 5))}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7 * Math.floor(n / 5));
  return d.toISOString().slice(0, 10);
};
// A guest gives a name and a phone, as the booking screen sends them.
const GUEST = { guestName: 'Maya Patel', guestPhone: '07700 900142' };
const book = (body, cookie = customer.cookie) => portalRequest(server.baseUrl, cookie, `/api/portal/${owner.shop.slug}/bookings`, {
  method: 'POST',
  body: {
    mechanicId: sam, jobDate: nextDate(), startTime: '10:00', description: 'Squeaky brakes',
    newBike: { make: 'Trek', model: 'Domane' }, serviceIds: [types.repair], ...BOOKING_CONTACT, ...(cookie ? {} : GUEST), ...body,
  },
});
const answers = (customerId) => runWithShop(owner.shop.id, () => prepare(
  'SELECT service_reminders, review_requests, reminders_said_yes_at, reminders_said_yes_via FROM customers WHERE id = ?'
).get(customerId));
const customerOf = (jobId) => runWithShop(owner.shop.id, async () =>
  (await prepare('SELECT customer_id FROM workshop_jobs WHERE id = ?').get(jobId)).customer_id);
const NO = { service_reminders: false, review_requests: false, reminders_said_yes_at: null, reminders_said_yes_via: null };

test('a guest who ticks the box says yes to reminders and review requests, from a booking, now', async () => {
  const res = await book({ remindMe: true }, null);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const a = await answers(await customerOf(res.body.id));
  assert.equal(a.service_reminders, true);
  assert.equal(a.review_requests, true);
  assert.equal(a.reminders_said_yes_via, 'booking');
  assert.ok(a.reminders_said_yes_at instanceof Date, String(a.reminders_said_yes_at));
});

test('a booking without the tick says nothing: no yes is recorded', async () => {
  for (const remindMe of [undefined, false, 'yes']) {
    const res = await book({ remindMe }, null);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual({ ...(await answers(await customerOf(res.body.id))) }, NO, String(remindMe));
  }
});

test('a customer who said yes keeps it when they book again without ticking', async () => {
  const first = await book({ remindMe: true });
  assert.equal(first.status, 201, JSON.stringify(first.body));
  const id = await customerOf(first.body.id);
  const said = await answers(id);
  const again = await book({});
  assert.equal(again.status, 201, JSON.stringify(again.body));
  assert.deepEqual({ ...(await answers(id)) }, { ...said });
});

test('a refused booking records no yes', async () => {
  const someone = await portalSignup(server.baseUrl, owner.shop.slug, {});
  const theirs = await runWithShop(owner.shop.id, () => prepare('SELECT id FROM customers WHERE email = ?').get(someone.email));
  assert.ok(theirs, 'the signed-up customer has a record');
  const res = await book({ remindMe: true, termsAccepted: false }, someone.cookie);
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.deepEqual({ ...(await answers(theirs.id)) }, NO);
});

// Review: refused after the job is tried, not only before it, still records nothing.
test('a booking refused because its time was just taken records no yes', async () => {
  const when = { jobDate: nextDate(), startTime: '10:00' };
  const first = await book(when);
  assert.equal(first.status, 201, JSON.stringify(first.body));
  const someone = await portalSignup(server.baseUrl, owner.shop.slug, {});
  const theirs = await runWithShop(owner.shop.id, () => prepare('SELECT id FROM customers WHERE email = ?').get(someone.email));
  assert.ok(theirs, 'the signed-up customer has a record');
  const taken = await book({ ...when, remindMe: true }, someone.cookie);
  assert.equal(taken.status, 409, JSON.stringify(taken.body));
  assert.deepEqual({ ...(await answers(theirs.id)) }, NO);
});

// Review: a yes always says when it was given.
test('a yes without when it was given is refused by the database', async () => {
  const someone = await portalSignup(server.baseUrl, owner.shop.slug, {});
  await assert.rejects(runWithShop(owner.shop.id, () => prepare('UPDATE customers SET service_reminders = true WHERE email = ?').run(someone.email)), /check constraint/);
});
