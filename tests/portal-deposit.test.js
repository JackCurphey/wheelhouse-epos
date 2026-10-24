// A booking's deposit, held then taken once the booking is saved (Jack, 24 Oct
// answers 1–5; openspec/changes/deposit-payments design 3–5). The pretend
// provider (PAYMENTS_PROVIDER=pretend, as liveServer sets) and its test cards.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { tryBooking, dayMaker, jobRow } from './helpers/linkActions.js';

let server;
let owner;
let other;
let sam;
let customer;
let service;
let extra;
const nextDay = dayMaker();

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Deposit Booking Cycles' });
  other = await staffSignup(server.baseUrl, { shopName: 'Other Deposit Cycles' });
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
  [service, extra] = await runWithShop(owner.shop.id, async () => [
    (await prepare("INSERT INTO workshop_services (name, price, minutes, bookable_online, active, updated_at) VALUES ('Standard service', 65, 60, 1, 1, now()) RETURNING id").get()).id,
    (await prepare("INSERT INTO workshop_services (name, price, minutes, bookable_online, active, updated_at) VALUES ('Brake bleed', 12.5, 30, 1, 1, now()) RETURNING id").get()).id,
  ]);
  await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-settings', { method: 'PUT', body: { depositOn: true, depositKind: 'percent', depositPercent: 20, depositCancelHours: 24 } });
});
after(async () => {
  for (const s of [owner, other]) if (s) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const key = () => randomBytes(32).toString('base64url');
const portal = (path, body, shop = owner) => fetch(`${server.baseUrl}/api/portal/${shop.shop.slug}${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: customer.cookie }, body: JSON.stringify(body),
}).then(async (r) => ({ status: r.status, body: await r.json() }));
const hold = (body, shop) => portal('/deposit-holds', body, shop);
const card = (ref, cardNumber = '4242 4242 4242 4242') => portal(`/pretend-payments/${ref}/card`, { cardNumber });
const book = (body) => tryBooking(server.baseUrl, customer.cookie, owner.shop.slug, { mechanicId: sam, startTime: '10:00', ...body });
const pretendStatus = (ref) => runWithShop(owner.shop.id, () => prepare('SELECT status FROM pretend_payments WHERE ref = ?').get(ref)).then((r) => r.status);
const payment = (id) => runWithShop(owner.shop.id, () => prepare('SELECT * FROM online_payments WHERE id = ?').get(id));
async function paid(serviceIds, requestKey = key()) {
  const h = await hold({ serviceIds, requestKey });
  assert.equal(h.status, 200, JSON.stringify(h.body));
  assert.equal((await card(h.body.ref)).status, 200);
  return { requestKey, ...h.body };
}

test('a hold is worked out on the stored prices: 20% of £65.00 and £12.50 is £15.50', async () => {
  const h = await hold({ serviceIds: [service, extra], requestKey: key() });
  assert.equal(h.status, 200, JSON.stringify(h.body));
  assert.equal(h.body.depositPence, 1550);
  assert.equal(h.body.provider, 'pretend');
  assert.equal(await pretendStatus(h.body.ref), 'waiting');
});

test('the same request key answers the same hold; another amount lets the first go', async () => {
  const requestKey = key();
  const a = await hold({ serviceIds: [service], requestKey });
  const b = await hold({ serviceIds: [service], requestKey });
  assert.equal(a.body.paymentId, b.body.paymentId);
  assert.equal(a.body.ref, b.body.ref);
  const c = await hold({ serviceIds: [service, extra], requestKey });
  assert.equal(c.body.depositPence, 1550);
  assert.notEqual(c.body.ref, a.body.ref);
  assert.equal(await pretendStatus(a.body.ref), 'released');
});

test('paid and booked: the deposit and when it’s free to cancel until are kept, and only then is it taken', async () => {
  const day = nextDay();
  const p = await paid([service]);
  assert.equal(p.depositPence, 1300);
  const res = await book({ jobDate: day, serviceIds: [service], requestKey: p.requestKey, paymentId: p.paymentId });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const job = await jobRow(owner.shop.id, res.body.id);
  assert.equal(job.deposit_pence, 1300);
  const until = await runWithShop(owner.shop.id, () => prepare("SELECT (?::date + time '10:00') AT TIME ZONE 'Europe/London' - interval '24 hours' AS t").get(day));
  assert.equal(new Date(job.deposit_cancel_until).toISOString(), new Date(until.t).toISOString());
  assert.equal(await pretendStatus(p.ref), 'taken');
  const row = await payment(p.paymentId);
  assert.deepEqual([row.job_id, row.status], [res.body.id, 'taken']);
});

test('sent again after a dropped connection: the booking already made, taken once', async () => {
  const p = await paid([service]);
  const body = { jobDate: nextDay(), serviceIds: [service], requestKey: p.requestKey, paymentId: p.paymentId };
  const first = await book(body);
  assert.equal(first.status, 201);
  const again = await book(body);
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.equal(again.body.id, first.body.id);
  assert.equal(await pretendStatus(p.ref), 'taken');
});

test('no held deposit: refused, saying so, and nothing is booked', async () => {
  const before = await runWithShop(owner.shop.id, () => prepare('SELECT count(*)::int AS n FROM workshop_jobs').get());
  const none = await book({ jobDate: nextDay(), serviceIds: [service], requestKey: key() });
  assert.equal(none.status, 400, JSON.stringify(none.body));
  assert.equal(none.body.code, 'deposit_needed');
  const waiting = await hold({ serviceIds: [service], requestKey: key() });
  const unpaid = await book({ jobDate: nextDay(), serviceIds: [service], paymentId: waiting.body.paymentId });
  assert.equal(unpaid.status, 400, 'no request key, no deposit');
  const after = await runWithShop(owner.shop.id, () => prepare('SELECT count(*)::int AS n FROM workshop_jobs').get());
  assert.equal(after.n, before.n);
});

test('a hold not paid, someone else’s, or for other services: refused, nothing booked, nothing taken', async () => {
  const requestKey = key();
  const waiting = await hold({ serviceIds: [service], requestKey });
  const notHeld = await book({ jobDate: nextDay(), serviceIds: [service], requestKey, paymentId: waiting.body.paymentId });
  assert.equal(notHeld.status, 402, JSON.stringify(notHeld.body));
  assert.equal(notHeld.body.code, 'deposit_not_held');

  const theirs = await paid([service]);
  const stolen = await book({ jobDate: nextDay(), serviceIds: [service], requestKey: key(), paymentId: theirs.paymentId });
  assert.equal(stolen.status, 400, JSON.stringify(stolen.body));
  assert.equal(stolen.body.code, 'deposit_needed');
  assert.equal(await pretendStatus(theirs.ref), 'held', 'not taken, and still theirs');

  const small = await paid([extra]);
  const more = await book({ jobDate: nextDay(), serviceIds: [service, extra], requestKey: small.requestKey, paymentId: small.paymentId });
  assert.equal(more.status, 409, JSON.stringify(more.body));
  assert.equal(more.body.code, 'deposit_changed');
});

test('a declined card holds nothing, and the booking can’t be sent with it', async () => {
  const requestKey = key();
  const h = await hold({ serviceIds: [service], requestKey });
  assert.equal((await card(h.body.ref, '4000 0000 0000 0002')).status, 402);
  const res = await book({ jobDate: nextDay(), serviceIds: [service], requestKey, paymentId: h.body.paymentId });
  assert.equal(res.status, 402);
  assert.equal(res.body.code, 'deposit_not_held');
});

test('the time gone by the time it’s sent: nothing booked, and the hold let go', async () => {
  const day = nextDay();
  const first = await paid([service]);
  assert.equal((await book({ jobDate: day, serviceIds: [service], requestKey: first.requestKey, paymentId: first.paymentId })).status, 201);
  const second = await paid([service]);
  const res = await book({ jobDate: day, serviceIds: [service], requestKey: second.requestKey, paymentId: second.paymentId });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(await pretendStatus(second.ref), 'released');
  assert.equal((await payment(second.paymentId)).status, 'released');
});

test('no deposit taken: no hold, and a booking needs none', async () => {
  await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-settings', { method: 'PUT', body: { depositOn: false } });
  try {
    const h = await hold({ serviceIds: [service], requestKey: key() });
    assert.deepEqual(h.body, { depositPence: null });
    const res = await book({ jobDate: nextDay(), serviceIds: [service], requestKey: key() });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal((await jobRow(owner.shop.id, res.body.id)).deposit_pence, null);
  } finally {
    await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-settings', { method: 'PUT', body: { depositOn: true } });
  }
});

test('another shop’s services and payments are never found', async () => {
  await staffRequest(server.baseUrl, other.cookie, '/api/workshop-settings', { method: 'PUT', body: { depositOn: true, depositPercent: 20 } });
  const h = await hold({ serviceIds: [service], requestKey: key() }, other);
  assert.equal(h.status, 400, JSON.stringify(h.body));
  const mine = await paid([service]);
  const res = await card(mine.ref);
  assert.equal(res.status, 409, 'already held');
  const elsewhere = await fetch(`${server.baseUrl}/api/portal/${other.shop.slug}/pretend-payments/${mine.ref}/card`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"cardNumber":"4242424242424242"}' });
  assert.equal(elsewhere.status, 404);
});

// The review's findings.
test('a hold left with no booking for an hour is let go when holds are next made (review)', async () => {
  const left = await paid([service]);
  await runWithShop(owner.shop.id, () => prepare("UPDATE online_payments SET updated_at = now() - interval '61 minutes' WHERE id = ?").run(left.paymentId));
  await hold({ serviceIds: [service], requestKey: key() });
  assert.equal(await pretendStatus(left.ref), 'released');
  assert.equal((await payment(left.paymentId)).status, 'released');
  const fresh = await paid([service]);
  await hold({ serviceIds: [service], requestKey: key() });
  assert.equal(await pretendStatus(fresh.ref), 'held', 'a hold under an hour old stays');
});

test('a deposit the provider couldn’t take after booking is taken when payments are next touched (review)', async () => {
  const p = await paid([service]);
  const res = await book({ jobDate: nextDay(), serviceIds: [service], requestKey: p.requestKey, paymentId: p.paymentId });
  assert.equal(res.status, 201);
  // As if taking had failed: still held at the provider and in Wheelhouse.
  await runWithShop(owner.shop.id, async () => {
    await prepare("UPDATE pretend_payments SET status = 'held' WHERE ref = ?").run(p.ref);
    await prepare("UPDATE online_payments SET status = 'held' WHERE id = ?").run(p.paymentId);
  });
  await hold({ serviceIds: [service], requestKey: key() });
  assert.equal(await pretendStatus(p.ref), 'taken');
  assert.equal((await payment(p.paymentId)).status, 'taken');
});

test('a “Not sure” booking takes the shop’s amount for a price not known (review)', async () => {
  await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-settings', { method: 'PUT', body: { depositUnknownPence: 1000 } });
  try {
    const requestKey = key();
    const h = await hold({ notSure: true, requestKey });
    assert.equal(h.body.depositPence, 1000);
    assert.equal((await card(h.body.ref)).status, 200);
    const res = await book({ jobDate: nextDay(), notSure: true, description: 'Clicking from the back', requestKey, paymentId: h.body.paymentId });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal((await jobRow(owner.shop.id, res.body.id)).deposit_pence, 1000);
  } finally {
    await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-settings', { method: 'PUT', body: { depositUnknownPence: null } });
  }
});
