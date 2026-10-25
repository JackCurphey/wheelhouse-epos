// A bike's own page, the server (openspec/changes/bike-page; cs-bike; Jack's
// answer of 15 Oct, not-drawn pages #7 and #8): the bike, who it belongs to,
// and every job on it newest first, each saying whether it's open.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;
let alex;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  other = await staffSignup(server.baseUrl);
  alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options, who = owner) => staffRequest(server.baseUrl, who.cookie, path, options);

// Maya Patel's Trek Domane AL 3, green, as drawn; the frame number isn't drawn.
async function mayasTrek() {
  const maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } })).body;
  const bike = (await staff(`/api/customers/${maya.id}/bikes`, { method: 'POST', body: { make: 'Trek', model: 'Domane AL 3', colour: 'Green', serialNumber: '[frame number]', notes: 'Black mudguards' } })).body;
  return { maya, bike };
}
const job = async (customerId, bikeId, jobDate) => (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate, startTime: '10:00', endTime: '11:00', mechanicId: alex, customerId, bikeId } })).body;

test('the bike, who it belongs to, and its jobs newest first, each saying whether it’s open', async () => {
  const { maya, bike } = await mayasTrek();
  const old = await job(maya.id, bike.id, '2026-09-02');
  const later = await job(maya.id, bike.id, '2026-10-20');
  // The older one has been and gone.
  await runWithShop(owner.shop.id, () => prepare("UPDATE workshop_jobs SET custody_state = 'collected', collected_at = now() WHERE id = ?").run(old.id));
  // Another of Maya's jobs, on no bike, isn't this bike's.
  await job(maya.id, null, '2026-10-21');
  const res = await staff(`/api/bikes/${bike.id}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const b = res.body;
  assert.deepEqual([b.make, b.model, b.colour, b.serialNumber, b.notes], ['Trek', 'Domane AL 3', 'Green', '[frame number]', 'Black mudguards']);
  assert.deepEqual(b.customer, { id: maya.id, name: 'Maya Patel', phone: '07700 900142' });
  assert.deepEqual(b.jobs.map((j) => [j.id, j.open]), [[later.id, true], [old.id, false]]);
  assert.equal(b.jobs[0].reference, later.reference);
  assert.equal(b.jobs[0].mechanicName, 'Alex Morgan');
});

test('a removed bike still opens, with its history', async () => {
  const { bike } = await mayasTrek();
  await staff(`/api/bikes/${bike.id}`, { method: 'DELETE' });
  const res = await staff(`/api/bikes/${bike.id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.active, false);
});

test('another shop’s bike, or one that doesn’t exist, is not found', async () => {
  const { bike } = await mayasTrek();
  const theirs = await staff(`/api/bikes/${bike.id}`, {}, other);
  assert.equal(theirs.status, 404);
  assert.equal(theirs.body.error, 'Bike not found');
  assert.equal((await staff('/api/bikes/999999')).status, 404);
  assert.equal((await staff('/api/bikes/not-a-number')).status, 404);
});
