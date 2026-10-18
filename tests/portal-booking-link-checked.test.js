// The mechanic sign-off, piece 3 (Jack, 16 and 18 Oct, answer 3,
// docs/decisions/2026-10-16-mechanic-sign-off.md; openspec/changes/sign-off-show-customers):
// with "Show who signed off to customers" on, the booking link of a signed-off
// job that is ready or collected carries checkedBy; otherwise null. The
// setting starts off and round-trips through the workshop settings.
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
import { seedJobTypes, BOOKING_CONTACT } from './helpers/bookable.js';

let server;
let owner;
let sam;
let types;
let customer;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  types = await seedJobTypes(owner.shop.id);
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

let n = 0;
const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
async function book() {
  const res = await portalRequest(server.baseUrl, customer.cookie, `/api/portal/${owner.shop.slug}/bookings`, {
    method: 'POST',
    body: { mechanicId: sam, jobDate: futureDate(1 + (n++ % 5)), startTime: n % 2 ? '10:00' : '14:00', description: 'Squeaky brakes', newBike: { make: 'Trek', model: 'Domane AL 3' }, serviceIds: [types.service], ...BOOKING_CONTACT },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const code = res.body.privateLink.split('/').pop();
  const job = await runWithShop(owner.shop.id, () => prepare('SELECT id FROM workshop_jobs WHERE reference = ?').get(res.body.reference));
  return { code, id: job.id };
}
const read = (code) => jsonRequest(server.baseUrl, null, `/api/portal/${owner.shop.slug}/booking-links/${code}`);
const setJob = (id, sql, ...args) => runWithShop(owner.shop.id, () => prepare(`UPDATE workshop_jobs SET ${sql} WHERE id = ?`).run(...args, id));
const show = (on) => staff('/api/workshop-settings', { method: 'PUT', body: { showSignOffToCustomers: on } });
const ready = (id) => setJob(id, "booking_state = 'scheduled', custody_state = 'in_shop', work_state = 'complete', signed_off_by = ?, signed_off_name = 'Alex Morgan', signed_off_at = now()", sam);

test('the setting starts off, turns on as a boolean, and a PUT without it keeps it', async () => {
  assert.equal((await staff('/api/workshop-settings')).body.showSignOffToCustomers, false);
  const on = await show(true);
  assert.equal(on.status, 200, JSON.stringify(on.body));
  assert.equal(on.body.showSignOffToCustomers, true);
  const other = await staff('/api/workshop-settings', { method: 'PUT', body: { showPricesOnline: false } });
  assert.equal(other.body.showSignOffToCustomers, true);
  assert.equal((await show(false)).body.showSignOffToCustomers, false);
});

test('with the setting on, a ready, signed-off job’s link says who checked it', async () => {
  const { code, id } = await book();
  await ready(id);
  await show(true);
  try {
    const res = await read(code);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.stage, 'ready_to_collect');
    assert.equal(res.body.checkedBy, 'Alex Morgan');
    // Collected, it still says so.
    await setJob(id, "custody_state = 'collected'");
    assert.equal((await read(code)).body.checkedBy, 'Alex Morgan');
  } finally {
    await show(false);
  }
});

test('with the setting off, or before the bike is ready, or unsigned, the link names nobody', async () => {
  const { code, id } = await book();
  await ready(id);
  assert.equal((await read(code)).body.checkedBy, null, 'setting off');
  await show(true);
  try {
    await setJob(id, "work_state = 'in_progress'");
    assert.equal((await read(code)).body.checkedBy, null, 'not ready yet');
    await setJob(id, "work_state = 'complete', signed_off_by = NULL, signed_off_name = NULL, signed_off_at = NULL");
    assert.equal((await read(code)).body.checkedBy, null, 'finished unsigned');
  } finally {
    await show(false);
  }
});
