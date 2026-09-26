// The booking request: the service it names, the contact and consent it takes,
// the reference it returns.
// Spec: docs/superpowers/specs/2026-09-25-book-server-3-booking-request-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, seedMechanic, setOpeningDays } from './helpers/staff.js';
import { portalSignup, portalRequest } from './helpers/portal.js';
import { jsonRequest } from './helpers/http.js';
import { deleteTestShop } from './helpers/testShop.js';
import { futureDate } from './helpers/workshopFixtures.js';
import { seedJobTypes, BOOKING_CONTACT } from './helpers/bookable.js';

let server;
let owner;
let other;
let sam;
let types;
let customer;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  other = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  types = await seedJobTypes(owner.shop.id);
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
});

let day = 0;
// A different Monday-to-Friday date per call, so no two tests share a day's capacity.
// The weekday cycles through five; the week advances each time the cycle wraps,
// so a date never repeats.
const nextDate = () => {
  const n = day++;
  const d = new Date(`${futureDate(1 + (n % 5))}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7 * Math.floor(n / 5));
  return d.toISOString().slice(0, 10);
};
const book = (body, who = customer) => portalRequest(server.baseUrl, who.cookie, `/api/portal/${owner.shop.slug}/bookings`, {
  method: 'POST',
  body: {
    mechanicId: sam, jobDate: nextDate(), startTime: '10:00', description: 'Test booking',
    newBike: { make: 'Test', model: 'Bike' }, serviceId: types.repair, ...BOOKING_CONTACT, ...body,
  },
});
const job = (id) => runWithShop(owner.shop.id, () => prepare(
  'SELECT title, planned_minutes, start_time, end_time, terms_accepted_at, reference FROM workshop_jobs WHERE id = ?'
).get(id));

test('a service of this shop books, taking its length and name', async () => {
  const res = await book({ serviceId: types.service });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const j = await job(res.body.id);
  assert.equal(j.planned_minutes, 120);
  assert.equal(j.end_time, '12:00');
  assert.match(j.title, /^Online booking: Test service - Test booking$/);
});

test('not sure books one hour under a generic title', async () => {
  const res = await book({ serviceId: undefined, notSure: true });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const j = await job(res.body.id);
  assert.equal(j.planned_minutes, 60);
  assert.match(j.title, /^Online booking: Not sure - Test booking$/);
});

test('a service from another shop is refused', async () => {
  const foreign = (await seedJobTypes(other.shop.id)).repair;
  const res = await book({ serviceId: foreign });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.match(res.body.error, /not available/);
});

test('a service the shop has not ticked bookable online is refused', async () => {
  const id = await runWithShop(owner.shop.id, async () => (await prepare(
    "INSERT INTO workshop_services (name, price, minutes, bookable_online, active, updated_at) VALUES ('Staff only', 10, 30, 0, 1, now())"
  ).run()).lastInsertRowid);
  const res = await book({ serviceId: id });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.match(res.body.error, /not available/);
});

test('a retired service is refused', async () => {
  const id = await runWithShop(owner.shop.id, async () => (await prepare(
    "INSERT INTO workshop_services (name, price, minutes, bookable_online, active, updated_at) VALUES ('Retired', 10, 30, 1, 0, now())"
  ).run()).lastInsertRowid);
  const res = await book({ serviceId: id });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.match(res.body.error, /not available/);
});

test('the old jobType input no longer books', async () => {
  const res = await book({ serviceId: undefined, jobType: 'repair' });
  assert.equal(res.status, 400, JSON.stringify(res.body));
});

// service_id/booked_price moved from workshop_jobs into workshop_job_services
// (migration 030, server piece 7) - one row per booked service; this task
// still books exactly one, so position 0 is the whole story.
const priced = (jobId) => runWithShop(owner.shop.id, async () => (await prepare(
  'SELECT service_id, booked_price::text AS booked_price FROM workshop_job_services WHERE workshop_job_id = ? ORDER BY position LIMIT 1'
).get(jobId)) ?? { service_id: null, booked_price: null });
const pricedService = (price) => runWithShop(owner.shop.id, async () => (await prepare(
  "INSERT INTO workshop_services (name, price, minutes, bookable_online, active, updated_at) VALUES ('Priced', ?, 30, 1, 1, now())"
).run(price)).lastInsertRowid);

test('a named service stores its id and its price on the booking', async () => {
  const id = await pricedService('49.99');
  const res = await book({ serviceId: id });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual({ ...(await priced(res.body.id)) }, { service_id: id, booked_price: '49.99' });
});

test('changing the service price afterwards leaves the booked price alone', async () => {
  const id = await pricedService('30.00');
  const res = await book({ serviceId: id });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  await runWithShop(owner.shop.id, () => prepare('UPDATE workshop_services SET price = 99 WHERE id = ?').run(id));
  assert.equal((await priced(res.body.id)).booked_price, '30.00');
});

test('not sure stores no service and no price', async () => {
  const res = await book({ serviceId: undefined, notSure: true });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual({ ...(await priced(res.body.id)) }, { service_id: null, booked_price: null });
});

test('with prices hidden, the booking response carries no price', async () => {
  const res = await book({ serviceId: await pricedService('987.65') });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.ok('bookedPrice' in res.body, 'bookedPrice field present');
  assert.equal(res.body.bookedPrice, null, 'bookedPrice is null');
  assert.ok(!Object.keys(res.body).filter((k) => k !== 'bookedPrice').some((k) => /price/i.test(k)), JSON.stringify(res.body));
  assert.ok(!Object.values(res.body).some((v) => v === 987.65 || v === '987.65'), JSON.stringify(res.body));
});

const customerRow = (id) => runWithShop(owner.shop.id, () => prepare(
  'SELECT email, update_channel, marketing_permission FROM customers WHERE id = ?'
).get(id));
const customerIdOf = (jobId) => runWithShop(owner.shop.id, async () =>
  (await prepare('SELECT customer_id FROM workshop_jobs WHERE id = ?').get(jobId)).customer_id);

test('the response carries the booking reference, and it is the one stored on the job', async () => {
  const res = await book({});
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.ok(res.body.reference, 'no reference in the response');
  assert.equal((await job(res.body.id)).reference, res.body.reference);
});

test('terms consent is stored as a timestamp on the job', async () => {
  const before = Date.now();
  const res = await book({});
  const stamp = new Date((await job(res.body.id)).terms_accepted_at).getTime();
  assert.ok(stamp >= before - 5000 && stamp <= Date.now() + 5000, 'timestamp is not "now"');
});

const jobCount = () => runWithShop(owner.shop.id, async () =>
  Number((await prepare('SELECT COUNT(*) AS n FROM workshop_jobs').get()).n));

test('a booking without accepted terms is refused and creates no job', async () => {
  const before = await jobCount();
  const res = await book({ termsAccepted: false });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.equal(await jobCount(), before, 'a job was created');
  assert.match(res.body.error, /terms/i);
});

test('preferences are saved on the customer', async () => {
  const c = customer;
  const res = await book({ email: 'saved@example.com', updateChannel: 'email', marketingPermission: true }, c);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual({ ...(await customerRow(await customerIdOf(res.body.id))) },
    { email: 'saved@example.com', update_channel: 'email', marketing_permission: true });
});

test('marketing permission defaults to false when it is not sent', async () => {
  const c = customer;
  const first = await book({ marketingPermission: true }, c);
  assert.equal((await customerRow(await customerIdOf(first.body.id))).marketing_permission, true);
  const res = await book({}, c);
  assert.equal((await customerRow(await customerIdOf(res.body.id))).marketing_permission, false);
});

test('a returning customer\'s newer preferences overwrite the old ones', async () => {
  const c = customer;
  await book({ email: 'first@example.com', updateChannel: 'email', marketingPermission: true }, c);
  const res = await book({ email: 'second@example.com', updateChannel: 'email', marketingPermission: false }, c);
  assert.deepEqual({ ...(await customerRow(await customerIdOf(res.body.id))) },
    { email: 'second@example.com', update_channel: 'email', marketing_permission: false });
});

test('sms needs a phone number; a signed-in customer with none on file is refused', async () => {
  const c = customer;
  const res = await book({ updateChannel: 'sms', email: '' }, c);
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.match(res.body.error, /phone number/i);
});

test('a guest books with a phone and the sms channel, and gets a reference', async () => {
  const res = await jsonRequest(server.baseUrl, null, `/api/portal/${owner.shop.slug}/bookings`, {
    method: 'POST',
    body: {
      mechanicId: sam, jobDate: nextDate(), startTime: '10:00', description: 'Guest booking',
      newBike: { make: 'Test', model: 'Bike' }, serviceId: types.quick,
      guestName: 'Gail Guest', guestPhone: '07700 900123',
      updateChannel: 'sms', termsAccepted: true,
    },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.ok(res.body.reference);
  const row = await customerRow(await customerIdOf(res.body.id));
  assert.equal(row.update_channel, 'sms');
});

const setPhone = (id, phone) => runWithShop(owner.shop.id, () =>
  prepare('UPDATE customers SET phone = ? WHERE id = ?').run(phone, id));
const phoneOf = async (id) => (await runWithShop(owner.shop.id, () =>
  prepare('SELECT phone FROM customers WHERE id = ?').get(id))).phone;

test('a signed-in customer with no phone who picks sms has the phone they sent saved', async () => {
  const id = await customerIdOf((await book({})).body.id);
  await setPhone(id, '');
  const res = await book({ updateChannel: 'sms', guestPhone: '07700 900555' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(await phoneOf(id), '07700 900555');
});

test('a customer who already has a phone keeps it when another is sent', async () => {
  const id = await customerIdOf((await book({})).body.id);
  await setPhone(id, '01111 111111');
  const res = await book({ updateChannel: 'sms', guestPhone: '07700 900666' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(await phoneOf(id), '01111 111111');
});

test('a refused booking changes nothing on the customer', async () => {
  const c = customer;
  const okRes = await book({ email: 'keep@example.com', updateChannel: 'email' }, c);
  const customerId = await customerIdOf(okRes.body.id);
  // A shop-rule refusal is enough: a closed Sunday. A default test shop opens
  // on Sundays, so close it explicitly (Monday to Saturday).
  const days = await runWithShop(owner.shop.id, async () =>
    (await prepare('SELECT opening_days FROM workshop_settings').get()).opening_days);
  await setOpeningDays(owner.shop.id, [1, 2, 3, 4, 5, 6]);
  let res;
  try {
    res = await book({ jobDate: futureDate(0), email: 'lost@example.com' }, c);
  } finally {
    await setOpeningDays(owner.shop.id, typeof days === 'string' ? JSON.parse(days) : days);
  }
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.match(res.body.error, /closed/);
  assert.equal((await customerRow(customerId)).email, 'keep@example.com');
});

test('a guest booking for a service that is not available leaves no customer row behind', async () => {
  const count = () => runWithShop(owner.shop.id, async () =>
    Number((await prepare('SELECT COUNT(*) AS n FROM customers').get()).n));
  const before = await count();
  const res = await jsonRequest(server.baseUrl, null, `/api/portal/${owner.shop.slug}/bookings`, {
    method: 'POST',
    body: {
      mechanicId: sam, jobDate: nextDate(), startTime: '10:00', description: 'x',
      newBike: { make: 'T', model: 'B' }, serviceId: 999999999,
      guestName: 'Nobody', guestPhone: '07700 900777', updateChannel: 'sms', termsAccepted: true,
    },
  });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.match(res.body.error, /not available/);
  assert.equal(await count(), before, 'a customer row was created');
});
