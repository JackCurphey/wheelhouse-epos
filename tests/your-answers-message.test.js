// The "Your answers" text after staff record an answer from a call
// (dq-record-answer; Jack, 22 Oct; openspec/changes/your-answers-message).
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
  owner = await staffSignup(server.baseUrl, { shopName: 'Answers Cycles' });
  maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } })).body;
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

function staff(path, options) {
  return staffRequest(server.baseUrl, owner.cookie, path, options);
}
const PADS = { kind: 'part', description: 'Shimano brake pads', unitAmount: 28, need: 'needed' };
const FIT = { kind: 'labour', description: 'Fit and adjust brakes', unitAmount: 18, need: 'needed' };
const CABLE = { kind: 'labour', description: 'Replace gear cable', unitAmount: 12, need: 'optional' };
let jobDay = 5;
async function sentQuote() {
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: `2026-10-${String(jobDay++).padStart(2, '0')}`, customerId: maya.id } })).body;
  const q = (await staff(`/api/workshop-jobs/${job.id}/quotes`, { method: 'POST', body: { lines: [PADS, FIT, CABLE] } })).body;
  assert.equal((await staff(`/api/quotes/${q.id}/send`, { method: 'POST', body: {} })).status, 200);
  return { job, lines: (await staff(`/api/quotes/${q.id}`)).body.lines, quoteId: q.id };
}
const record = (quoteId, via, lines, decide) => staff(`/api/quotes/${quoteId}/answer`, {
  method: 'POST', body: { via, decisions: lines.map((l) => ({ lineId: l.id, decision: decide(l) })) },
});
const told = async (jobId) => (await staff(`/api/messages?jobId=${jobId}`)).body.filter((m) => m.key === 'your_answers');

test('an answer taken by phone sends Your answers at once: what’s going ahead, its cost, and what isn’t', async () => {
  const { job, lines, quoteId } = await sentQuote();
  const res = await record(quoteId, 'phone', lines, (l) => (l.description === 'Replace gear cable' ? 'declined' : 'approved'));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const [m, ...more] = await told(job.id);
  assert.ok(m, 'a Your answers message');
  assert.equal(more.length, 0);
  assert.ok(Date.parse(m.sendAfter) - Date.now() < 5_000, 'at once');
  assert.match(m.body, /^Hi Maya, thanks for your answers about your/);
  assert.match(m.body, /Going ahead: Shimano brake pads and Fit and adjust brakes, £46\.00\. No thanks: Replace gear cable\. See it here:/);
});

test('saying no to everything: just the booked work goes ahead', async () => {
  const { job, lines, quoteId } = await sentQuote();
  assert.equal((await record(quoteId, 'phone', lines, () => 'declined')).status, 200);
  const [m] = await told(job.id);
  assert.match(m.body, /Going ahead: just the booked work\. No thanks: Shimano brake pads, Fit and adjust brakes and Replace gear cable\./);
});

test('yes to everything says nothing about no thanks', async () => {
  const { job, lines, quoteId } = await sentQuote();
  assert.equal((await record(quoteId, 'phone', lines, () => 'approved')).status, 200);
  const [m] = await told(job.id);
  assert.match(m.body, /Going ahead: Shimano brake pads, Fit and adjust brakes and Replace gear cable, £58\.00\. See it here:/);
});

test('an answer recorded in the shop sends none', async () => {
  const { job, lines, quoteId } = await sentQuote();
  assert.equal((await record(quoteId, 'in_shop', lines, () => 'approved')).status, 200);
  assert.equal((await told(job.id)).length, 0);
});
