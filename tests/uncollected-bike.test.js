// A bike left uncollected (openspec/changes/uncollected-bike; cp-setting,
// cp-today-uncollected; collect and pay review item 4, H4 and M5): the shop's
// two day counts, one "Bike still waiting" reminder, and the bike on Today's
// Needs attention with Contacted.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;
let alex;

before(async () => {
  server = await startLiveServer({ env: { WH_MESSAGES_TICK_MS: '100' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'Collection Cycles' });
  other = await staffSignup(server.baseUrl, { shopName: 'Elsewhere Cycles' });
  alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
});

function staff(path, options, who = owner) {
  return staffRequest(server.baseUrl, who.cookie, path, options);
}
const inShop = (fn, shop = owner.shop.id) => runWithShop(shop, fn);

// Aisha Khan's Cannondale Quick (the drawing's example), in the shop and in
// progress, with £111.00 of work on its order.
let day = 1;
async function aishasJob({ name = 'Aisha Khan', phone = '07700 900300' } = {}) {
  const customer = (await staff('/api/customers', { method: 'POST', body: { name, phone } })).body;
  const bikeId = await inShop(async () => (await prepare("INSERT INTO customer_bikes (customer_id, make, model) VALUES (?, 'Cannondale', 'Quick') RETURNING id").get(customer.id)).id);
  let job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Safety check', jobDate: `2026-10-${String(day++).padStart(2, '0')}`, mechanicId: alex, customerId: customer.id, bikeId } })).body;
  assert.ok(job.id, JSON.stringify(job));
  for (const step of ['book-in', 'start']) job = (await staff(`/api/workshop-jobs/${job.id}/${step}`, { method: 'POST', body: { version: job.version } })).body;
  const items = await staff(`/api/sale-documents/${job.orderId}/items`, { method: 'PUT', body: { items: [{ lineType: 'labour', name: 'Safety check', unitPrice: 111, minutes: 60 }] } });
  assert.equal(items.status, 200, JSON.stringify(items.body));
  return { customer, job };
}
async function finished(opts) {
  const { customer, job } = await aishasJob(opts);
  const res = await staff(`/api/workshop-jobs/${job.id}/finish`, { method: 'POST', body: { version: job.version, signedOffBy: alex } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return { customer, job: (await staff(`/api/workshop-jobs/${job.id}`)).body };
}
const stillWaiting = async (jobId) => (await staff(`/api/messages?jobId=${jobId}`)).body.filter((m) => m.key === 'bike_still_waiting');
// Ready this many days ago, as if the work had been marked ready then.
const readyDaysAgo = (jobId, days) => inShop(() => prepare(`UPDATE workshop_jobs SET signed_off_at = now() - interval '${days} days' WHERE id = ?`).run(jobId));
const uncollected = async (who = owner) => (await staff('/api/needs-attention', {}, who)).body.items.filter((i) => i.kind === 'uncollected');

// Bike ready goes first, then its reminder: each brought forward and sent in turn.
async function bringForward(jobId) {
  for (const key of ['bike_ready', 'bike_still_waiting']) {
    await inShop(() => prepare(
      "UPDATE customer_messages SET send_after = now() - interval '1 minute' WHERE job_id = ? AND template_key = ? AND intent_state = 'intended'"
    ).run(jobId, key));
    await settle(jobId);
  }
}
// Until the sender's tick has dealt with the job's due messages, up to 10 seconds.
async function settle(jobId) {
  for (let i = 0; i < 100; i++) {
    const { n } = await inShop(() => prepare(
      "SELECT count(*)::int AS n FROM customer_messages WHERE job_id = ? AND intent_state IN ('intended', 'sending') AND send_after <= now()"
    ).get(jobId));
    if (n === 0) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('the sender never dealt with the due messages');
}

test('the two day counts start at 3 and 7, save, and Today’s must be longer than the reminder’s', async () => {
  const start = (await staff('/api/workshop-settings')).body;
  assert.equal(start.collectionReminderDays, 3);
  assert.equal(start.collectionTodayDays, 7);
  const ok = await staff('/api/workshop-settings', { method: 'PUT', body: { collectionReminderDays: 4, collectionTodayDays: 10 } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.collectionReminderDays, 4);
  assert.equal(ok.body.collectionTodayDays, 10);
  const same = await staff('/api/workshop-settings', { method: 'PUT', body: { collectionTodayDays: 4 } });
  assert.equal(same.status, 400);
  assert.equal(same.body.error, 'Show it on Today after more days than the reminder.');
  for (const bad of [0, 61, 1.5, '3']) {
    const res = await staff('/api/workshop-settings', { method: 'PUT', body: { collectionReminderDays: bad } });
    assert.equal(res.status, 400, JSON.stringify(bad));
    assert.equal(res.body.error, 'Choose from 1 to 60 days.');
  }
  for (const bad of [1, 91]) {
    const res = await staff('/api/workshop-settings', { method: 'PUT', body: { collectionTodayDays: bad } });
    assert.equal(res.status, 400, JSON.stringify(bad));
    assert.equal(res.body.error, 'Choose from 2 to 90 days.');
  }
  assert.equal((await staff('/api/workshop-settings')).body.collectionTodayDays, 10, 'a refused save changes nothing');
  assert.equal((await staff('/api/workshop-settings', { method: 'PUT', body: { collectionReminderDays: 3, collectionTodayDays: 7 } })).status, 200);
});

test('marking the work ready queues one Bike still waiting, in the drawn words, for the days set', async () => {
  const before = Date.now();
  const { job } = await finished();
  const [r, ...more] = await stillWaiting(job.id);
  assert.ok(r, 'a Bike still waiting');
  assert.equal(more.length, 0);
  assert.equal(r.state, 'intended');
  const wait = Date.parse(r.sendAfter) - before;
  assert.ok(wait > 2.99 * 86400_000 && wait < 3.01 * 86400_000, `about 3 days, was ${wait} ms`);
  assert.match(r.body, /^Hi Aisha, just a reminder that your Cannondale Quick is ready to collect from Collection Cycles[^.]*\. £111\.00 to pay on collection\. See what we did: \S+\. Job WH-\d+\. We’re open /);
});

test('reopening the work stops the reminder', async () => {
  const { job } = await finished();
  const res = await staff(`/api/workshop-jobs/${job.id}/reopen-work`, { method: 'POST', body: { version: job.version } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal((await stillWaiting(job.id))[0].state, 'undone');
});

test('when it’s due, it goes for a bike still waiting', async () => {
  const { job } = await finished();
  await bringForward(job.id);
  const [r] = await stillWaiting(job.id);
  assert.ok(r.sentAt, `sent, was ${r.state}`);
});

test('when it’s due, it doesn’t go if Bike ready was undone in its minute', async () => {
  const { job } = await finished();
  const [ready] = (await staff(`/api/messages?jobId=${job.id}`)).body.filter((m) => m.key === 'bike_ready');
  assert.equal((await staff(`/api/messages/${ready.id}/undo`, { method: 'POST', body: {} })).status, 200);
  await bringForward(job.id);
  const [r] = await stillWaiting(job.id);
  assert.equal(r.sentAt, null, 'sent after Bike ready was undone');
  assert.notEqual(r.state, 'intended');
});

async function notSent(job) {
  await bringForward(job.id);
  const [r] = await stillWaiting(job.id);
  assert.equal(r.sentAt, null, `job ${job.reference} was sent`);
  assert.notEqual(r.state, 'intended');
}

test('when it’s due, it doesn’t go once the bike is collected', async () => {
  const { job } = await finished();
  assert.equal((await staff(`/api/workshop-jobs/${job.id}/collect`, { method: 'POST', body: { version: job.version } })).status, 200);
  await notSent(job);
});

test('when it’s due, it doesn’t go once the order is paid', async () => {
  const { job } = await finished();
  await inShop(() => prepare("UPDATE sale_documents SET status = 'converted' WHERE id = ?").run(job.orderId));
  await notSent(job);
});

test('when it’s due, it doesn’t go once the message is switched off', async () => {
  const { job } = await finished();
  // Bike ready has gone; then the shop switches the reminder off.
  await inShop(() => prepare(
    "UPDATE customer_messages SET send_after = now() - interval '1 minute' WHERE job_id = ? AND template_key = 'bike_ready'"
  ).run(job.id));
  await settle(job.id);
  assert.equal((await staff('/api/message-templates/bike_still_waiting', { method: 'PUT', body: { enabled: false } })).status, 200);
  try {
    await notSent(job);
  } finally {
    await staff('/api/message-templates/bike_still_waiting', { method: 'PUT', body: { enabled: true } });
  }
});

test('Needs attention lists a bike ready longer than the Today count, oldest first, with what its line shows', async () => {
  const older = await finished({ name: 'Aisha Khan' });
  const newer = await finished({ name: 'Sam Reed', phone: '07700 900500' });
  const recent = await finished({ name: 'Lena Fox', phone: '07700 900600' });
  await readyDaysAgo(older.job.id, 9);
  await readyDaysAgo(newer.job.id, 8);
  await readyDaysAgo(recent.job.id, 6);
  await bringForward(older.job.id);
  const items = await uncollected();
  const ids = items.map((i) => i.jobId);
  assert.ok(!ids.includes(recent.job.id), 'six days isn’t past seven');
  assert.ok(ids.indexOf(older.job.id) >= 0 && ids.indexOf(older.job.id) < ids.indexOf(newer.job.id), JSON.stringify(ids));
  const line = items.find((i) => i.jobId === older.job.id);
  assert.equal(line.reference, older.job.reference);
  assert.equal(line.customerName, 'Aisha Khan');
  assert.equal(line.bikeLabel, 'Cannondale Quick');
  assert.equal(line.phone, '07700 900300');
  assert.ok(Date.parse(line.readySince) < Date.now() - 8.9 * 86400_000, line.readySince);
  assert.ok(Date.parse(line.reminderSentAt), 'when the reminder went');
  assert.equal(items.find((i) => i.jobId === newer.job.id).reminderSentAt, null);
});

test('a collected bike leaves the list by itself', async () => {
  const { job } = await finished();
  await readyDaysAgo(job.id, 8);
  assert.ok((await uncollected()).some((i) => i.jobId === job.id));
  assert.equal((await staff(`/api/workshop-jobs/${job.id}/collect`, { method: 'POST', body: { version: job.version } })).status, 200);
  assert.ok(!(await uncollected()).some((i) => i.jobId === job.id));
});

test('Contacted records who and when and takes the bike off; finished again, it counts afresh', async () => {
  const { job } = await finished();
  await readyDaysAgo(job.id, 8);
  const res = await staff(`/api/workshop-jobs/${job.id}/contacted`, { method: 'POST', body: {} });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(!(await uncollected()).some((i) => i.jobId === job.id));
  const row = await inShop(() => prepare('SELECT uncollected_contacted_at, uncollected_contacted_by_login_id FROM workshop_jobs WHERE id = ?').get(job.id));
  assert.ok(row.uncollected_contacted_at, 'when');
  assert.ok(row.uncollected_contacted_by_login_id, 'who');
  // Reopened and marked ready again: the new ready time counts, and Contacted before it doesn't.
  let now = (await staff(`/api/workshop-jobs/${job.id}`)).body;
  now = (await staff(`/api/workshop-jobs/${job.id}/reopen-work`, { method: 'POST', body: { version: now.version } })).body;
  assert.equal((await staff(`/api/workshop-jobs/${job.id}/finish`, { method: 'POST', body: { version: now.version, signedOffBy: alex } })).status, 200);
  await inShop(() => prepare("UPDATE workshop_jobs SET signed_off_at = now() - interval '8 days', uncollected_contacted_at = now() - interval '9 days' WHERE id = ?").run(job.id));
  assert.ok((await uncollected()).some((i) => i.jobId === job.id));
});

test('Contacted is refused for a bike not on the list, and for Staff', async () => {
  const { job } = await finished();
  const early = await staff(`/api/workshop-jobs/${job.id}/contacted`, { method: 'POST', body: {} });
  assert.equal(early.status, 409, JSON.stringify(early.body));
  await readyDaysAgo(job.id, 8);
  const made = await staff('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${Date.now()}@example.test`, password: 'password123' } });
  assert.ok(made.status < 300, JSON.stringify(made.body));
  const jo = { cookie: await staffFreshCookie(made.body.loginId) };
  const res = await staff(`/api/workshop-jobs/${job.id}/contacted`, { method: 'POST', body: {} }, jo);
  assert.equal(res.status, 403, JSON.stringify(res.body));
  assert.ok((await uncollected()).some((i) => i.jobId === job.id), 'still listed');
});

test('another shop’s bikes never appear', async () => {
  const theirs = await inShop(async () => {
    const c = await prepare("INSERT INTO customers (name, phone) VALUES ('Sam Reed', '07700 900500') RETURNING id").get();
    return prepare(
      "INSERT INTO workshop_jobs (title, job_date, customer_id, custody_state, work_state, signed_off_at) VALUES ('Safety check', '2026-10-01', ?, 'in_shop', 'complete', now() - interval '20 days') RETURNING id"
    ).get(c.id);
  }, other.shop.id);
  assert.ok(!(await uncollected()).some((i) => i.jobId === theirs.id));
});
