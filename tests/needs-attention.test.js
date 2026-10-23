// Needs attention, the list behind Today's card (openspec/changes/today-page;
// op-today, dq-today-no-answer, ac-today; Jack, 30 Sep, opening the shop
// decisions 3 and 4). One list for every kind; later packages add kinds.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;
let maya;
let jamie;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Attention Cycles' });
  other = await staffSignup(server.baseUrl, { shopName: 'Elsewhere Cycles' });
  maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } })).body;
  jamie = (await staff('/api/customers', { method: 'POST', body: { name: 'Jamie Brooks', phone: '07700 900300' } })).body;
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
});

function staff(path, options, who = owner) {
  return staffRequest(server.baseUrl, who.cookie, path, options);
}
const PADS = { kind: 'part', description: 'Shimano brake pads', unitAmount: 28, need: 'needed', reason: 'Rear pads worn — replacing' };
let jobDay = 5;
async function sentQuote(customer = maya, who = owner) {
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: `2026-10-${String(jobDay++).padStart(2, '0')}`, customerId: customer.id } }, who)).body;
  const q = (await staff(`/api/workshop-jobs/${job.id}/quotes`, { method: 'POST', body: { lines: [PADS] } }, who)).body;
  assert.equal((await staff(`/api/quotes/${q.id}/send`, { method: 'POST', body: {} }, who)).status, 200);
  return { job, quote: q };
}
// As the sender does when the reminder goes (quote-no-answer.test.js).
const reminderWent = (jobId, shop = owner.shop.id, at = 'now()') => runWithShop(shop, () => prepare(
  `UPDATE customer_messages SET sent_at = ${at} WHERE job_id = ? AND template_key = 'quote_reminder'`
).run(jobId));
const attention = async (who = owner) => staff('/api/needs-attention', {}, who);
const noAnswer = (items) => items.filter((i) => i.kind === 'quote_no_answer');
const note = (jobId, from, at) => runWithShop(owner.shop.id, () => prepare(
  'INSERT INTO job_notes (workshop_job_id, from_customer, body, created_at) VALUES (?, ?, ?, ?)'
).run(jobId, from, 'Can you call me?', at));

test('a quote sent and reminded with no answer is listed with the job, the customer, the phone and when', async () => {
  const { job } = await sentQuote();
  await reminderWent(job.id);
  const res = await attention();
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const line = noAnswer(res.body.items).find((i) => i.jobId === job.id);
  assert.ok(line, 'the quote isn\'t listed');
  assert.equal(line.reference, job.reference);
  assert.equal(line.customerName, 'Maya Patel');
  assert.equal(line.phone, '07700 900142');
  assert.ok(Date.parse(line.sentAt) && Date.parse(line.reminderSentAt) >= Date.parse(line.sentAt));
});

test('not listed: a quote not yet reminded, or answered, or withdrawn', async () => {
  const waiting = await sentQuote();
  const answered = await sentQuote();
  await reminderWent(answered.job.id);
  const lines = (await staff(`/api/quotes/${answered.quote.id}`)).body.lines;
  await staff(`/api/quotes/${answered.quote.id}/answer`, { method: 'POST', body: { via: 'phone', decisions: lines.map((l) => ({ lineId: l.id, decision: 'approved' })) } });
  const withdrawn = await sentQuote();
  await reminderWent(withdrawn.job.id);
  await staff(`/api/quotes/${withdrawn.quote.id}/withdraw`, { method: 'POST', body: {} });
  const ids = noAnswer((await attention()).body.items).map((i) => i.jobId);
  for (const j of [waiting, answered, withdrawn]) assert.ok(!ids.includes(j.job.id), `job ${j.job.reference} is listed`);
});

test('not listed: a job whose booking has ended, though its quote was reminded', async () => {
  const ended = [];
  for (const state of ['cancelled', 'declined', 'expired']) {
    const { job } = await sentQuote();
    await reminderWent(job.id);
    await runWithShop(owner.shop.id, () => prepare('UPDATE workshop_jobs SET booking_state = ? WHERE id = ?').run(state, job.id));
    ended.push(job);
  }
  const ids = noAnswer((await attention()).body.items).map((i) => i.jobId);
  for (const j of ended) assert.ok(!ids.includes(j.id), `job ${j.reference} is listed`);
});

test('quotes waiting longest come first', async () => {
  const older = await sentQuote(jamie);
  const newer = await sentQuote(maya);
  // Sent three days ago and reminded two days ago, against today.
  await runWithShop(owner.shop.id, () => prepare("UPDATE workshop_quotes SET sent_at = now() - interval '3 days' WHERE id = ?").run(older.quote.id));
  await reminderWent(older.job.id, owner.shop.id, "now() - interval '2 days'");
  await reminderWent(newer.job.id);
  const ids = noAnswer((await attention()).body.items).map((i) => i.jobId);
  assert.ok(ids.includes(older.job.id) && ids.includes(newer.job.id), 'both should be listed');
  assert.ok(ids.indexOf(older.job.id) < ids.indexOf(newer.job.id), 'the older isn\'t first');
});

test('customers\' messages waiting for a reply are one line: how many, and the oldest', async () => {
  const a = await sentQuote(jamie);
  const b = await sentQuote(maya);
  await note(a.job.id, true, '2026-09-01T07:10:00Z');
  await note(b.job.id, true, '2026-09-01T06:40:00Z');
  const replies = (await attention()).body.items.filter((i) => i.kind === 'replies');
  assert.equal(replies.length, 1);
  assert.ok(replies[0].count >= 2);
  assert.equal(replies[0].oldestName, 'Maya Patel');
  assert.equal(replies[0].oldestAt, '2026-09-01T06:40:00.000Z');
});

test('another shop\'s quotes and messages never appear', async () => {
  const theirCustomer = (await staff('/api/customers', { method: 'POST', body: { name: 'Sam Reed', phone: '07700 900500' } }, other)).body;
  const theirs = await sentQuote(theirCustomer, other);
  await reminderWent(theirs.job.id, other.shop.id);
  const ids = noAnswer((await attention()).body.items).map((i) => i.jobId);
  assert.ok(!ids.includes(theirs.job.id));
});

test('a shop with nothing waiting gets an empty list', async () => {
  const fresh = await staffSignup(server.baseUrl, { shopName: 'Quiet Cycles' });
  try {
    const res = await attention(fresh);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { items: [] });
  } finally {
    await deleteTestShop(fresh.shop.id);
  }
});

test('only the Owner sees the list, until roles', async () => {
  const made = await staff('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${Date.now()}@example.test`, password: 'password123' } });
  assert.ok(made.status < 300, JSON.stringify(made.body));
  const jo = { cookie: await staffFreshCookie(made.body.loginId) };
  const res = await attention(jo);
  assert.equal(res.status, 403, JSON.stringify(res.body));
  assert.equal(res.body.code, 'owner_only');
});
