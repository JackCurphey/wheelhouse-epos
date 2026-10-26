// The messaging core never takes a second database connection while the shop's
// one is held (openspec/changes/server-stays-up-when-busy). Setting up a
// service reminder and a review request when a bike is collected, writing them
// when they go, and finding a shop's own message after a sale each read the
// shop's name with pool.query from inside runWithShop: at a busy moment every
// one of the pool's 10 connections was held by a request waiting for an
// eleventh, until the 5-second wait failed them. Sending is pretend.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic, setOpeningDays } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { serviceReminderNow } from '../server/messaging/service-reminders.js';
import { reviewRequestNow } from '../server/messaging/review-requests.js';
import { queueOwnMessages } from '../server/messaging/own-messages.js';

// More than the pool's 10 connections, so a double checkout cannot all fit.
const AT_ONCE = 12;
// Under the pool's 5-second connection wait: a stall shows as a failure here
// rather than as a slow pass.
const QUICKLY_MS = 4000;
const PAGE = 'https://g.page/r/north-street-cycles/review';

let server;
let owner;
let alex;
let shopName;
let serviceId;
before(async () => {
  // The server's own once-a-minute check of the shop's own messages is off, so
  // the after-sale test below is the only thing that finds its sale.
  server = await startLiveServer({ env: { WH_OWN_MESSAGES_SCAN: 'off' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  shopName = (await staff('/api/shop-details')).body.name;
  const service = await staff('/api/workshop-services', { method: 'POST', body: { name: 'Brake service', price: 65, minutes: 60, kind: 'full', reminderMonths: 6 } });
  assert.equal(service.status, 201, JSON.stringify(service.body));
  serviceId = service.body.id;
  assert.equal((await staff('/api/workshop-settings', { method: 'PUT', body: { reviewPageUrl: PAGE, reviewRequestDays: 3 } })).status, 200);
  assert.equal((await staff('/api/message-templates/review_request', { method: 'PUT', body: { enabled: true } })).status, 200);
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const inShop = (fn) => runWithShop(owner.shop.id, fn);
const statuses = (answers) => answers.map((a) => a.status);
async function burst(make) {
  const started = Date.now();
  const answers = await Promise.all(Array.from({ length: AT_ONCE }, (_, i) => make(i)));
  return { answers, took: Date.now() - started };
}

// Every connection in this test's own pool but one is held, as at a busy
// moment; runWithShop takes the last one, so a second checkout from inside it
// can only wait for the 5-second timeout.
async function withEveryOtherConnectionHeld(fn) {
  const held = await Promise.all(Array.from({ length: pool.options.max - 1 }, () => pool.connect()));
  const started = Date.now();
  try {
    return { result: await fn(), took: Date.now() - started };
  } finally {
    for (const client of held) client.release();
  }
}

// Maya Patel (the drawings' example) and her Trek Domane AL 3, yes to reminders and review requests.
async function maya(n) {
  const customer = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: `07700 9001${String(n).padStart(2, '0')}` } })).body;
  await inShop(() => prepare("UPDATE customers SET service_reminders = true, review_requests = true, reminders_said_yes_at = now(), reminders_said_yes_via = 'booking' WHERE id = ?").run(customer.id));
  const bikeId = await inShop(async () => (await prepare("INSERT INTO customer_bikes (customer_id, make, model) VALUES (?, 'Trek', 'Domane AL 3') RETURNING id").get(customer.id)).id);
  return { customer, bikeId };
}

// One job booked in for a new Maya, ready to collect.
async function bookedIn(i) {
  const who = await maya(i);
  const made = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Service', jobDate: `2026-10-${String(i + 1).padStart(2, '0')}`, mechanicId: alex, customerId: who.customer.id, bikeId: who.bikeId, serviceIds: [serviceId] } })).body;
  assert.ok(made.id, JSON.stringify(made));
  const booked = (await staff(`/api/workshop-jobs/${made.id}/book-in`, { method: 'POST', body: { version: made.version } })).body;
  assert.ok(booked.version, JSON.stringify(booked));
  return booked;
}
const collect = (job) => staff(`/api/workshop-jobs/${job.id}/collect`, { method: 'POST', body: { version: job.version } });
const waiting = async (jobId) => (await inShop(() => prepare("SELECT template_key FROM customer_messages WHERE job_id = ? AND intent_state = 'intended' ORDER BY template_key").all(jobId))).map((r) => r.template_key);

test(`${AT_ONCE} bikes collected at once each set up a service reminder and a review request, quickly`, async () => {
  const jobs = [];
  for (let i = 0; i < AT_ONCE; i++) jobs.push(await bookedIn(i));
  // Open all 10 of the server's pooled connections first, as a shop that has
  // been running for a while would have. With a cold pool, opening each new
  // connection is slow enough to spread a burst out and hide the stall.
  const warm = await burst(() => staff('/api/label-settings'));
  assert.deepEqual(statuses(warm.answers), Array(AT_ONCE).fill(200));

  const { answers, took } = await burst((i) => collect(jobs[i]));
  assert.deepEqual(statuses(answers), Array(AT_ONCE).fill(200), JSON.stringify(answers.map((a) => a.body?.error ?? a.status)));
  assert.ok(took < QUICKLY_MS, `took ${took}ms`);
  // A message that can't be set up is logged, not an error, so the rows are what show it.
  for (const job of jobs) assert.deepEqual(await waiting(job.id), ['review_request', 'service_reminder'], `job ${job.id}`);
});

for (const [i, key, writeNow] of [[20, 'service_reminder', serviceReminderNow], [21, 'review_request', reviewRequestNow]]) {
  test(`a ${key} is written when it goes, at once, with every other connection held`, async () => {
    const job = await bookedIn(i);
    assert.equal((await collect(job)).status, 200);
    const m = await inShop(() => prepare('SELECT * FROM customer_messages WHERE job_id = ? AND template_key = ?').get(job.id, key));
    assert.ok(m, `the ${key} was set up`);
    const { result, took } = await withEveryOtherConnectionHeld(() => inShop(() => writeNow(m, owner.shop.id)));
    assert.ok(took < QUICKLY_MS, `took ${took}ms`);
    assert.ok(result?.body.includes(shopName), JSON.stringify(result));
  });
}

test('a shop’s own message after a sale is found at once, with every other connection held', async () => {
  // Wednesday 2 Sep 2026, 11:00 in London, two days after the sale: the shop is open.
  const now = new Date('2026-09-02T10:00:00Z');
  await setOpeningDays(owner.shop.id, [1, 2, 3, 4, 5, 6]);
  const made = await staff('/api/own-messages', { method: 'POST', body: { name: 'Thanks for shopping', sendWhen: 'after_sale', amount: 2, unit: 'days', byText: false, byEmail: true, wording: 'Hi [Customer’s first name], thanks for shopping at [Shop name].' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  await inShop(() => prepare('UPDATE shop_messages SET active_from = ? WHERE id = ?').run('2025-01-01T00:00:00Z', made.body.id));
  const c = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', email: 'maya.sale@example.test' } })).body;
  await inShop(() => prepare('UPDATE customers SET marketing_permission = true WHERE id = ?').run(c.id));
  await inShop(() => prepare("INSERT INTO sales (customer_id, subtotal, discount, total, payment_method, created_at) VALUES (?, 10, 0, 10, 'cash', ?)").run(c.id, '2026-08-30T11:00:00Z'));

  const { result, took } = await withEveryOtherConnectionHeld(() => inShop(() => queueOwnMessages(owner.shop.id, now)));
  assert.ok(took < QUICKLY_MS, `took ${took}ms`);
  assert.equal(result, 1);
  const [row] = await inShop(() => prepare('SELECT body FROM customer_messages WHERE shop_message_id = ?').all(made.body.id));
  assert.ok(row.body.startsWith(`Hi Maya, thanks for shopping at ${shopName}.`), row.body);
});
