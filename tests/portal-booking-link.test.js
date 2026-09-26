// The private booking link: issued on booking, read back without sign-in.
// Spec: docs/superpowers/specs/2026-09-25-book-server-4-guest-link-design.md
// Keep this file under 30 lookups: the limiter is per server, one per file.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer, TEST_CLOCK_PIN } from './helpers/liveServer.js';
import { shopToday } from '../server/clock.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup, portalRequest } from './helpers/portal.js';
import { jsonRequest } from './helpers/http.js';
import { deleteTestShop } from './helpers/testShop.js';
import { futureDate, seedWorkshopJob } from './helpers/workshopFixtures.js';
import { seedJobTypes, BOOKING_CONTACT } from './helpers/bookable.js';
import { hashLinkCode } from '../server/booking-link.js';

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
const nextDate = () => {
  const n = day++;
  const d = new Date(`${futureDate(1 + (n % 5))}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7 * Math.floor(n / 5));
  return d.toISOString().slice(0, 10);
};

const GUEST = { guestName: 'Gina Guestname', guestPhone: '07700 900123', email: 'gina@example.com' };

// A booking; signed in by default (as customer), or as a guest with { guest: true } -
// guest bookings are rate-limited per IP, so only tests that need the guest path use it.
const book = async (body = {}, { guest = false } = {}) => {
  const res = await portalRequest(server.baseUrl, guest ? null : customer.cookie, `/api/portal/${owner.shop.slug}/bookings`, {
    method: 'POST',
    body: {
      mechanicId: sam, jobDate: nextDate(), startTime: '10:00', description: 'Squeaky brakes',
      newBike: { make: 'Dawes', model: 'Galaxy' }, serviceIds: [types.service],
      ...BOOKING_CONTACT, ...(guest ? GUEST : {}), ...body,
    },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
};
const codeOf = (privateLink) => privateLink.split('/').pop();
const read = (code, slug = owner.shop.slug) =>
  jsonRequest(server.baseUrl, null, `/api/portal/${slug}/booking-links/${code}`);
const setJob = (id, sql, ...args) => runWithShop(owner.shop.id, () => prepare(`UPDATE workshop_jobs SET ${sql} WHERE id = ?`).run(...args, id));

test('a booking returns a private link, and the link reads the booking back', async () => {
  const booked = await book({}, { guest: true });
  assert.match(booked.privateLink, new RegExp(`^/book/${owner.shop.slug}/booking/[0-9a-f]{64}$`));
  const res = await read(codeOf(booked.privateLink));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body, {
    reference: booked.reference,
    shopName: owner.shop.name,
    jobDate: booked.jobDate,
    startTime: '10:00',
    description: 'Squeaky brakes',
    bikeNote: null,
    bike: { make: 'Dawes', model: 'Galaxy' },
    stage: 'awaiting_confirmation',
    answers: [],
    photoCount: 0,
    services: [{ name: 'Test service', price: null }],
    totalPrice: null,
  });
});

test('the database holds the hash, never the code', async () => {
  const booked = await book();
  const code = codeOf(booked.privateLink);
  const row = await runWithShop(owner.shop.id, () => prepare(
    'SELECT link_token_hash, (w::text LIKE ?) AS leaks FROM workshop_jobs w WHERE id = ?'
  ).get(`%${code}%`, booked.id));
  assert.equal(row.link_token_hash, hashLinkCode(code));
  assert.equal(row.leaks, false);
});

test('the read-back carries no name, phone, email or notes, and price only inside services/totalPrice', async () => {
  const booked = await book({}, { guest: true });
  await setJob(booked.id, "notes = 'STAFF-ONLY-REMARK'");
  const res = await read(codeOf(booked.privateLink));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  // The filter checks top-level keys only - 'services' holds a 'name' per
  // entry, but that's inside the array, not a top-level key, so it's fine.
  const leakyKeys = Object.keys(res.body).filter(
    (k) => /price|name|phone|email|notes/i.test(k) && !['shopName', 'services', 'totalPrice'].includes(k)
  );
  assert.deepEqual(leakyKeys, [], `unexpected keys: ${JSON.stringify(res.body)}`);
  const text = JSON.stringify(res.body);
  for (const secret of ['Gina', '07700', 'gina@example.com', 'STAFF-ONLY-REMARK']) {
    assert.ok(!text.includes(secret), `leaks ${secret}: ${text}`);
  }
});

test('a staff edit of the notes does not change the description', async () => {
  const booked = await book();
  const edit = await staffRequest(server.baseUrl, owner.cookie, `/api/workshop-jobs/${booked.id}`, {
    method: 'PUT', body: { notes: 'Rewritten by staff' },
  });
  assert.equal(edit.status, 200, JSON.stringify(edit.body));
  assert.equal((await read(codeOf(booked.privateLink))).body.description, 'Squeaky brakes');
});

test('a not-sure booking has no services', async () => {
  const booked = await book({ serviceIds: undefined, notSure: true });
  assert.deepEqual((await read(codeOf(booked.privateLink))).body.services, []);
});

test('the stage follows the job', async () => {
  const booked = await book();
  await setJob(booked.id, "booking_state = 'scheduled', custody_state = 'in_shop', work_state = 'complete'");
  assert.equal((await read(codeOf(booked.privateLink))).body.stage, 'ready_to_collect');
});

test("a made-up code and another shop's code get the same 404", async () => {
  const booked = await book();
  const madeUp = await read('0'.repeat(64));
  const wrongShop = await read(codeOf(booked.privateLink), other.shop.slug);
  assert.equal(madeUp.status, 404);
  assert.equal(wrongShop.status, 404);
  assert.deepEqual(madeUp.body, { error: "We can't find that booking" });
  assert.deepEqual(wrongShop.body, madeUp.body);
});

test('a malformed code gets the same 404, never a 500', async () => {
  const tooLongUpper = 'A'.repeat(64);
  const tooShortLower = '0'.repeat(63);
  const upper = await read(tooLongUpper);
  const short = await read(tooShortLower);
  assert.equal(upper.status, 404);
  assert.equal(short.status, 404);
  assert.deepEqual(upper.body, { error: "We can't find that booking" });
  assert.deepEqual(short.body, upper.body);
});

// Counted back from the shop's today on the server's pinned clock (UK time).
const daysAgo = (n) => {
  const d = new Date(`${shopToday('Europe/London', new Date(TEST_CLOCK_PIN))}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

test('31 days after the booked date the link has expired; moving the date revives it', async () => {
  const booked = await book();
  const code = codeOf(booked.privateLink);
  await setJob(booked.id, 'job_date = ?', daysAgo(31));
  const expired = await read(code);
  assert.equal(expired.status, 410);
  assert.deepEqual(expired.body, { error: 'This link has expired' });
  await setJob(booked.id, 'job_date = ?', daysAgo(30));
  assert.equal((await read(code)).status, 200);
});

const newLink = (id, who = owner) =>
  staffRequest(server.baseUrl, who?.cookie ?? null, `/api/workshop-jobs/${id}/private-link`, { method: 'POST', body: {} });

test('staff make a new link; the old one stops working', async () => {
  const booked = await book();
  const res = await newLink(booked.id);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.notEqual(res.body.privateLink, booked.privateLink);
  assert.equal((await read(codeOf(res.body.privateLink))).status, 200);
  const stale = await read(codeOf(booked.privateLink));
  assert.equal(stale.status, 404);
  assert.deepEqual(stale.body, { error: "We can't find that booking" });
});

test("staff cannot make a link for another shop's job", async () => {
  const booked = await book();
  assert.equal((await newLink(booked.id, other)).status, 404);
});

test('a job with no customer gets no link', async () => {
  const { jobId } = await seedWorkshopJob({ shopId: owner.shop.id, customerId: null });
  const res = await newLink(jobId);
  assert.equal(res.status, 400, JSON.stringify(res.body));
});

test('making a link needs a staff sign-in', async () => {
  const booked = await book();
  assert.equal((await newLink(booked.id, null)).status, 401);
});

test('the link shows the questions as asked and the answers', async () => {
  const svc = (await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-services', {
    method: 'POST',
    body: {
      name: 'Asks', price: 10, minutes: 60, bookableOnline: true,
      questions: [{ wording: 'E-bike?', kind: 'choice', choices: ['Yes', 'No'] }, { wording: 'Notes?', kind: 'text' }],
    },
  })).body;
  const booked = await book({ serviceIds: [svc.id], answers: [{ serviceId: svc.id, questionId: svc.questions[0].id, notSure: true }] });
  const res = await read(codeOf(booked.privateLink));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.answers, [
    { wording: 'E-bike?', answer: { notSure: true } },
    { wording: 'Notes?', answer: null },
  ]);
});

test('the link read-back returns the bike note and each answer\'s typed words', async () => {
  const svc = (await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-services', {
    method: 'POST',
    body: {
      name: 'Asks2', price: 10, minutes: 60, bookableOnline: true,
      questions: [{ wording: 'E-bike?', kind: 'choice', choices: ['Yes', 'No'] }],
    },
  })).body;
  const booked = await book({
    bikeNote: 'Red hybrid, disc brakes',
    serviceIds: [svc.id],
    answers: [{ serviceId: svc.id, questionId: svc.questions[0].id, text: 'Think so, not certain' }],
  });
  const res = await read(codeOf(booked.privateLink));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.bikeNote, 'Red hybrid, disc brakes');
  assert.deepEqual(res.body.answers, [
    { wording: 'E-bike?', answer: null, text: 'Think so, not certain' },
  ]);
});

test('the link read-back has a null bike note when none was given', async () => {
  const booked = await book();
  const res = await read(codeOf(booked.privateLink));
  assert.equal(res.body.bikeNote, null);
});
