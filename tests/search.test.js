// The header search, the server (openspec/changes/header-search; staff-search;
// app map review 2; Jack, 24 Oct, answer 7): jobs and customers, five of each.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;
let maya;
let mayasJob;
let mayasBike;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Search Cycles' });
  other = await staffSignup(server.baseUrl, { shopName: 'Elsewhere Cycles' });
  maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142', email: 'maya@example.com' } })).body;
  const bikeId = await runWithShop(owner.shop.id, async () => (await prepare("INSERT INTO customer_bikes (customer_id, make, model) VALUES (?, 'Trek', 'Domane AL 3') RETURNING id").get(maya.id)).id);
  mayasBike = bikeId;
  await runWithShop(owner.shop.id, () => prepare("UPDATE customer_bikes SET colour = 'Green', serial_number = '[frame number]' WHERE id = ?").run(bikeId));
  mayasJob = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-09-17', startTime: '11:30', endTime: '12:30', customerId: maya.id, bikeId } })).body;
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
});

function staff(path, options, who = owner) {
  return staffRequest(server.baseUrl, who.cookie, path, options);
}
const search = async (q, who = owner) => staff(`/api/search?q=${encodeURIComponent(q)}`, {}, who);

test('a name finds the customer and their jobs, with what their rows show', async () => {
  const res = await search('maya');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const job = res.body.jobs.find((j) => j.id === mayasJob.id);
  assert.ok(job, JSON.stringify(res.body.jobs));
  assert.equal(job.reference, mayasJob.reference);
  assert.equal(job.customerName, 'Maya Patel');
  assert.equal(job.bikeLabel, 'Trek Domane AL 3');
  assert.equal(job.title, 'Standard service');
  assert.equal(job.jobDate, '2026-09-17');
  assert.ok('bookingState' in job && 'custodyState' in job && 'workState' in job, 'its stage');
  const customer = res.body.customers.find((c) => c.id === maya.id);
  assert.deepEqual({ name: customer.name, phone: customer.phone }, { name: 'Maya Patel', phone: '07700 900142' });
});

test('a job number, a phone number, a bike and an email each find it', async () => {
  for (const q of [mayasJob.reference, mayasJob.reference.toLowerCase(), '900142', 'domane']) {
    assert.ok((await search(q)).body.jobs.some((j) => j.id === mayasJob.id), q);
  }
  for (const q of ['07700 900142', '07700900142', 'maya@example']) {
    assert.ok((await search(q)).body.customers.some((c) => c.id === maya.id), q);
  }
});

test('five at most of each', async () => {
  for (let i = 0; i < 6; i++) await staff('/api/customers', { method: 'POST', body: { name: `Lena Fox ${i}`, phone: `07700 9005${i}0` } });
  const res = await search('lena');
  assert.equal(res.body.customers.length, 5);
});

test('fewer than two characters finds nothing, and asks nothing of the database', async () => {
  assert.deepEqual((await search('m')).body, { jobs: [], customers: [], bikes: [] });
  assert.deepEqual((await search('  ')).body, { jobs: [], customers: [], bikes: [] });
});

test('a removed customer isn’t found; another shop’s jobs and customers never are', async () => {
  const gone = (await staff('/api/customers', { method: 'POST', body: { name: 'Quentin Gone', phone: '07700 900999' } })).body;
  assert.equal((await staff(`/api/customers/${gone.id}`, { method: 'DELETE' })).status < 300, true);
  assert.equal((await search('quentin')).body.customers.length, 0);
  const res = await search('maya', other);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { jobs: [], customers: [], bikes: [] });
});

test('what’s typed is a plain search, never a pattern', async () => {
  const res = await search('%_%');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { jobs: [], customers: [], bikes: [] }, 'a % or _ matched everything');
});

test('the numbers in a job number don’t find customers by phone (review)', async () => {
  const sam = (await staff('/api/customers', { method: 'POST', body: { name: 'Sam Reed', phone: `07700 9${mayasJob.reference.replace(/\D/g, '')}` } })).body;
  const res = await search(mayasJob.reference);
  assert.ok(!res.body.customers.some((c) => c.id === sam.id), 'a phone number matched the job number');
  assert.ok(res.body.jobs.some((j) => j.id === mayasJob.id));
});

// Bikes (openspec/changes/bike-search; Jack's answer of 15 Oct, not-drawn pages 7 and 8).
test('a bike is found by make and model or frame number, with who owns it', async () => {
  for (const q of ['domane', 'trek domane', 'TREK', 'frame number']) {
    const bike = (await search(q)).body.bikes.find((b) => b.id === mayasBike);
    assert.ok(bike, q);
    assert.deepEqual(bike, { id: mayasBike, make: 'Trek', model: 'Domane AL 3', colour: 'Green', serialNumber: '[frame number]', customerId: maya.id, customerName: 'Maya Patel' });
  }
  assert.ok(!(await search('maya')).body.bikes.some((b) => b.id === mayasBike), 'a bike isn’t found by its owner’s name: the customer is');
  assert.deepEqual((await search('domane', other)).body.bikes, [], 'another shop’s bike');
});

test('five bikes at most; a removed bike, or a removed customer’s, isn’t found', async () => {
  const pat = (await staff('/api/customers', { method: 'POST', body: { name: 'Pat Brompton', phone: '07700 900321' } })).body;
  for (let i = 0; i < 6; i++) await staff(`/api/customers/${pat.id}/bikes`, { method: 'POST', body: { make: 'Brompton', model: `C Line ${i}` } });
  assert.equal((await search('c line')).body.bikes.length, 5);
  const gone = (await staff(`/api/customers/${maya.id}/bikes`, { method: 'POST', body: { make: 'Ridley', model: 'Kanzo' } })).body;
  assert.ok((await search('kanzo')).body.bikes.some((b) => b.id === gone.id), 'found before it’s removed');
  await runWithShop(owner.shop.id, () => prepare('UPDATE customer_bikes SET active = 0 WHERE id = ?').run(gone.id));
  assert.equal((await search('kanzo')).body.bikes.length, 0);
  const leaving = (await staff('/api/customers', { method: 'POST', body: { name: 'Lou Leaving', phone: '07700 900654' } })).body;
  await staff(`/api/customers/${leaving.id}/bikes`, { method: 'POST', body: { make: 'Orbea', model: 'Orca' } });
  assert.equal((await search('orca')).body.bikes.length, 1);
  await staff(`/api/customers/${leaving.id}`, { method: 'DELETE' });
  assert.equal((await search('orca')).body.bikes.length, 0);
});
