// Refunding the deposit when a booking is cancelled or declined (Jack, 24 Oct
// answers 1–5; bk-cancel, bk-cancel-late, bk-declined, bk-staff-decline;
// openspec/changes/deposit-refunds). The pretend provider and its test cards.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { tryBooking, dayMaker } from './helpers/linkActions.js';

let server;
let owner;
let sam;
let customer;
let service;
const nextDay = dayMaker();

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Refund Cycles' });
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
  service = await runWithShop(owner.shop.id, async () => (await prepare("INSERT INTO workshop_services (name, price, minutes, bookable_online, active, updated_at) VALUES ('Standard service', 65, 60, 1, 1, now()) RETURNING id").get()).id);
  await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-settings', { method: 'PUT', body: { depositOn: true, depositPercent: 20 } });
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const post = (path, body) => fetch(`${server.baseUrl}/api/portal/${owner.shop.slug}${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: customer.cookie }, body: JSON.stringify(body),
}).then(async (r) => ({ status: r.status, body: await r.json() }));
const inShop = (fn) => runWithShop(owner.shop.id, fn);
const pretendStatus = (ref) => inShop(() => prepare('SELECT status, refunded_pence FROM pretend_payments WHERE ref = ?').get(ref));
const paymentOf = (jobId) => inShop(() => prepare('SELECT * FROM online_payments WHERE job_id = ?').get(jobId));
const version = async (id) => (await staff(`/api/workshop-jobs/${id}`)).body.version;

/** A paid booking: its job id, link code and the provider's ref. */
async function booked({ confirm = true } = {}) {
  const requestKey = randomBytes(32).toString('base64url');
  const hold = await post('/deposit-holds', { serviceIds: [service], requestKey });
  await post(`/pretend-payments/${hold.body.ref}/card`, { cardNumber: '4242424242424242' });
  const res = await tryBooking(server.baseUrl, customer.cookie, owner.shop.slug, { mechanicId: sam, jobDate: nextDay(), startTime: '10:00', serviceIds: [service], requestKey, paymentId: hold.body.paymentId });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  // Confirmed by the shop unless asked not to: only a confirmed booking can keep a deposit (Jack, 24 Oct).
  if (confirm) assert.equal((await staff(`/api/workshop-jobs/${res.body.id}/accept`, { method: 'POST', body: { version: await version(res.body.id) } })).status, 200);
  return { id: res.body.id, code: res.body.privateLink.split('/').pop(), ref: hold.body.ref };
}
const link = async (code) => (await fetch(`${server.baseUrl}/api/portal/${owner.shop.slug}/booking-links/${code}`)).json();
// Before the server's pinned clock (1 Sep 2026; tests/helpers/liveServer.js).
const pastCutOff = (id) => inShop(() => prepare("UPDATE workshop_jobs SET deposit_cancel_until = '2026-08-31T12:00:00Z' WHERE id = ?").run(id));

test('the link says the deposit is paid, and that cancelling now would refund it', async () => {
  const b = await booked();
  const l = await link(b.code);
  assert.equal(l.deposit.state, 'paid');
  assert.equal(l.deposit.refundable, true);
  await pastCutOff(b.id);
  assert.equal((await link(b.code)).deposit.refundable, false);
});

test('cancelled in time: refunded to the card, and the link says so', async () => {
  const b = await booked();
  const res = await post(`/booking-links/${b.code}/cancel`, {});
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(await pretendStatus(b.ref), { status: 'refunded', refunded_pence: 1300 });
  const p = await paymentOf(b.id);
  assert.deepEqual([p.status, p.refund_reason], ['refunded', 'Cancelled in time']);
  assert.ok(p.refunded_at);
  assert.equal(res.body.deposit.state, 'refunded');
});

test('late, without choosing to lose it: refused, nothing changes', async () => {
  const b = await booked();
  await pastCutOff(b.id);
  const res = await post(`/booking-links/${b.code}/cancel`, {});
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.code, 'deposit_kept');
  assert.notEqual((await link(b.code)).stage, 'cancelled');
  assert.equal((await pretendStatus(b.ref)).status, 'taken');
});

test('late, choosing to lose it: cancelled, and the deposit kept', async () => {
  const b = await booked();
  await pastCutOff(b.id);
  const res = await post(`/booking-links/${b.code}/cancel`, { losesDeposit: true });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.stage, 'cancelled');
  assert.equal(res.body.deposit.state, 'kept');
  assert.equal((await pretendStatus(b.ref)).status, 'taken');
});

test('the shop declining, letting it expire, or cancelling refunds it', async () => {
  const declined = await booked({ confirm: false });
  assert.equal((await staff(`/api/workshop-jobs/${declined.id}/decline`, { method: 'POST', body: { version: await version(declined.id), message: 'Sorry, we are full' } })).status, 200);
  assert.equal((await pretendStatus(declined.ref)).status, 'refunded');
  assert.equal((await paymentOf(declined.id)).refund_reason, 'Declined');

  const expired = await booked({ confirm: false });
  assert.equal((await staff(`/api/workshop-jobs/${expired.id}/expire`, { method: 'POST', body: { version: await version(expired.id) } })).status, 200);
  assert.equal((await pretendStatus(expired.ref)).status, 'refunded');
  assert.equal((await link(expired.code)).deposit.state, 'refunded');

  const cancelled = await booked();
  assert.equal((await staff(`/api/workshop-jobs/${cancelled.id}/cancel`, { method: 'POST', body: { version: await version(cancelled.id) } })).status, 200);
  assert.equal((await pretendStatus(cancelled.ref)).status, 'refunded');
  assert.equal((await paymentOf(cancelled.id)).refund_reason, 'Cancelled by the shop');
});

test('a refund the provider couldn’t make then is made when deposits are next touched', async () => {
  const b = await booked();
  // The provider refuses for now: its record isn't taken.
  await inShop(() => prepare("UPDATE pretend_payments SET status = 'held' WHERE ref = ?").run(b.ref));
  assert.equal((await post(`/booking-links/${b.code}/cancel`, {})).status, 200);
  const owed = await paymentOf(b.id);
  assert.deepEqual([owed.status, owed.refund_due_reason], ['taken', 'Cancelled in time']);
  assert.equal((await link(b.code)).deposit.state, 'refunded', 'owed counts as on its way back');
  await inShop(() => prepare("UPDATE pretend_payments SET status = 'taken' WHERE ref = ?").run(b.ref));
  await post('/deposit-holds', { serviceIds: [service], requestKey: randomBytes(32).toString('base64url') });
  assert.equal((await pretendStatus(b.ref)).status, 'refunded');
  assert.equal((await paymentOf(b.id)).status, 'refunded');
});

test('no deposit: cancelling and declining are as before', async () => {
  await staff('/api/workshop-settings', { method: 'PUT', body: { depositOn: false } });
  try {
    const res = await tryBooking(server.baseUrl, customer.cookie, owner.shop.slug, { mechanicId: sam, jobDate: nextDay(), startTime: '10:00', serviceIds: [service], requestKey: randomBytes(32).toString('base64url') });
    const code = res.body.privateLink.split('/').pop();
    assert.equal((await link(code)).deposit, null);
    assert.equal((await post(`/booking-links/${code}/cancel`, {})).status, 200);
  } finally {
    await staff('/api/workshop-settings', { method: 'PUT', body: { depositOn: true } });
  }
});

// The review's findings.
test('moving a booking moves its cut-off, the same hours before (review)', async () => {
  const b = await booked();
  await inShop(() => prepare("UPDATE workshop_jobs SET job_date = '2026-10-14', start_time = '15:00' WHERE id = ?").run(b.id));
  assert.deepEqual((await link(b.code)).deposit.cancelUntil, { date: '2026-10-13', time: '15:00' });
  // Moved across the clocks going back (25 Oct): still 24 hours before, in UK time.
  await inShop(() => prepare("UPDATE workshop_jobs SET job_date = '2026-10-26', start_time = '09:00' WHERE id = ?").run(b.id));
  assert.deepEqual((await link(b.code)).deposit.cancelUntil, { date: '2026-10-25', time: '09:00' });
});

test('a deposit only held when a refund is owed is let go (review)', async () => {
  const b = await booked();
  await inShop(async () => {
    await prepare("UPDATE pretend_payments SET status = 'held' WHERE ref = ?").run(b.ref);
    await prepare("UPDATE online_payments SET status = 'held' WHERE job_id = ?").run(b.id);
  });
  assert.equal((await post(`/booking-links/${b.code}/cancel`, {})).status, 200);
  assert.equal((await pretendStatus(b.ref)).status, 'released');
  assert.deepEqual([(await paymentOf(b.id)).status, (await link(b.code)).deposit.state], ['released', 'refunded']);
});

// Jack, 24 Oct: a shop can't keep a deposit for a booking it hasn't confirmed
// (docs/decisions/2026-10-24-request-deposit-refund.md).
test('a request not yet confirmed, cancelled after its cut-off, is refunded (Jack, 24 Oct)', async () => {
  const requestKey = randomBytes(32).toString('base64url');
  const hold = await post('/deposit-holds', { serviceIds: [service], requestKey });
  await post(`/pretend-payments/${hold.body.ref}/card`, { cardNumber: '4242424242424242' });
  const res = await tryBooking(server.baseUrl, customer.cookie, owner.shop.slug, { mechanicId: sam, jobDate: nextDay(), startTime: '10:00', serviceIds: [service], requestKey, paymentId: hold.body.paymentId });
  const code = res.body.privateLink.split('/').pop();
  await pastCutOff(res.body.id);
  assert.equal((await link(code)).deposit.refundable, true, 'the link says it would be refunded');
  const cancelled = await post(`/booking-links/${code}/cancel`, {});
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
  assert.equal((await pretendStatus(hold.body.ref)).status, 'refunded');
  assert.equal(cancelled.body.deposit.state, 'refunded');
});

// Jack, 24 Oct: a request confirmed after its cut-off gets 1 hour to cancel
// free, never past the booking's start (docs/decisions/2026-10-24-request-deposit-refund.md).
test('a request confirmed after its cut-off: free to cancel for 1 hour after (Jack, 24 Oct)', async () => {
  const b = await booked({ confirm: false });
  await pastCutOff(b.id);
  assert.equal((await staff(`/api/workshop-jobs/${b.id}/accept`, { method: 'POST', body: { version: await version(b.id) } })).status, 200);
  const l = await link(b.code);
  // The server's pinned clock is 06:00 UTC on 1 Sep 2026, 07:00 in the UK: an hour on is 08:00.
  assert.deepEqual(l.deposit.cancelUntil, { date: '2026-09-01', time: '08:00' });
  assert.equal(l.deposit.refundable, true);
  assert.equal((await post(`/booking-links/${b.code}/cancel`, {})).status, 200);
  assert.equal((await pretendStatus(b.ref)).status, 'refunded');
});

test('a request confirmed before its cut-off keeps its own cut-off', async () => {
  const b = await booked({ confirm: false });
  const before = (await link(b.code)).deposit.cancelUntil;
  assert.equal((await staff(`/api/workshop-jobs/${b.id}/accept`, { method: 'POST', body: { version: await version(b.id) } })).status, 200);
  assert.deepEqual((await link(b.code)).deposit.cancelUntil, before);
});

test('a time the shop offered, accepted after its cut-off: the same hour to cancel free (review)', async () => {
  const b = await booked({ confirm: false });
  const day = nextDay();
  const offered = await staff(`/api/workshop-jobs/${b.id}/offer`, { method: 'POST', body: { version: await version(b.id), jobDate: day, startTime: '11:00', mechanicId: sam } });
  assert.equal(offered.status, 200, JSON.stringify(offered.body));
  await pastCutOff(b.id);
  const accepted = await post(`/booking-links/${b.code}/accept-offer`, { jobDate: day, startTime: '11:00' });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  assert.deepEqual(accepted.body.deposit.cancelUntil, { date: '2026-09-01', time: '08:00' });
});

test('the hour never runs past the booking’s start (review)', async () => {
  const b = await booked({ confirm: false });
  // Booked for 07:30 today, UK time; the server's clock reads 07:00.
  await inShop(() => prepare("UPDATE workshop_jobs SET job_date = '2026-09-01', start_time = '07:30', end_time = '08:30' WHERE id = ?").run(b.id));
  await pastCutOff(b.id);
  const res = await staff(`/api/workshop-jobs/${b.id}/accept`, { method: 'POST', body: { version: await version(b.id) } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual((await link(b.code)).deposit.cancelUntil, { date: '2026-09-01', time: '07:30' });
});
