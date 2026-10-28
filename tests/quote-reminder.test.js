// One reminder when a quote has no answer (Jack, 1 Oct and 22 Oct;
// openspec/changes/quote-reminder).
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
  server = await startLiveServer({ env: { WH_MESSAGES_TICK_MS: '100' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'Reminder Cycles' });
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
  const sent = await staff(`/api/quotes/${q.id}/send`, { method: 'POST', body: {} });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  return { job, quote: q };
}
const reminders = async (jobId) => (await staff(`/api/messages?jobId=${jobId}`)).body.filter((m) => m.key === 'quote_reminder');
const linkCode = async (jobId) => (await staff(`/api/workshop-jobs/${jobId}/private-link`, { method: 'POST', body: {} })).body.privateLink.split('/booking/')[1];

test('the reminder waits 24 hours to start, and the shop can change it from 1 to 168', async () => {
  assert.equal((await staff('/api/workshop-settings')).body.quoteReminderHours, 24);
  for (const bad of [0, 169, 1.5, '24']) {
    const res = await staff('/api/workshop-settings', { method: 'PUT', body: { quoteReminderHours: bad } });
    assert.equal(res.status, 400, JSON.stringify(bad));
    assert.equal(res.body.error, 'Choose from 1 to 168 hours.');
  }
  const ok = await staff('/api/workshop-settings', { method: 'PUT', body: { quoteReminderHours: 48 } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.quoteReminderHours, 48);
  assert.equal((await staff('/api/workshop-settings', { method: 'PUT', body: { quoteReminderHours: 24 } })).status, 200);
});

test('sending a quote queues one reminder, in Jack’s words, for 24 hours later', async () => {
  const before = Date.now();
  const { job } = await sentQuote();
  const [r, ...more] = await reminders(job.id);
  assert.ok(r, 'a Quote reminder');
  assert.equal(more.length, 0);
  assert.equal(r.state, 'intended');
  const wait = Date.parse(r.sendAfter) - before;
  assert.ok(wait > 23.9 * 3600_000 && wait < 24.1 * 3600_000, `about 24 hours, was ${wait} ms`);
  assert.match(r.body, /^Hi Maya, a reminder from Reminder Cycles[^:]*: the quote for more work on your/);
  assert.match(r.body, /say yes or no to each part/);
});

test('answering, withdrawing or replacing the quote stops the reminder', async () => {
  const answered = await sentQuote();
  const lines = (await staff(`/api/quotes/${answered.quote.id}`)).body.lines;
  assert.equal((await staff(`/api/quotes/${answered.quote.id}/answer`, { method: 'POST', body: { via: 'phone', decisions: lines.map((l) => ({ lineId: l.id, decision: 'approved' })) } })).status, 200);
  assert.equal((await reminders(answered.job.id))[0].state, 'undone');

  const withdrawn = await sentQuote();
  assert.equal((await staff(`/api/quotes/${withdrawn.quote.id}/withdraw`, { method: 'POST', body: {} })).status, 200);
  assert.equal((await reminders(withdrawn.job.id))[0].state, 'undone');

  const replaced = await sentQuote();
  assert.equal((await staff(`/api/workshop-jobs/${replaced.job.id}/quotes`, { method: 'POST', body: { lines: [PADS, { ...PADS, description: 'Bleed rear brake' }] } })).status, 201);
  assert.equal((await reminders(replaced.job.id))[0].state, 'undone');
});

test('the customer answering online stops it too', async () => {
  const { job, quote } = await sentQuote();
  const code = await linkCode(job.id);
  const lines = (await staff(`/api/quotes/${quote.id}`)).body.lines;
  const res = await fetch(`${server.baseUrl}/api/portal/${owner.shop.slug}/booking-links/${code}/quote/answer`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ revision: 1, decisions: lines.map((l) => ({ lineId: l.id, decision: 'declined' })) }),
  });
  assert.equal(res.status, 200, await res.text());
  assert.equal((await reminders(job.id))[0].state, 'undone');
});

test('once the reminder has gone, the customer’s quote says when', async () => {
  const { job } = await sentQuote();
  const code = await linkCode(job.id);
  const read = async () => (await fetch(`${server.baseUrl}/api/portal/${owner.shop.slug}/booking-links/${code}/quote`)).json();
  assert.equal((await read()).reminderSentAt, null);
  // Bring the reminder's time forward, and let the sender's tick send it.
  await runWithShop(owner.shop.id, () => prepare(
    "UPDATE customer_messages SET send_after = now() - interval '1 minute' WHERE job_id = ? AND template_key = 'quote_reminder'"
  ).run(job.id));
  // Waits on the database, not the customer's page: the page shares the
  // booking-link limiter (30 reads in 15 minutes), and polling it 10 times a
  // second used that up before a slow sender round got to this shop, so every
  // later read was a 429 and the test failed (28 Oct). One sender round walks
  // every shop in the test database, a few seconds on a long-lived one, so
  // up to 20 seconds.
  const sent = async () => (await runWithShop(owner.shop.id, () => prepare(
    "SELECT sent_at FROM customer_messages WHERE job_id = ? AND template_key = 'quote_reminder'"
  ).get(job.id)))?.sent_at ?? null;
  const end = Date.now() + 20_000;
  let sentAt = await sent();
  while (!sentAt && Date.now() < end) {
    await new Promise((r) => setTimeout(r, 100));
    sentAt = await sent();
  }
  assert.ok(sentAt, 'the sender sent the reminder');
  // Then the customer's quote says when, once.
  const shown = (await read()).reminderSentAt;
  assert.ok(shown, 'reminderSentAt once the reminder went');
  assert.equal(Date.parse(shown), new Date(sentAt).getTime());
});

// From the fresh review: the reminder goes only for a quote still waiting on
// a job that still needs it. Checked when it's due, so every way a job moves
// on is covered.
async function bringForward(jobId) {
  await runWithShop(owner.shop.id, () => prepare(
    "UPDATE customer_messages SET send_after = now() - interval '1 minute' WHERE (job_id = ? OR job_id IS NULL) AND template_key = 'quote_reminder' AND intent_state = 'intended'"
  ).run(jobId));
}
// Until the sender's tick has dealt with every due reminder (no longer
// waiting), up to 10 seconds, so a busy machine doesn't decide the result.
async function settle() {
  for (let i = 0; i < 100; i++) {
    const waiting = await runWithShop(owner.shop.id, () => prepare(
      "SELECT count(*)::int AS n FROM customer_messages WHERE template_key = 'quote_reminder' AND intent_state IN ('intended', 'sending') AND send_after <= now()"
    ).get());
    if (waiting.n === 0) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('the sender never dealt with the due reminders');
}

test('a deleted job’s reminder never goes', async () => {
  const { job } = await sentQuote();
  const del = await staff(`/api/workshop-jobs/${job.id}`, { method: 'DELETE' });
  assert.equal(del.status, 200, JSON.stringify(del.body));
  await bringForward(job.id);
  await settle();
  const rows = await runWithShop(owner.shop.id, () => prepare(
    "SELECT intent_state, sent_at FROM customer_messages WHERE template_key = 'quote_reminder' AND job_id IS NULL AND sent_at IS NOT NULL"
  ).all());
  assert.equal(rows.length, 0, 'none sent');
});

test('a reminder due after the bike was collected doesn’t go', async () => {
  const { job } = await sentQuote();
  const now = (await staff(`/api/workshop-jobs/${job.id}`)).body;
  assert.equal((await staff(`/api/workshop-jobs/${job.id}/book-in`, { method: 'POST', body: { version: now.version } })).status, 200);
  const inShop = (await staff(`/api/workshop-jobs/${job.id}`)).body;
  const collected = await staff(`/api/workshop-jobs/${job.id}/collect`, { method: 'POST', body: { version: inShop.version } });
  assert.equal(collected.status, 200, JSON.stringify(collected.body));
  await bringForward(job.id);
  await settle();
  const [r] = await reminders(job.id);
  assert.equal(r.sentAt, null, 'not sent');
  assert.notEqual(r.state, 'intended');
});

test('a reminder due after Quote to approve was switched off doesn’t go', async () => {
  const { job } = await sentQuote();
  assert.equal((await staff('/api/message-templates/quote_to_approve', { method: 'PUT', body: { enabled: false } })).status, 200);
  try {
    await bringForward(job.id);
    await settle();
    const [r] = await reminders(job.id);
    assert.equal(r.sentAt, null, 'not sent');
  } finally {
    await staff('/api/message-templates/quote_to_approve', { method: 'PUT', body: { enabled: true } });
  }
});
