// Telling the customer when to drop the bike off (Jack, 19 Oct,
// docs/decisions/2026-10-19-retire-old-workshop-settings.md answers 3 and 7;
// openspec/changes/drop-off-line): a confirmed booking's link carries dropOff,
// the booked time less the shop's lead time, or the whole day's window.
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
const settings = (body) => staff('/api/workshop-settings', { method: 'PUT', body });

test('a confirmed set-time booking says to drop off by the booked time less the lead time', async () => {
  const { code, id } = await book();
  await setJob(id, "booking_state = 'scheduled', custody_state = 'expected', work_state = 'not_started', start_time = '11:30'");
  await settings({ timedLeadMinutes: 30 });
  assert.deepEqual((await read(code)).body.dropOff, { by: '11:00', booked: '11:30', leadMinutes: 30 });
  await settings({ timedLeadMinutes: 60 });
  assert.deepEqual((await read(code)).body.dropOff, { by: '10:30', booked: '11:30', leadMinutes: 60 });
  await settings({ timedLeadMinutes: 30 });
});

test('a whole-day booking says to drop off in the shop’s window', async () => {
  const { code, id } = await book();
  await setJob(id, "booking_state = 'scheduled', custody_state = 'expected', work_state = 'not_started', start_time = NULL");
  await settings({ dropoffWindowStart: '09:00', dropoffWindowEnd: '10:00' });
  assert.deepEqual((await read(code)).body.dropOff, { from: '09:00', to: '10:00' });
});

test('a request not yet accepted, or a bike already in, says nothing about dropping off', async () => {
  const { code, id } = await book();
  await setJob(id, "booking_state = 'pending', custody_state = 'expected'");
  assert.equal((await read(code)).body.dropOff, null, 'request waiting');
  await setJob(id, "booking_state = 'scheduled', custody_state = 'in_shop', work_state = 'in_progress'");
  assert.equal((await read(code)).body.dropOff, null, 'bike in');
});
