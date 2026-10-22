// Work within the customer's spending limit (Workshop day 41-43,
// docs/decisions/2026-09-27-workshop-day-review.md: "the quote step is skipped
// automatically… a quote is sent only when the total would go over the limit,
// or when the customer set no limit"; dq-job-within, dq-within-limit;
// openspec/changes/spend-limit-within).
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
async function bookedJob(spendLimit) {
  const res = await portalRequest(server.baseUrl, customer.cookie, `/api/portal/${owner.shop.slug}/bookings`, {
    method: 'POST',
    body: { mechanicId: sam, jobDate: nextDate(), startTime: '10:00', newBike: { make: 'Trek', model: 'Domane' }, serviceIds: [svc.id], ...BOOKING_CONTACT, ...(spendLimit ? { spendLimit } : {}) },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return (await staff(`/api/workshop-jobs/${res.body.id}`)).body;
}
const PADS = { kind: 'part', description: 'Shimano brake pads', unitAmount: 28, need: 'needed', reason: 'Worn down to 1mm.' };
const FIT = { kind: 'labour', description: 'Fit and adjust brakes', unitAmount: 18, need: 'needed', reason: 'Needed with the new pads.' };
const draft = async (jobId, lines) => (await staff(`/api/workshop-jobs/${jobId}/quotes`, { method: 'POST', body: { lines } })).body;
const within = (quoteId) => staff(`/api/quotes/${quoteId}/within-limit`, { method: 'POST', body: {} });

test('work that keeps the whole bill within the limit is agreed, joins the job, and the customer is told', async () => {
  const job = await bookedJob(200);
  const q = await draft(job.id, [PADS, FIT]);
  const res = await within(q.id);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.message.status, 'sent');
  const read = (await staff(`/api/quotes/${q.id}`)).body;
  assert.equal(read.state, 'approved');
  assert.ok(read.lines.every((l) => l.decision === 'approved' && l.decidedVia === 'limit'));
  const order = (await staff(`/api/sale-documents/${job.orderId}`)).body;
  assert.deepEqual(order.items.map((i) => i.name), ['Shimano brake pads', 'Fit and adjust brakes']);
  const told = (await staff(`/api/messages?jobId=${job.id}`)).body.find((m) => m.key === 'work_within_limit');
  assert.ok(told, 'a Work added within your limit message');
  assert.match(told.body, /Shimano brake pads, Fit and adjust brakes, £46\.00/);
  assert.match(told.body, /£200 limit/);
});

test('work that would take the whole bill over the limit is refused, and nothing changes', async () => {
  const job = await bookedJob(100);
  const q = await draft(job.id, [PADS, FIT]);
  const res = await within(q.id);
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.error, 'That takes the whole bill to £111.00, over the £100 limit. Send a quote instead.');
  assert.equal((await staff(`/api/quotes/${q.id}`)).body.state, 'draft');
  assert.equal((await staff(`/api/sale-documents/${job.orderId}`)).body.items.length, 0);
  assert.equal((await staff(`/api/messages?jobId=${job.id}`)).body.filter((m) => m.key === 'work_within_limit').length, 0);
});

test('a job with no limit is refused: the customer asked to be asked first', async () => {
  const job = await bookedJob(null);
  const q = await draft(job.id, [PADS]);
  const res = await within(q.id);
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.error, 'This customer asked to be asked before any extra work. Send a quote instead.');
});

test('a quote already sent can’t be saved within the limit', async () => {
  const job = await bookedJob(200);
  const q = await draft(job.id, [PADS]);
  assert.equal((await staff(`/api/quotes/${q.id}/send`, { method: 'POST', body: {} })).status, 200);
  assert.equal((await within(q.id)).status, 409);
});

test('the whole bill exactly at the limit is within it', async () => {
  const job = await bookedJob(111);
  const q = await draft(job.id, [PADS, FIT]);
  assert.equal((await within(q.id)).status, 200);
});

// The whole bill is the order, plus any booked service not on it yet, plus the
// new work: the booked £65 counts once, whether or not staff have put it on
// the order.
test('a booked service counts once in the whole bill, on the order or not', async () => {
  const job = await bookedJob(111);
  const items = [{ productId: null, serviceId: svc.id, name: 'Standard service', unitPrice: 65, qty: 1, lineType: 'labour' }];
  const put = await staff(`/api/sale-documents/${job.orderId}/items`, { method: 'PUT', body: { items } });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  const order = (await staff(`/api/sale-documents/${job.orderId}`)).body;
  assert.equal(order.total, 65, 'the service is on the order');
  assert.equal(order.items[0].serviceId, svc.id);
  const q = await draft(job.id, [PADS, FIT]);
  assert.equal((await within(q.id)).status, 200, '£65 + £46 = £111, exactly the limit');
});
