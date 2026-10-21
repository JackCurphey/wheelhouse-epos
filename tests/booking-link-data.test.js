// What the booking link tells the customer once the bike is in (Jack, 21 Oct,
// docs/decisions/2026-10-21-booking-page-stages.md; the contract in
// openspec/changes/archive/2026-10-21-booking-page-stages/design.md): how far
// the work is, when the bike came in and went, the expected ready day, the
// shop's address, phone and hours, and a 410 that says which job it was.
// The link's 30 days count from collection (build-plan Q8).
// Link calls in this file must stay under 30 (the limiter is per server).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer, TEST_CLOCK_PIN } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedJobTypes } from './helpers/bookable.js';
import { linkActions, bookOnline, dayMaker } from './helpers/linkActions.js';
import { shopToday } from '../server/clock.js';

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
  const details = await staff('/api/shop-details', { method: 'PUT', body: { address: '12 North Street, Bolton', phone: '01204 000000' } });
  assert.equal(details.status, 200, JSON.stringify(details.body));
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const act = async (id, action) => staff(`/api/workshop-jobs/${id}/${action}`, { method: 'POST', body: { version: (await staff(`/api/workshop-jobs/${id}`)).body.version } });
const setJob = (id, sql, ...args) => runWithShop(owner.shop.id, () => prepare(`UPDATE workshop_jobs SET ${sql} WHERE id = ?`).run(...args, id));
const book = async () => {
  const booked = await bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, { mechanicId: sam, jobDate: nextDay(), startTime: '10:00', serviceIds: [types.service] });
  assert.equal((await act(booked.id, 'accept')).status, 200);
  return booked;
};
const daysAgo = (n) => {
  const d = new Date(`${shopToday('Europe/London', new Date(TEST_CLOCK_PIN))}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
};

test('the link carries the work’s progress, the expected ready day and the shop’s details', async () => {
  const booked = await book();
  const before = (await link.read(booked.code)).body;
  assert.equal(before.workState, 'not_started');
  assert.equal(before.bookedInAt, null);
  assert.deepEqual(before.expectedReady, { date: before.jobDate, time: null });
  assert.equal(before.shop.address, '12 North Street, Bolton');
  assert.equal(before.shop.phone, '01204 000000');
  assert.equal(typeof before.shop.openingHours, 'string');
  assert.ok(before.shop.openingHours.length > 0);
  assert.equal((await act(booked.id, 'book-in')).status, 200);
  assert.equal((await act(booked.id, 'start')).status, 200);
  const after = (await link.read(booked.code)).body;
  assert.equal(after.workState, 'in_progress');
  assert.ok(Date.parse(after.bookedInAt) > 0, after.bookedInAt);
});

test('collecting records when; bringing the bike back clears it', async () => {
  const booked = await book();
  await act(booked.id, 'book-in');
  await act(booked.id, 'start');
  await staff(`/api/workshop-jobs/${booked.id}/finish`, { method: 'POST', body: { version: (await staff(`/api/workshop-jobs/${booked.id}`)).body.version, signedOffBy: sam } });
  assert.equal((await act(booked.id, 'collect')).status, 200);
  assert.ok(Date.parse((await link.read(booked.code)).body.collectedAt) > 0);
  const back = await act(booked.id, 'reopen-custody');
  assert.equal(back.status, 200, JSON.stringify(back.body));
  assert.equal((await link.read(booked.code)).body.collectedAt, null);
});

test('a collected bike’s link lasts 30 days from collection, then says which job and the shop', async () => {
  const booked = await book();
  await setJob(booked.id, "custody_state = 'collected', collected_at = ?", daysAgo(30));
  assert.equal((await link.read(booked.code)).status, 200);
  await setJob(booked.id, 'collected_at = ?', daysAgo(31));
  const gone = await link.read(booked.code);
  assert.equal(gone.status, 410);
  assert.equal(gone.body.error, 'This link has expired');
  assert.equal(gone.body.reason, 'collected');
  assert.match(gone.body.reference, /^WH-\d+$/);
  // Exactly these: nothing that identifies the customer.
  assert.deepEqual(gone.body, { error: 'This link has expired', reference: gone.body.reference, reason: 'collected', shop: { name: gone.body.shop.name, address: '12 North Street, Bolton', phone: '01204 000000' } });
  assert.match(gone.body.shop.name, /^North Street Cycles/);
});

test('a bike still in the shop keeps its link, however long ago it was booked', async () => {
  const booked = await book();
  await setJob(booked.id, "custody_state = 'in_shop', job_date = ?", daysAgo(40).slice(0, 10));
  assert.equal((await link.read(booked.code)).status, 200);
});

test('a booking whose bike never came in expires 30 days after its day, as never came in', async () => {
  const booked = await book();
  await setJob(booked.id, 'job_date = ?', daysAgo(31).slice(0, 10));
  const gone = await link.read(booked.code);
  assert.equal(gone.status, 410);
  assert.deepEqual(Object.keys(gone.body).sort(), ['error', 'reason', 'reference', 'shop']);
  assert.equal(gone.body.reason, 'never_came_in');
  assert.match(gone.body.reference, /^WH-\d+$/);
  assert.deepEqual(Object.keys(gone.body.shop).sort(), ['address', 'name', 'phone']);
});

// Fresh review, 21 Oct.
test('a waiting-for-parts job made with the bike already here records when it came in', async () => {
  const made = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Wobbly wheel', jobDate: nextDay(), startTime: '10:00', endTime: '11:00', mechanicId: sam, status: 'waiting_parts' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const row = await runWithShop(owner.shop.id, () => prepare('SELECT custody_state, booked_in_at FROM workshop_jobs WHERE id = ?').get(made.body.id));
  assert.equal(row.custody_state, 'in_shop');
  assert.ok(row.booked_in_at !== null, 'booked in when made');
});

test('collection late in the evening counts by the shop’s own date', async () => {
  const booked = await book();
  // 23:30 UTC in British Summer Time is 00:30 the next day in the shop: the
  // link's 30 days start from that next day.
  const shopDay = shopToday('Europe/London', new Date(TEST_CLOCK_PIN));
  const d = new Date(`${shopDay}T23:30:00Z`);
  d.setUTCDate(d.getUTCDate() - 31);
  await setJob(booked.id, "custody_state = 'collected', collected_at = ?", d.toISOString());
  assert.equal((await link.read(booked.code)).status, 200, 'on the shop’s date it was collected 30 days ago');
});

test('a booking that ended, or a bike already collected, has no ready day', async () => {
  const booked = await book();
  await setJob(booked.id, "custody_state = 'collected', collected_at = now()");
  assert.equal((await link.read(booked.code)).body.expectedReady, null);
});

// What was done, what was declined, what's left to pay and what's been paid
// (cp-summary's "What we did" and pay card; Jack, 21 Oct, booking page stages
// answer 4: with Show prices off the figures are hidden and everything else shows).
const orderOf = async (id) => (await staff(`/api/workshop-jobs/${id}`)).body.orderId;
const setPrices = async (on) => assert.equal((await staff('/api/workshop-settings', { method: 'PUT', body: { showPricesOnline: on } })).status, 200);
async function readyJob() {
  const booked = await book();
  await act(booked.id, 'book-in');
  const orderId = await orderOf(booked.id);
  const items = await staff(`/api/sale-documents/${orderId}/items`, { method: 'PUT', body: { items: [{ lineType: 'labour', name: 'Standard service', unitPrice: 65, minutes: 60 }, { lineType: 'labour', name: 'Fit & adjust brakes', unitPrice: 18, minutes: 20 }] } });
  assert.equal(items.status, 200, JSON.stringify(items.body));
  return { booked, orderId };
}

test('the link lists the work on the job and what is left to pay, with the figures when prices show', async () => {
  await setPrices(true);
  const { booked } = await readyJob();
  const body = (await link.read(booked.code)).body;
  assert.deepEqual(body.work, [{ name: 'Standard service', price: 65 }, { name: 'Fit & adjust brakes', price: 18 }]);
  assert.equal(body.toPay, 83);
  assert.equal(body.paid, null);
  assert.deepEqual(body.declined, []);
});

test('with prices hidden the work and its lines still show, without figures', async () => {
  await setPrices(false);
  const { booked } = await readyJob();
  const body = (await link.read(booked.code)).body;
  assert.deepEqual(body.work, [{ name: 'Standard service', price: null }, { name: 'Fit & adjust brakes', price: null }]);
  assert.equal(body.toPay, null);
});

test('declined quote lines are listed; once paid, the payment shows and nothing is left to pay', async () => {
  await setPrices(true);
  const { booked, orderId } = await readyJob();
  const quote = await staff(`/api/workshop-jobs/${booked.id}/quotes`, { method: 'POST', body: { lines: [{ kind: 'labour', description: 'Replace gear cable', unitAmount: 12, need: 'optional' }] } });
  assert.ok(quote.status < 300, JSON.stringify(quote.body));
  await runWithShop(owner.shop.id, () => prepare(
    "UPDATE workshop_quotes SET state = 'declined' WHERE workshop_job_id = ?").run(booked.id));
  await runWithShop(owner.shop.id, () => prepare(
    "UPDATE workshop_quote_lines SET decision = 'declined' WHERE workshop_quote_id IN (SELECT id FROM workshop_quotes WHERE workshop_job_id = ?)").run(booked.id));
  assert.deepEqual((await link.read(booked.code)).body.declined, [{ name: 'Replace gear cable', price: 12 }]);
  const made = await staff('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${Date.now()}@example.test`, password: 'password123' } });
  await act(booked.id, 'start');
  const paid = await staff(`/api/sale-documents/${orderId}/convert`, { method: 'POST', body: { cardAmount: 83, cashierId: made.body.employeeId, signedOffBy: null } });
  assert.equal(paid.status, 201, JSON.stringify(paid.body));
  const after = (await link.read(booked.code)).body;
  assert.equal(after.toPay, null);
  assert.equal(after.paid.amount, 83);
  assert.ok(Date.parse(after.paid.at) > 0);
});
