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
  let sentAt = null;
  for (let i = 0; i < 50 && !sentAt; i++) {
    await new Promise((r) => setTimeout(r, 100));
    sentAt = (await read()).reminderSentAt;
  }
  assert.ok(sentAt, 'reminderSentAt once the reminder went');
});
