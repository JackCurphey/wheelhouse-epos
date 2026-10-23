// A new quote after the customer says no to everything (Jack, 22 Oct,
// docs/decisions/2026-10-22-quote-after-declined.md), and the earlier answers
// the customer's new quote shows as history (dq-quote-newer).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let maya;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Again Cycles' });
  maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } })).body;
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

function staff(path, options) {
  return staffRequest(server.baseUrl, owner.cookie, path, options);
}
async function portal(path, options = {}) {
  const res = await fetch(`${server.baseUrl}/api/portal/${owner.shop.slug}${path}`, {
    method: options.method ?? 'GET',
    headers: { 'content-type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const PADS = { kind: 'part', description: 'Shimano brake pads', unitAmount: 28, need: 'needed', reason: 'Rear pads are worn down to 1mm.' };
const CABLE = { kind: 'labour', description: 'Replace gear cable', unitAmount: 12, need: 'optional', reason: 'Shifting is a little stiff.' };

let jobDay = 5;
async function answeredQuote(decide) {
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: `2026-10-${String(jobDay++).padStart(2, '0')}`, customerId: maya.id } })).body;
  const first = (await staff(`/api/workshop-jobs/${job.id}/quotes`, { method: 'POST', body: { lines: [PADS, CABLE] } })).body;
  assert.equal((await staff(`/api/quotes/${first.id}/send`, { method: 'POST', body: {} })).status, 200);
  const lines = (await staff(`/api/quotes/${first.id}`)).body.lines;
  const answered = await staff(`/api/quotes/${first.id}/answer`, { method: 'POST', body: { via: 'phone', decisions: lines.map((l) => ({ lineId: l.id, decision: decide(l) })) } });
  assert.equal(answered.status, 200, JSON.stringify(answered.body));
  const code = (await staff(`/api/workshop-jobs/${job.id}/private-link`, { method: 'POST', body: {} })).body.privateLink.split('/booking/')[1];
  return { job, first, code };
}

test('after saying no to everything, the shop can send a new quote', async () => {
  const { job, first, code } = await answeredQuote(() => 'declined');
  assert.equal((await staff(`/api/quotes/${first.id}`)).body.state, 'declined');
  const again = await staff(`/api/workshop-jobs/${job.id}/quotes`, { method: 'POST', body: { lines: [PADS] } });
  assert.equal(again.status, 201, JSON.stringify(again.body));
  assert.equal(again.body.revision, 2);
  assert.equal((await staff(`/api/quotes/${first.id}`)).body.state, 'superseded');
  assert.equal((await staff(`/api/quotes/${again.body.id}/send`, { method: 'POST', body: {} })).status, 200);
  const shown = await portal(`/booking-links/${code}/quote`);
  assert.equal(shown.status, 200, JSON.stringify(shown.body));
  assert.equal(shown.body.revision, 2);
  assert.deepEqual(shown.body.earlier, { agreed: [], declined: ['Shimano brake pads', 'Replace gear cable'] });
});

test('the new quote lists what was agreed and what was said no to before', async () => {
  const { job, code } = await answeredQuote((l) => (l.description === 'Shimano brake pads' ? 'approved' : 'declined'));
  const again = (await staff(`/api/workshop-jobs/${job.id}/quotes`, { method: 'POST', body: { lines: [{ ...CABLE, description: 'Replace gear cable and housing', unitAmount: 20 }] } })).body;
  assert.equal((await staff(`/api/quotes/${again.id}/send`, { method: 'POST', body: {} })).status, 200);
  const shown = (await portal(`/booking-links/${code}/quote`)).body;
  assert.deepEqual(shown.earlier, { agreed: ['Shimano brake pads'], declined: ['Replace gear cable'] });
});

test('a first quote has no earlier answers', async () => {
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: `2026-10-${String(jobDay++).padStart(2, '0')}`, customerId: maya.id } })).body;
  const q = (await staff(`/api/workshop-jobs/${job.id}/quotes`, { method: 'POST', body: { lines: [PADS] } })).body;
  assert.equal((await staff(`/api/quotes/${q.id}/send`, { method: 'POST', body: {} })).status, 200);
  const code = (await staff(`/api/workshop-jobs/${job.id}/private-link`, { method: 'POST', body: {} })).body.privateLink.split('/booking/')[1];
  assert.deepEqual((await portal(`/booking-links/${code}/quote`)).body.earlier, { agreed: [], declined: [] });
});

// From the fresh review.
async function revise(jobId, lines) {
  const q = (await staff(`/api/workshop-jobs/${jobId}/quotes`, { method: 'POST', body: { lines } })).body;
  assert.equal((await staff(`/api/quotes/${q.id}/send`, { method: 'POST', body: {} })).status, 200);
  return q;
}
async function answer(quoteId, decide) {
  const lines = (await staff(`/api/quotes/${quoteId}`)).body.lines;
  const res = await staff(`/api/quotes/${quoteId}/answer`, { method: 'POST', body: { via: 'phone', decisions: lines.map((l) => ({ lineId: l.id, decision: decide(l) })) } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
}

test('the newer quote’s agreed total counts the earlier yeses', async () => {
  const { job, code } = await answeredQuote((l) => (l.description === 'Shimano brake pads' ? 'approved' : 'declined'));
  await revise(job.id, [{ ...CABLE, description: 'Bleed rear brake', unitAmount: 15 }]);
  const shown = (await portal(`/booking-links/${code}/quote`)).body;
  assert.equal(shown.agreedTotal, 28, 'the pads she said yes to (this job has no booked services)');
});

test('a line said no to, then yes to on a later quote, is agreed, not no thanks', async () => {
  const { job, code } = await answeredQuote(() => 'declined');
  const second = await revise(job.id, [PADS]);
  await answer(second.id, () => 'approved');
  await revise(job.id, [{ ...CABLE, description: 'Bleed rear brake', unitAmount: 15 }]);
  const shown = (await portal(`/booking-links/${code}/quote`)).body;
  assert.deepEqual(shown.earlier, { agreed: ['Shimano brake pads'], declined: ['Replace gear cable'] });
  // The booking page's "Not done — you said no thanks" agrees.
  const link = (await portal(`/booking-links/${code}`)).body;
  assert.deepEqual(link.declined.map((d) => d.name), ['Replace gear cable']);
});

test('a quote changed before it was answered leaves no earlier answers', async () => {
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: `2026-10-${String(jobDay++).padStart(2, '0')}`, customerId: maya.id } })).body;
  await revise(job.id, [PADS, CABLE]);
  await revise(job.id, [PADS]);
  const code = (await staff(`/api/workshop-jobs/${job.id}/private-link`, { method: 'POST', body: {} })).body.privateLink.split('/booking/')[1];
  assert.deepEqual((await portal(`/booking-links/${code}/quote`)).body.earlier, { agreed: [], declined: [] });
});
