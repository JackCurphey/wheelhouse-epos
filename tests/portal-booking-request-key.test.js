// WP-0.2: the server accepts each booking request once. A retry carrying the
// same request key gets the booking already made, with a fresh private link,
// rather than a second job. Also the body that isn't a JSON object.
// Spec: docs/superpowers/specs/2026-10-05-wp-0-2-booking-bugs-server.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, seedMechanic } from './helpers/staff.js';
import { portalSignup, portalRequest } from './helpers/portal.js';
import { jsonRequest } from './helpers/http.js';
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

const bookingBody = (over = {}) => ({
  mechanicId: sam, jobDate: nextDate(), startTime: '10:00', description: 'Squeaky brakes',
  serviceIds: [types.service], ...BOOKING_CONTACT, ...over,
});
const send = (body, cookie = customer.cookie) =>
  portalRequest(server.baseUrl, cookie, `/api/portal/${owner.shop.slug}/bookings`, { method: 'POST', body });
const readLink = (privateLink) =>
  jsonRequest(server.baseUrl, null, `/api/portal/${owner.shop.slug}/booking-links/${privateLink.split('/').pop()}`);
const jobsWithReference = (reference) => runWithShop(owner.shop.id, () =>
  prepare('SELECT count(*)::int AS n FROM workshop_jobs WHERE reference = ?').get(reference));
const jobsOn = (jobDate) => runWithShop(owner.shop.id, () =>
  prepare('SELECT count(*)::int AS n FROM workshop_jobs WHERE job_date = ?').get(jobDate));
const customerCount = () => runWithShop(owner.shop.id, () => prepare('SELECT count(*)::int AS n FROM customers').get());

test('a retry with the same key gets the booking already made, with a new link, and no second job', async () => {
  const body = bookingBody({ requestKey: randomUUID() });
  const first = await send(body);
  assert.equal(first.status, 201, JSON.stringify(first.body));

  const again = await send(body);
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.equal(again.body.reference, first.body.reference);
  assert.equal(again.body.id, first.body.id);
  assert.deepEqual(again.body.services, first.body.services);
  assert.notEqual(again.body.privateLink, first.body.privateLink);
  assert.equal((await jobsOn(body.jobDate)).n, 1);
  assert.equal((await jobsWithReference(first.body.reference)).n, 1);

  // Only the link's hash is kept, so the new link replaces the first.
  assert.equal((await readLink(again.body.privateLink)).status, 200);
  assert.equal((await readLink(first.body.privateLink)).status, 404);
});

test('a guest retry makes no second customer', async () => {
  const body = bookingBody({ requestKey: randomUUID(), guestName: 'Gina Guest', guestPhone: '07700 900123' });
  const first = await send(body, null);
  assert.equal(first.status, 201, JSON.stringify(first.body));
  const customersAfterFirst = (await customerCount()).n;
  const again = await send(body, null);
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.equal(again.body.reference, first.body.reference);
  assert.equal((await customerCount()).n, customersAfterFirst);
});

test('the same key with different details is refused, and nothing is written', async () => {
  const requestKey = randomUUID();
  const first = await send(bookingBody({ requestKey }));
  assert.equal(first.status, 201, JSON.stringify(first.body));
  const other = bookingBody({ requestKey });
  const res = await send(other);
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: 'This booking was already sent with different details', code: 'reused_key' });
  assert.equal((await jobsOn(other.jobDate)).n, 0);
});

test('a request key that breaks the rule is refused', async () => {
  for (const requestKey of ['short', 'x'.repeat(129), 'has spaces in it, sixteen+', 42, null]) {
    const res = await send(bookingBody({ requestKey }));
    assert.equal(res.status, 400, `${JSON.stringify(requestKey)}: ${JSON.stringify(res.body)}`);
    assert.deepEqual(res.body, { error: 'Invalid request key' });
  }
});

test('with no key, sending twice still books twice (today\'s screens send none)', async () => {
  const jobDate = nextDate();
  const a = await send(bookingBody({ jobDate, startTime: '10:00' }));
  const b = await send(bookingBody({ jobDate, startTime: '13:00' }));
  assert.equal(a.status, 201, JSON.stringify(a.body));
  assert.equal(b.status, 201, JSON.stringify(b.body));
  assert.notEqual(a.body.reference, b.body.reference);
});

test('a body that is not a JSON object is refused, not a 500', async () => {
  for (const body of [null, [], 7, 'a booking']) {
    const res = await send(body);
    assert.equal(res.status, 400, `${JSON.stringify(body)}: ${JSON.stringify(res.body)}`);
    assert.deepEqual(res.body, { error: 'Invalid request body' });
  }
});

test('two retries arriving at once make one booking', async () => {
  const body = bookingBody({ requestKey: randomUUID() });
  const replies = await Promise.all([send(body), send(body), send(body)]);
  assert.deepEqual(replies.map((r) => r.status).sort(), [200, 200, 201], JSON.stringify(replies.map((r) => r.body)));
  assert.equal(new Set(replies.map((r) => r.body.reference)).size, 1);
  assert.equal((await jobsOn(body.jobDate)).n, 1);
});

test('the same key sent at once for two different days makes one booking', async () => {
  const requestKey = randomUUID();
  const a = bookingBody({ requestKey });
  const b = bookingBody({ requestKey });
  const replies = await Promise.all([send(a), send(b)]);
  assert.deepEqual(replies.map((r) => r.status).sort(), [201, 409], JSON.stringify(replies.map((r) => r.body)));
  assert.equal(replies.find((r) => r.status === 409).body.code, 'reused_key');
  assert.equal((await jobsOn(a.jobDate)).n + (await jobsOn(b.jobDate)).n, 1);
});
