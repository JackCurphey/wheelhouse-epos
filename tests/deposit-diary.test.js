// The diary job's deposit (Jack, 24 Oct answers 2 and 3; approved drawings
// bk-staff-deposit… and bk-staff-no-show…; openspec/changes/deposit-diary-server).
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
let other;
let sam;
let customer;
let service;
const nextDay = dayMaker();

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Diary Deposit Cycles' });
  other = await staffSignup(server.baseUrl, { shopName: 'Elsewhere Deposit Cycles' });
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
  service = await runWithShop(owner.shop.id, async () => (await prepare("INSERT INTO workshop_services (name, price, price_pence, minutes, bookable_online, active, updated_at) VALUES ('Standard service', 65, ROUND(65 * 100)::int, 60, 1, 1, now()) RETURNING id").get()).id);
  await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-settings', { method: 'PUT', body: { depositOn: true, depositPercent: 20 } });
});
after(async () => {
  for (const s of [owner, other]) if (s) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options, who = owner) => staffRequest(server.baseUrl, who.cookie, path, options);
const post = (path, body) => fetch(`${server.baseUrl}/api/portal/${owner.shop.slug}${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: customer.cookie }, body: JSON.stringify(body),
}).then(async (r) => ({ status: r.status, body: await r.json() }));
const inShop = (fn) => runWithShop(owner.shop.id, fn);
const job = async (id) => (await staff(`/api/workshop-jobs/${id}`)).body;
const pretendStatus = (ref) => inShop(() => prepare('SELECT status FROM pretend_payments WHERE ref = ?').get(ref)).then((r) => r.status);

/** A booking with a paid deposit, accepted: its job id and the provider's ref. */
async function booked({ past = false } = {}) {
  const requestKey = randomBytes(32).toString('base64url');
  const hold = await post('/deposit-holds', { serviceIds: [service], requestKey });
  await post(`/pretend-payments/${hold.body.ref}/card`, { cardNumber: '4242424242424242' });
  const res = await tryBooking(server.baseUrl, customer.cookie, owner.shop.slug, { mechanicId: sam, jobDate: nextDay(), startTime: '10:00', serviceIds: [service], requestKey, paymentId: hold.body.paymentId });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const id = res.body.id;
  assert.equal((await staff(`/api/workshop-jobs/${id}/accept`, { method: 'POST', body: { version: (await job(id)).version } })).status, 200);
  // The day gone: before the server's pinned clock (1 Sep 2026).
  if (past) await inShop(() => prepare("UPDATE workshop_jobs SET job_date = '2026-08-28' WHERE id = ?").run(id));
  return { id, ref: hold.body.ref };
}

test('the job shows its deposit: the amount, when it was paid, and paid', async () => {
  const b = await booked();
  const j = await job(b.id);
  assert.equal(j.deposit.pence, 1300);
  assert.equal(j.deposit.state, 'paid');
  assert.ok(j.deposit.paidAt);
  assert.equal(j.noShowAt, null);
});

test('refunded by hand with a reason: back to the card, shown with when, why and who', async () => {
  const b = await booked();
  const res = await staff(`/api/workshop-jobs/${b.id}/deposit-refund`, { method: 'POST', body: { reason: '  Bike wasn’t ready in time  ' } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(await pretendStatus(b.ref), 'refunded');
  assert.equal(res.body.deposit.state, 'refunded');
  assert.equal(res.body.deposit.refundReason, 'Bike wasn’t ready in time');
  assert.ok(res.body.deposit.refundedAt);
  assert.ok(res.body.deposit.refundedBy, 'who refunded it');
  const again = await staff(`/api/workshop-jobs/${b.id}/deposit-refund`, { method: 'POST', body: { reason: 'Again' } });
  assert.equal(again.status, 409);
  assert.equal(again.body.code, 'not_refundable');
});

test('no reason, or too long: refused, nothing refunded', async () => {
  const b = await booked();
  for (const reason of [undefined, '', '   ', 'x'.repeat(201), 42]) {
    const res = await staff(`/api/workshop-jobs/${b.id}/deposit-refund`, { method: 'POST', body: { reason } });
    assert.equal(res.status, 400, `${JSON.stringify(reason)} → ${res.status}`);
  }
  assert.equal(await pretendStatus(b.ref), 'taken');
});

test('a job with no deposit: none shown, and nothing to refund', async () => {
  const plain = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Gear tune', jobDate: nextDay() } });
  assert.equal(plain.body.deposit, null);
  const res = await staff(`/api/workshop-jobs/${plain.body.id}/deposit-refund`, { method: 'POST', body: { reason: 'Why not' } });
  assert.equal(res.status, 409);
});

test('Didn’t come: only once the day has gone and the bike never came in; by whom; the deposit kept; Undo', async () => {
  const soon = await booked();
  const early = await staff(`/api/workshop-jobs/${soon.id}/didnt-come`, { method: 'POST', body: { version: (await job(soon.id)).version } });
  assert.equal(early.status, 409, 'not before the day has gone');
  assert.equal(early.body.code, 'illegal');

  const b = await booked({ past: true });
  const stale = await staff(`/api/workshop-jobs/${b.id}/didnt-come`, { method: 'POST', body: { version: 1 } });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.code, 'stale');
  const res = await staff(`/api/workshop-jobs/${b.id}/didnt-come`, { method: 'POST', body: { version: (await job(b.id)).version } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(res.body.noShowAt);
  assert.equal(res.body.deposit.state, 'kept');
  assert.ok(res.body.deposit.noShowBy);
  assert.equal(await pretendStatus(b.ref), 'taken', 'kept, not refunded');
  const twice = await staff(`/api/workshop-jobs/${b.id}/didnt-come`, { method: 'POST', body: { version: res.body.version } });
  assert.equal(twice.status, 409);

  const undone = await staff(`/api/workshop-jobs/${b.id}/didnt-come/undo`, { method: 'POST', body: { version: res.body.version } });
  assert.equal(undone.status, 200, JSON.stringify(undone.body));
  assert.equal(undone.body.noShowAt, null);
  assert.equal(undone.body.deposit.state, 'paid');

  // Marked again, it can still be refunded by hand.
  const marked = await staff(`/api/workshop-jobs/${b.id}/didnt-come`, { method: 'POST', body: { version: undone.body.version } });
  const refunded = await staff(`/api/workshop-jobs/${b.id}/deposit-refund`, { method: 'POST', body: { reason: 'Rang to say sorry' } });
  assert.equal(marked.status, 200);
  assert.equal(refunded.body.deposit.state, 'refunded');
});

test('a bike that came in can’t be marked Didn’t come', async () => {
  const b = await booked({ past: true });
  await inShop(() => prepare("UPDATE workshop_jobs SET custody_state = 'in_shop' WHERE id = ?").run(b.id));
  const res = await staff(`/api/workshop-jobs/${b.id}/didnt-come`, { method: 'POST', body: { version: (await job(b.id)).version } });
  assert.equal(res.status, 409);
});

test('another shop’s job is never found', async () => {
  const b = await booked({ past: true });
  assert.equal((await staff(`/api/workshop-jobs/${b.id}/deposit-refund`, { method: 'POST', body: { reason: 'x' } }, other)).status, 404);
  assert.equal((await staff(`/api/workshop-jobs/${b.id}/didnt-come`, { method: 'POST', body: { version: 1 } }, other)).status, 404);
  assert.equal(await pretendStatus(b.ref), 'taken');
});

test('booking the bike in after all clears Didn’t come, and the deposit is paid again (review)', async () => {
  const b = await booked({ past: true });
  const marked = await staff(`/api/workshop-jobs/${b.id}/didnt-come`, { method: 'POST', body: { version: (await job(b.id)).version } });
  assert.equal(marked.status, 200);
  const res = await staff(`/api/workshop-jobs/${b.id}/book-in`, { method: 'POST', body: { version: marked.body.version } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.noShowAt, null);
  assert.equal(res.body.deposit.state, 'paid');
});
