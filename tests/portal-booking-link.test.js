// The private booking link: issued on booking, read back without sign-in.
// Spec: docs/superpowers/specs/2026-09-25-book-server-4-guest-link-design.md
// Keep this file under 30 lookups: the limiter is per server, one per file.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
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
      newBike: { make: 'Dawes', model: 'Galaxy' }, serviceId: types.service,
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
    serviceName: 'Test service',
    description: 'Squeaky brakes',
    bike: { make: 'Dawes', model: 'Galaxy' },
    stage: 'awaiting_confirmation',
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

test('the read-back carries no name, phone, email, price or notes', async () => {
  const booked = await book({}, { guest: true });
  await setJob(booked.id, "notes = 'STAFF-ONLY-REMARK'");
  const res = await read(codeOf(booked.privateLink));
  const text = JSON.stringify(res.body);
  for (const secret of ['Gina', '07700', 'gina@example.com', '10.00', 'STAFF-ONLY-REMARK']) {
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

test('a not-sure booking has no service name', async () => {
  const booked = await book({ serviceId: undefined, notSure: true });
  assert.equal((await read(codeOf(booked.privateLink))).body.serviceName, null);
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

const daysAgo = (n) => {
  const d = new Date();
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
  assert.equal((await read(codeOf(booked.privateLink))).status, 404);
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
