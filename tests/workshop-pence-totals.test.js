// Sales in pence, step A′ task 2.2: the totals the screens showed by adding
// pounds up in the browser are worked out by the server from the pence, the
// authority (openspec/changes/wp-1-6-sales-in-pence, design Decision 6). Each
// test changes only the pence, so a figure still summed from pounds fails.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
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
const inShop = (sql, ...args) => runWithShop(owner.shop.id, () => prepare(sql).run(...args));

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
  svc = (await staff('/api/workshop-services', { method: 'POST', body: { name: 'Standard service', price: 65, minutes: 60, bookableOnline: true } })).body;
  const res = await staff('/api/workshop-settings', { method: 'PUT', body: { showPricesOnline: true } });
  assert.equal(res.body.showPricesOnline, true, JSON.stringify(res.body));
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
const linkCode = async (jobId) => (await staff(`/api/workshop-jobs/${jobId}/private-link`, { method: 'POST', body: {} })).body.privateLink.split('/booking/')[1];
const portal = (code, rest = '') => fetch(`${server.baseUrl}/api/portal/${owner.shop.slug}/booking-links/${code}${rest}`).then((r) => r.json());
// Only the pence of the pads move, from £28.00 to £30.00.
const padsTo3000 = (quoteId) => inShop("UPDATE workshop_quote_lines SET unit_amount_pence = 3000 WHERE workshop_quote_id = ? AND description = 'Shimano brake pads'", quoteId);

test('a draft quote’s proposed total is the whole bill: booked work and every line, from the pence', async () => {
  const job = await bookedJob(null);
  const q = await draft(job.id, [PADS, FIT]);
  await padsTo3000(q.id);
  const read = (await staff(`/api/quotes/${q.id}`)).body;
  assert.equal(read.proposedTotalPence, 6500 + 3000 + 1800);
  assert.equal(read.proposedTotal, 113);
});

test('a sent quote’s proposed total is the booked work and the lines still waiting, from the pence', async () => {
  const job = await bookedJob(null);
  const q = await draft(job.id, [PADS, FIT]);
  const sent = await staff(`/api/quotes/${q.id}/send`, { method: 'POST', body: {} });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  await padsTo3000(q.id);
  // The customer says no to the fitting on their phone; the pads still wait.
  const fit = (await staff(`/api/quotes/${q.id}`)).body.lines.find((l) => l.description === FIT.description);
  const no = await portalRequest(server.baseUrl, customer.cookie, `/api/portal/${owner.shop.slug}/quotes/${q.id}/lines/${fit.id}/decision`, { method: 'POST', body: { decision: 'declined' } });
  assert.equal(no.status, 200, JSON.stringify(no.body));
  const read = (await staff(`/api/quotes/${q.id}`)).body;
  assert.equal(read.state, 'sent');
  assert.equal(read.proposedTotalPence, 6500 + 3000);
  assert.equal(read.proposedTotal, 95);
});

test('the customer’s quote says what was agreed before in pence, for the Approve total', async () => {
  const job = await bookedJob(null);
  const q = await draft(job.id, [PADS, FIT]);
  assert.equal((await staff(`/api/quotes/${q.id}/send`, { method: 'POST', body: {} })).status, 200);
  await inShop('UPDATE workshop_job_services SET booked_price_pence = 7001 WHERE workshop_job_id = ?', job.id);
  const theirs = await portal(await linkCode(job.id), '/quote');
  assert.equal(theirs.agreedTotalPence, 7001);
  assert.equal(theirs.agreedTotal, 70.01);
  assert.deepEqual(theirs.lines.map((l) => l.lineTotalPence), [2800, 1800]);
});

test('the booking page’s Work agreed total is the order’s lines summed by the server from the pence', async () => {
  const job = await bookedJob(200);
  const q = await draft(job.id, [PADS, FIT]);
  assert.equal((await staff(`/api/quotes/${q.id}/within-limit`, { method: 'POST', body: {} })).status, 200);
  await inShop("UPDATE sale_document_items SET line_total_pence = 3000 WHERE document_id = ? AND name = 'Shimano brake pads'", job.orderId);
  const code = await linkCode(job.id);
  const link = await portal(code);
  assert.equal(link.workTotalPence, 3000 + 1800);
  assert.equal(link.workTotal, 48);
  // With prices hidden online, no total either, as every line's price is hidden.
  await staff('/api/workshop-settings', { method: 'PUT', body: { showPricesOnline: false } });
  try {
    const hidden = await portal(code);
    assert.ok(hidden.workTotal === null && hidden.workTotalPence === null, JSON.stringify(hidden.work));
  } finally {
    await staff('/api/workshop-settings', { method: 'PUT', body: { showPricesOnline: true } });
  }
});
