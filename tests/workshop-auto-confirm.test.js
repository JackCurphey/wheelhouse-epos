// Confirming online bookings automatically (Book a repair decision 8, Jack,
// 1 Oct; Jack, 19 Oct, docs/decisions/2026-10-19-auto-confirm.md): a shop
// setting, off to start. On, a booking that fits is saved confirmed and
// marked new until staff open it; nothing for Waiting for you.
// Spec: openspec/changes/auto-confirm/design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie, seedMechanic } from './helpers/staff.js';
import { portalSignup, portalRequest } from './helpers/portal.js';
import { jsonRequest } from './helpers/http.js';
import { deleteTestShop } from './helpers/testShop.js';
import { futureDate } from './helpers/workshopFixtures.js';
import { seedJobTypes, BOOKING_CONTACT } from './helpers/bookable.js';

let server;
let owner;
let jo;
let mechanic;
let types;
let customer;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  mechanic = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  types = await seedJobTypes(owner.shop.id);
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-auto-${Date.now()}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const settings = (body) => staff('/api/workshop-settings', { method: 'PUT', body });
const services = () => jsonRequest(server.baseUrl, null, `/api/portal/${owner.shop.slug}/services`);
const readLink = (code) => jsonRequest(server.baseUrl, null, `/api/portal/${owner.shop.slug}/booking-links/${code}`);
const jobRow = (id) => runWithShop(owner.shop.id, () => prepare('SELECT * FROM workshop_jobs WHERE id = ?').get(id));

// Each booking its own day and time, so none collides with another.
let n = 0;
function nextSlot() {
  const i = n++;
  return { jobDate: futureDate(1 + (i % 5)), startTime: ['09:00', '10:00', '11:00', '14:00', '15:00'][Math.floor(i / 5) % 5] };
}
function postBooking(slot) {
  return portalRequest(server.baseUrl, customer.cookie, `/api/portal/${owner.shop.slug}/bookings`, {
    method: 'POST',
    body: { mechanicId: mechanic, ...slot, description: 'Squeaky brakes', newBike: { make: 'Trek', model: 'Domane AL 3' }, serviceIds: [types.service], ...BOOKING_CONTACT },
  });
}
async function book(slot = nextSlot()) {
  const res = await postBooking(slot);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const { id } = await runWithShop(owner.shop.id, () => prepare('SELECT id FROM workshop_jobs WHERE reference = ?').get(res.body.reference));
  return { id, code: res.body.privateLink.split('/').pop(), slot };
}
async function withAutoConfirm(fn) {
  const on = await settings({ confirmBookingsAutomatically: true });
  assert.equal(on.status, 200, JSON.stringify(on.body));
  try {
    return await fn();
  } finally {
    await settings({ confirmBookingsAutomatically: false });
  }
}

test('the setting starts off, saves, and is kept when not sent', async () => {
  assert.equal((await staff('/api/workshop-settings')).body.confirmBookingsAutomatically, false);
  await withAutoConfirm(async () => {
    assert.equal((await staff('/api/workshop-settings')).body.confirmBookingsAutomatically, true);
    const other = await settings({ timedLeadMinutes: 30 });
    assert.equal(other.body.confirmBookingsAutomatically, true, 'omitted keeps what is stored');
  });
  assert.equal((await staff('/api/workshop-settings')).body.confirmBookingsAutomatically, false);
});

test('only the Owner can change it', async () => {
  const refused = await staffRequest(server.baseUrl, jo.cookie, '/api/workshop-settings', { method: 'PUT', body: { confirmBookingsAutomatically: true } });
  assert.equal(refused.status, 403, JSON.stringify(refused.body));
  assert.equal(refused.body.code, 'owner_only');
  assert.equal((await staff('/api/workshop-settings')).body.confirmBookingsAutomatically, false);
});

test('the booking page is told which wording to use', async () => {
  assert.equal((await services()).body.confirmsAutomatically, false);
  await withAutoConfirm(async () => {
    assert.equal((await services()).body.confirmsAutomatically, true);
  });
});

test('off: a booking is a request, as today', async () => {
  const { id, code } = await book();
  const row = await jobRow(id);
  assert.equal(row.booking_state, 'pending');
  assert.equal(row.online_unseen, 0);
  assert.equal((await readLink(code)).body.stage, 'awaiting_confirmation');
  const job = (await staff(`/api/workshop-jobs/${id}`)).body;
  assert.equal(job.newOnline, false);
});

test('on: a booking that fits is saved confirmed, marked new, and its link reads confirmed', async () => {
  await withAutoConfirm(async () => {
    const { id, code } = await book();
    const row = await jobRow(id);
    assert.equal(row.booking_state, 'scheduled');
    assert.equal(row.online_unseen, 1);
    // Its time is held, as an accepted request's is.
    const hold = await runWithShop(owner.shop.id, () => prepare(
      "SELECT count(*)::int AS n FROM workshop_capacity_holds WHERE workshop_job_id = ? AND state IN ('held', 'confirmed')"
    ).get(id));
    assert.equal(hold.n, 1);
    const link = (await readLink(code)).body;
    assert.equal(link.stage, 'confirmed');
    assert.ok(link.dropOff, 'the drop-off line shows once confirmed');
    // Not a request, so not in Waiting for you.
    const waiting = (await staff('/api/workshop-waiting')).body;
    assert.ok(!waiting.items.some((i) => i.jobId === id), JSON.stringify(waiting.items));
  });
});

test('on: a booking that does not fit is still refused', async () => {
  await withAutoConfirm(async () => {
    const { slot } = await book();
    const before = await runWithShop(owner.shop.id, () => prepare('SELECT count(*)::int AS n FROM workshop_jobs').get());
    const again = await postBooking(slot);
    assert.equal(again.status, 409, JSON.stringify(again.body));
    const after = await runWithShop(owner.shop.id, () => prepare('SELECT count(*)::int AS n FROM workshop_jobs').get());
    assert.equal(after.n, before.n);
  });
});

test('jobs carry newOnline, and /seen clears it for any staff member, more than once', async () => {
  const { id } = await withAutoConfirm(() => book());
  const listed = (await staff('/api/workshop-jobs')).body.find((j) => j.id === id);
  assert.equal(listed.newOnline, true);
  const one = (await staff(`/api/workshop-jobs/${id}`)).body;
  assert.equal(one.newOnline, true);
  assert.equal((await staff(`/api/workshop-jobs/${id}`)).body.newOnline, true, 'a GET never clears it');

  const seen = await staffRequest(server.baseUrl, jo.cookie, `/api/workshop-jobs/${id}/seen`, { method: 'POST', body: {} });
  assert.equal(seen.status, 204, JSON.stringify(seen.body));
  const after = (await staff(`/api/workshop-jobs/${id}`)).body;
  assert.equal(after.newOnline, false);
  // Seeing it doesn't make the job page's version stale.
  assert.equal(after.version, one.version);
  assert.equal((await staff(`/api/workshop-jobs/${id}/seen`, { method: 'POST', body: {} })).status, 204, 'idempotent');
});

test('/seen needs a signed-in staff member and a job that exists', async () => {
  const anon = await jsonRequest(server.baseUrl, null, '/api/workshop-jobs/1/seen', { method: 'POST', body: {} });
  assert.equal(anon.status, 401);
  assert.equal((await staff('/api/workshop-jobs/999999999/seen', { method: 'POST', body: {} })).status, 404);
});
