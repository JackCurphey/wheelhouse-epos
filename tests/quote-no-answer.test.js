// "No answer yet" after the quote reminder (Jack, 1 Oct, drop-off and quote
// decision 4; dq-today-no-answer; openspec/changes/quote-no-answer): each job
// read says when its quote was sent and when its reminder went.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let maya;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'No Answer Cycles' });
  maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } })).body;
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

function staff(path, options) {
  return staffRequest(server.baseUrl, owner.cookie, path, options);
}
const PADS = { kind: 'part', description: 'Shimano brake pads', unitAmount: 28, need: 'needed', reason: 'Worn down to 1mm.' };
let jobDay = 5;
async function sentQuote() {
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: `2026-10-${String(jobDay++).padStart(2, '0')}`, customerId: maya.id } })).body;
  const q = (await staff(`/api/workshop-jobs/${job.id}/quotes`, { method: 'POST', body: { lines: [PADS] } })).body;
  assert.equal((await staff(`/api/quotes/${q.id}/send`, { method: 'POST', body: {} })).status, 200);
  return { job, quote: q };
}
// As the sender does when the reminder goes (quote-reminder.test.js waits for the tick).
const reminderWent = (jobId) => runWithShop(owner.shop.id, () => prepare(
  "UPDATE customer_messages SET sent_at = now() WHERE job_id = ? AND template_key = 'quote_reminder'"
).run(jobId));
const read = async (jobId) => (await staff(`/api/workshop-jobs/${jobId}`)).body;
const listed = async (jobId) => (await staff('/api/workshop-jobs')).body.find((j) => j.id === jobId);

test('a sent quote says when it went, and has no reminder yet', async () => {
  const { job } = await sentQuote();
  const { quote } = await read(job.id);
  assert.equal(quote.state, 'sent');
  assert.ok(quote.sentAt, 'sentAt');
  assert.equal(quote.reminderSentAt, null);
});

test('once the reminder has gone, the job and the diary’s list say when', async () => {
  const { job } = await sentQuote();
  await reminderWent(job.id);
  const one = (await read(job.id)).quote;
  assert.ok(one.reminderSentAt, 'reminderSentAt on the job');
  assert.ok(Date.parse(one.reminderSentAt) >= Date.parse(one.sentAt));
  assert.equal((await listed(job.id)).quote.reminderSentAt, one.reminderSentAt);
});

test('answered after the reminder: no longer waiting, so no reminder time', async () => {
  const { job, quote } = await sentQuote();
  await reminderWent(job.id);
  const lines = (await staff(`/api/quotes/${quote.id}`)).body.lines;
  assert.equal((await staff(`/api/quotes/${quote.id}/answer`, { method: 'POST', body: { via: 'phone', decisions: lines.map((l) => ({ lineId: l.id, decision: 'approved' })) } })).status, 200);
  assert.equal((await read(job.id)).quote.reminderSentAt, null);
});

test('an earlier quote’s reminder doesn’t count for the new one', async () => {
  const { job, quote } = await sentQuote();
  await reminderWent(job.id);
  assert.equal((await staff(`/api/quotes/${quote.id}/withdraw`, { method: 'POST', body: {} })).status, 200);
  const next = (await staff(`/api/workshop-jobs/${job.id}/quotes`, { method: 'POST', body: { lines: [PADS] } })).body;
  // The first reminder went a moment before the new quote was sent.
  await runWithShop(owner.shop.id, () => prepare(
    "UPDATE customer_messages SET sent_at = now() - interval '1 hour' WHERE job_id = ? AND template_key = 'quote_reminder' AND sent_at IS NOT NULL"
  ).run(job.id));
  assert.equal((await staff(`/api/quotes/${next.id}/send`, { method: 'POST', body: {} })).status, 200);
  const q = (await read(job.id)).quote;
  assert.equal(q.id, next.id);
  assert.equal(q.state, 'sent');
  assert.equal(q.reminderSentAt, null);
});
