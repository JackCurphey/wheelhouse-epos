// Several services in one booking.
// Spec: docs/superpowers/specs/2026-09-26-book-server-7-multiple-services-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup, portalRequest } from './helpers/portal.js';
import { jsonRequest } from './helpers/http.js';
import { deleteTestShop } from './helpers/testShop.js';
import { futureDate } from './helpers/workshopFixtures.js';
import { BOOKING_CONTACT } from './helpers/bookable.js';

let server;
let owner;
let sam;
let customer;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
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

const setShowPrices = async (on) => {
  const res = await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-settings', {
    method: 'PUT', body: { showPricesOnline: on },
  });
  assert.equal(res.body.showPricesOnline, on, JSON.stringify(res.body));
};

const GUEST = { guestName: 'Gina Guestname', guestPhone: '07700 900123', email: 'gina@example.com' };

// Signed in as customer by default, so the guest limit is never reached;
// { guest: true } books as a guest instead, for tests that check a refusal
// leaves no guest customer row behind.
const book = async (body = {}, { guest = false } = {}) => {
  const res = await portalRequest(server.baseUrl, guest ? null : customer.cookie, `/api/portal/${owner.shop.slug}/bookings`, {
    method: 'POST',
    body: {
      mechanicId: sam, jobDate: nextDate(), startTime: '09:00', description: 'Squeaky brakes',
      newBike: { make: 'Dawes', model: 'Galaxy' }, ...BOOKING_CONTACT, ...(guest ? GUEST : {}), ...body,
    },
  });
  return res;
};
const codeOf = (privateLink) => privateLink.split('/').pop();
const read = (code) => jsonRequest(server.baseUrl, null, `/api/portal/${owner.shop.slug}/booking-links/${code}`);
const counts = () => runWithShop(owner.shop.id, () => prepare(
  'SELECT (SELECT count(*)::int FROM workshop_jobs) AS jobs, (SELECT count(*)::int FROM customers) AS customers'
).get());

const svc = (name, price, minutes, questions = []) => runWithShop(owner.shop.id, async () =>
  (await prepare(
    "INSERT INTO workshop_services (name, price, minutes, questions, bookable_online, active, updated_at) VALUES (?, ?, ?, CAST(? AS jsonb), 1, 1, now())"
  ).run(name, price, minutes, JSON.stringify(questions))).lastInsertRowid);

const rows = (jobId) => runWithShop(owner.shop.id, () => prepare(
  'SELECT service_id, booked_price::text AS price, position FROM workshop_job_services WHERE workshop_job_id = ? ORDER BY position'
).all(jobId));
const job = (jobId) => runWithShop(owner.shop.id, () => prepare(
  'SELECT title, planned_minutes, start_time, end_time, question_answers FROM workshop_jobs WHERE id = ?').get(jobId));

test('two services: both saved in order with their prices, time summed, names in the title', async () => {
  const bleed = await svc('Brake bleed', '35.00', 45);
  const truing = await svc('Wheel true', '25.00', 30);
  const res = await book({ serviceIds: [bleed, truing] });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual(await rows(res.body.id), [
    { service_id: bleed, price: '35.00', position: 0 },
    { service_id: truing, price: '25.00', position: 1 },
  ]);
  const j = await job(res.body.id);
  assert.equal(j.planned_minutes, 75);
  assert.equal(j.end_time, '10:15');
  assert.match(j.title, /^Online booking: Brake bleed \+ Wheel true - /);
});

test('more than 12 hours of work is refused and nothing is saved', async () => {
  const long = await svc('Rebuild', '300.00', 400);
  const longer = await svc('Respray', '300.00', 400);
  const before = await counts();
  const res = await book({ serviceIds: [long, longer] }, { guest: true });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "That's too much work for one visit - please book the jobs separately");
  assert.deepEqual(await counts(), before);
});

test('a service that is not bookable anywhere in the list refuses the booking', async () => {
  const ok = await svc('Fine', '10.00', 30);
  const hidden = await runWithShop(owner.shop.id, async () => (await prepare(
    "INSERT INTO workshop_services (name, price, minutes, bookable_online, active, updated_at) VALUES ('Staff only', 10, 30, 0, 1, now())").run()).lastInsertRowid);
  const res = await book({ serviceIds: [ok, hidden] });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'That service is not available to book');
});

test('each service\'s required questions are enforced, and answers carry their service', async () => {
  const q = (id, wording) => ({ id, wording, kind: 'text', required: true });
  const a = await svc('A', '10.00', 30, [q('q_aaaaaaaaaaaa', 'Which wheel?')]);
  const b = await svc('B', '10.00', 30, [q('q_bbbbbbbbbbbb', 'Which brake?')]);
  const missing = await book({ serviceIds: [a, b], answers: [{ serviceId: a, questionId: 'q_aaaaaaaaaaaa', text: 'Front' }] });
  assert.equal(missing.status, 400);
  assert.equal(missing.body.error, 'Please answer: Which brake?');
  const ok = await book({ serviceIds: [a, b], answers: [
    { serviceId: a, questionId: 'q_aaaaaaaaaaaa', text: 'Front' },
    { serviceId: b, questionId: 'q_bbbbbbbbbbbb', text: 'Rear' },
  ] });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  const saved = (await job(ok.body.id)).question_answers;
  assert.deepEqual(saved.map((x) => [x.serviceId, x.id, x.answer]), [[a, 'q_aaaaaaaaaaaa', 'Front'], [b, 'q_bbbbbbbbbbbb', 'Rear']]);
});

test('an answer for a service that was not chosen is refused', async () => {
  const a = await svc('Solo', '10.00', 30);
  const res = await book({ serviceIds: [a], answers: [{ serviceId: a + 99999, questionId: 'q_cccccccccccc', text: 'x' }] });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "Those answers don't match the services chosen");
});

test('an answer with no serviceId is refused', async () => {
  const a = await svc('Solo', '10.00', 30);
  const res = await book({ serviceIds: [a], answers: [{ questionId: 'q_cccccccccccc', text: 'x' }] });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "Those answers don't match the services chosen");
});

test('the reply and the link list each service with its price, and the total', async () => {
  await setShowPrices(true);
  const bleed = await svc('Brake bleed', '35.00', 45);
  const truing = await svc('Wheel true', '25.50', 30);
  const booked = await book({ serviceIds: [bleed, truing] });
  const expected = { services: [{ name: 'Brake bleed', price: 35 }, { name: 'Wheel true', price: 25.5 }], totalPrice: 60.5 };
  assert.deepEqual({ services: booked.body.services, totalPrice: booked.body.totalPrice }, expected);
  const link = await read(codeOf(booked.body.privateLink));
  assert.deepEqual({ services: link.body.services, totalPrice: link.body.totalPrice }, expected);
  assert.equal('bookedPrice' in booked.body, false);
  assert.equal('serviceName' in link.body, false);
});

test('with prices hidden, names show and every price is null', async () => {
  await setShowPrices(false);
  const a = await svc('Hidden A', '10.00', 30);
  const booked = await book({ serviceIds: [a] });
  assert.deepEqual(booked.body.services, [{ name: 'Hidden A', price: null }]);
  assert.equal(booked.body.totalPrice, null);
});

// workshop_services.price is NOT NULL (migration 014), so an unpriced service
// cannot exist in this schema - the "any chosen service unpriced -> no total"
// rule is unreachable through this route. bookedServices still implements it
// (count(booked_price) = count(*)); see task-3-report.md.

test('not sure has no services and no total', async () => {
  await setShowPrices(true);
  const booked = await book({ notSure: true });
  assert.deepEqual(booked.body.services, []);
  assert.equal(booked.body.totalPrice, null);
});

test('a full service and a service it includes can still be booked together', async () => {
  const part = await svc('Included brake', '25.00', 30);
  const full = await runWithShop(owner.shop.id, async () => (await prepare(
    "INSERT INTO workshop_services (name, price, minutes, kind, bookable_online, active, updated_at) VALUES ('Full with brake', '80.00', 90, 'full', 1, 1, now())"
  ).run()).lastInsertRowid);
  await runWithShop(owner.shop.id, () => prepare(
    'INSERT INTO workshop_service_includes (service_id, included_service_id, position) VALUES (?, ?, 0)'
  ).run(full, part));
  const res = await book({ serviceIds: [full, part] });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual((await rows(res.body.id)).map((r) => r.service_id), [full, part]);
});
