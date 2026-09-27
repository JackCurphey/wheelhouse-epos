// "Waiting for you" (piece 12, decisions 3 and 5): new online bookings, change
// requests and customer cancellations, oldest first, each with what the
// diary needs to show it; a cancellation stays until someone marks it seen.
// Spec: docs/superpowers/specs/2026-09-27-book-server-12-change-cancel-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedJobTypes } from './helpers/bookable.js';
import { linkActions, bookOnline, setJob, dayMaker } from './helpers/linkActions.js';

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
  customer = await portalSignup(server.baseUrl, owner.shop.slug, { name: 'Wendy Waiting' });
  link = linkActions(server.baseUrl, owner.shop.slug);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const act = (id, action, body) => staff(`/api/workshop-jobs/${id}/${action}`, { method: 'POST', body });
const read = async (id) => (await staff(`/api/workshop-jobs/${id}`)).body;
const waiting = async () => {
  const res = await staff('/api/workshop-waiting');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body;
};
const itemFor = async (id) => (await waiting()).items.find((i) => i.jobId === id);
const book = (serviceIds = [types.repair]) => bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, {
  mechanicId: sam, jobDate: nextDay(), startTime: '10:00', serviceIds,
});

test('a new online booking is listed with what the diary needs', async () => {
  const booked = await book([types.repair, types.quick]);
  const list = await waiting();
  assert.equal(list.count, list.items.length);
  const item = list.items.find((i) => i.jobId === booked.id);
  const { services, ...itemWithoutServices } = item;
  assert.deepEqual(itemWithoutServices, {
    kind: 'new_booking',
    jobId: booked.id,
    reference: booked.reference,
    jobDate: booked.jobDate,
    startTime: '10:00',
    endTime: '11:30',
    mechanicId: sam,
    mechanicName: 'Sam',
    customerName: 'Wendy Waiting',
    serviceNames: ['Test repair', 'Test quick'],
    arrivedAt: (await read(booked.id)).createdAt,
  });
  assert.ok(services, 'services field exists');
});

test('a job staff made as pending is not listed', async () => {
  const made = await staff('/api/workshop-jobs', {
    method: 'POST', body: { title: 'Phoned in', jobDate: nextDay(), status: 'pending', mechanicId: sam, startTime: '12:00', endTime: '13:00' },
  });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  assert.equal(await itemFor(made.body.id), undefined);
});

test('a change request is listed with where the booking is and where the customer wants it', async () => {
  const booked = await book();
  assert.equal((await act(booked.id, 'accept', { version: 1 })).status, 200);
  const to = nextDay();
  assert.equal((await link.change(booked.code, { jobDate: to, mechanicId: alex, startTime: '14:00' })).status, 200);
  const item = await itemFor(booked.id);
  assert.equal(item.kind, 'change_request');
  assert.deepEqual(item.from, { jobDate: booked.jobDate, startTime: '10:00', endTime: '11:00', mechanicId: sam, mechanicName: 'Sam' });
  assert.deepEqual(item.to, { jobDate: to, startTime: '14:00', endTime: '15:00', mechanicId: alex, mechanicName: 'Alex' });
  // It arrived when the customer asked, after the booking was made.
  assert.ok(Date.parse(item.arrivedAt) > Date.parse((await read(booked.id)).createdAt), JSON.stringify(item));
});

test("a customer's cancellation is listed until someone marks it seen", async () => {
  const booked = await book();
  assert.equal((await link.cancel(booked.code)).status, 200);
  const job = await read(booked.id);
  assert.equal(job.cancelledBy, 'customer');
  const item = await itemFor(booked.id);
  assert.equal(item.kind, 'customer_cancelled');
  assert.equal(item.arrivedAt, job.cancelledAt);
  const seen = await act(booked.id, 'cancellation-seen', { version: job.version });
  assert.equal(seen.status, 200, JSON.stringify(seen.body));
  assert.ok(seen.body.cancellationSeenAt, 'cancellationSeenAt is set');
  assert.equal(await itemFor(booked.id), undefined);
});

test('a staff cancellation is never listed', async () => {
  const booked = await book();
  assert.equal((await act(booked.id, 'cancel', { version: 1 })).status, 200);
  assert.equal(await itemFor(booked.id), undefined);
});

test('the oldest arrival comes first, whatever its kind', async () => {
  const fresh = await book();
  const moving = await book();
  assert.equal((await act(moving.id, 'accept', { version: 1 })).status, 200);
  assert.equal((await link.change(moving.code, { jobDate: nextDay(), mechanicId: sam, startTime: '14:00' })).status, 200);
  const gone = await book();
  assert.equal((await link.cancel(gone.code)).status, 200);
  // Arrival times set apart (all after the pinned 1 Sep): the cancellation
  // arrived first, then the change request, then the new booking.
  await setJob(owner.shop.id, gone.id, "cancelled_at = '2026-09-08T09:00:00Z'");
  await setJob(owner.shop.id, moving.id, "requested_at = '2026-09-09T09:00:00Z'");
  await setJob(owner.shop.id, fresh.id, "created_at = '2026-09-10T09:00:00Z'");
  const mine = (await waiting()).items.filter((i) => [fresh.id, moving.id, gone.id].includes(i.jobId)).map((i) => i.jobId);
  assert.deepEqual(mine, [gone.id, moving.id, fresh.id]);
});

test('Seen needs the version staff last read', async () => {
  const booked = await book();
  assert.equal((await link.cancel(booked.code)).status, 200);
  const res = await act(booked.id, 'cancellation-seen', { version: 1 });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: 'This job changed while you were looking at it. Reload and try again.', code: 'stale' });
});

test("Seen is only for a customer's cancellation", async () => {
  const booked = await book();
  const res = await act(booked.id, 'cancellation-seen', { version: 1 });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: "Only a customer's cancellation can be marked as seen", code: 'illegal' });
});

test("another shop's waiting items never appear", async () => {
  const other = await staffSignup(server.baseUrl);
  try {
    const otherSam = await seedMechanic(other.shop.id, { name: 'Other Sam' });
    const otherCustomer = await portalSignup(server.baseUrl, other.shop.slug, { name: 'Other Customer' });
    const otherTypes = await seedJobTypes(other.shop.id);
    const otherBooked = await bookOnline(server.baseUrl, otherCustomer.cookie, other.shop.slug, {
      mechanicId: otherSam, jobDate: nextDay(), startTime: '10:00', serviceIds: [otherTypes.repair],
    });
    const mine = await waiting();
    assert.equal(mine.items.some((i) => i.jobId === otherBooked.id), false);
    const otherStaff = (path, options) => staffRequest(server.baseUrl, other.cookie, path, options);
    const theirs = await otherStaff('/api/workshop-waiting');
    assert.equal(theirs.status, 200, JSON.stringify(theirs.body));
    assert.equal(theirs.body.items.some((i) => i.jobId === otherBooked.id), true);
  } finally {
    await deleteTestShop(other.shop.id);
  }
});

test('a waiting item lists its services with ids, in order', async () => {
  const booked = await book([types.quick, types.repair]);
  const item = await itemFor(booked.id);
  assert.deepEqual(item.services.map((s) => s.id), [types.quick, types.repair]);
  assert.deepEqual(item.services.map((s) => s.name), item.serviceNames);
});

test("the job carries the customer's own description and bike note", async () => {
  const booked = await book();
  const job = await read(booked.id);
  assert.equal(job.customerDescription, 'Squeaky brakes');
  assert.equal(job.customerBikeNote, null);
});
