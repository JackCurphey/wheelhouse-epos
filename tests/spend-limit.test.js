// The customer's spending limit, chosen at booking and shown on the job
// (Workshop day 41-43, docs/decisions/2026-09-27-workshop-day-review.md;
// openspec/changes/spend-limit-booking).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup, portalRequest } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { futureDate } from './helpers/workshopFixtures.js';
import { BOOKING_CONTACT } from './helpers/bookable.js';

let server;
let owner;
let sam;
let customer;
let svc;

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
  svc = (await staff('/api/workshop-services', { method: 'POST', body: { name: 'Standard service', price: 65, minutes: 60, bookableOnline: true } })).body;
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

let day = 0;
const nextDate = () => {
  const n = day++;
  const d = new Date(`${futureDate(1 + (n % 5))}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7 * Math.floor(n / 5));
  return d.toISOString().slice(0, 10);
};
const book = (body) => portalRequest(server.baseUrl, customer.cookie, `/api/portal/${owner.shop.slug}/bookings`, {
  method: 'POST',
  body: { mechanicId: sam, jobDate: nextDate(), startTime: '10:00', newBike: { make: 'Dawes', model: 'Galaxy' }, serviceIds: [svc.id], ...BOOKING_CONTACT, ...body },
});

test('a booking keeps the customer’s spending limit, and the job shows it', async () => {
  const res = await book({ spendLimit: 200 });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const job = await staff(`/api/workshop-jobs/${res.body.id}`);
  assert.equal(job.body.spendLimit, 200);
});

test('asking first keeps no limit', async () => {
  const res = await book({});
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal((await staff(`/api/workshop-jobs/${res.body.id}`)).body.spendLimit, null);
});

test('a limit that isn’t a whole number of pounds from 1 to 100,000 is refused', async () => {
  for (const spendLimit of [0, -5, 150.5, '200', 100001, true]) {
    const res = await book({ spendLimit });
    assert.equal(res.status, 400, `${JSON.stringify(spendLimit)}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.error, 'Enter the most the whole bill can come to, in whole pounds.');
  }
});

test('a staff-made job has no limit, and every job read carries the field', async () => {
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Walk-in', jobDate: '2026-10-20' } })).body;
  assert.equal(job.spendLimit, null);
  const list = (await staff('/api/workshop-jobs?start=2026-10-20&end=2026-10-20')).body;
  assert.equal(list.find((j) => j.id === job.id).spendLimit, null);
});
