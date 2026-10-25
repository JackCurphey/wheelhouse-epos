// Review requests (openspec/changes/review-requests; account and reminders
// decisions 5 and 8; ac-review-first, ac-review-setting): off until the shop
// switches it on with its review page; set up when a bike is collected for a
// customer who said yes, at the shop's days after collection when the shop
// opens; checked and written when it goes; its own "Stop these".
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { makeStopCode } from '../server/messaging/stop-codes.js';

let server;
let owner;
let alex;
let shopName;
before(async () => {
  server = await startLiveServer({ env: { WH_MESSAGES_TICK_MS: '200' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  shopName = (await staffRequest(server.baseUrl, owner.cookie, '/api/shop-details')).body.name;
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const inShop = (fn) => runWithShop(owner.shop.id, fn);
const PAGE = 'https://g.page/r/north-street-cycles/review';
const settings = (body) => staff('/api/workshop-settings', { method: 'PUT', body });
const switchOn = (enabled) => staff('/api/message-templates/review_request', { method: 'PUT', body: { enabled } });
const requests = (jobId) => inShop(() => prepare("SELECT * FROM customer_messages WHERE job_id = ? AND template_key = 'review_request' ORDER BY id").all(jobId));
async function maya({ yes = true } = {}) {
  const customer = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } })).body;
  if (yes) await inShop(() => prepare("UPDATE customers SET service_reminders = true, review_requests = true, reminders_said_yes_at = now(), reminders_said_yes_via = 'booking' WHERE id = ?").run(customer.id));
  return customer;
}
async function collected(customer) {
  let job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-10-13', mechanicId: alex, customerId: customer.id } })).body;
  job = (await staff(`/api/workshop-jobs/${job.id}/book-in`, { method: 'POST', body: { version: job.version } })).body;
  const res = await staff(`/api/workshop-jobs/${job.id}/collect`, { method: 'POST', body: { version: job.version } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body;
}
const settled = async (id) => {
  const end = Date.now() + 8000;
  for (;;) {
    const row = await inShop(() => prepare('SELECT * FROM customer_messages WHERE id = ?').get(id));
    if (['delivered', 'undone', 'failed'].includes(row.intent_state)) return row;
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 100));
  }
};
const dueNow = (id) => inShop(() => prepare("UPDATE customer_messages SET send_after = now() - interval '1 second' WHERE id = ?").run(id));
function londonInstant(date, hhmm) {
  const guess = new Date(`${date}T${hhmm}:00Z`);
  const shown = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(guess);
  const [h, m] = shown.split(':').map(Number);
  const [wh, wm] = hhmm.split(':').map(Number);
  return new Date(guess.getTime() - ((h * 60 + m) - (wh * 60 + wm)) * 60_000);
}
const londonDate = (instant) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(instant);
const plusDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

test('off to start, with 2 days and no page; it can’t go on without a review page', async () => {
  const s = (await staff('/api/workshop-settings')).body;
  assert.equal(s.reviewPageUrl, null);
  assert.equal(s.reviewRequestDays, 2);
  const t = (await staff('/api/message-templates')).body.find((x) => x.key === 'review_request');
  assert.equal(t.enabled, false);
  const on = await switchOn(true);
  assert.equal(on.status, 400, JSON.stringify(on.body));
  assert.equal(on.body.error, 'Add your review page first, then switch this on.');
});

test('the review page and days are checked; the page can’t be cleared while it’s on', async () => {
  for (const reviewPageUrl of ['not a link', 'ftp://x.example', 'https://' + 'a'.repeat(500)]) {
    const res = await settings({ reviewPageUrl });
    assert.equal(res.status, 400, `${reviewPageUrl}: ${JSON.stringify(res.body)}`);
  }
  for (const reviewRequestDays of [0, 61, 1.5]) assert.equal((await settings({ reviewRequestDays })).status, 400);
  const saved = await settings({ reviewPageUrl: PAGE, reviewRequestDays: 3 });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.deepEqual([saved.body.reviewPageUrl, saved.body.reviewRequestDays], [PAGE, 3]);
  assert.equal((await switchOn(true)).status, 200);
  const cleared = await settings({ reviewPageUrl: null });
  assert.equal(cleared.status, 400);
  assert.equal(cleared.body.error, 'Switch review requests off first.');
  assert.equal((await switchOn(false)).status, 200);
});

test('switched on: collected for a yes, one waits until the shop opens that many days later; off or no yes, nothing', async () => {
  await settings({ reviewPageUrl: PAGE, reviewRequestDays: 3 });
  const off = await collected(await maya());
  assert.deepEqual(await requests(off.id), [], 'off: nothing');
  await switchOn(true);
  const hours = await settings({ openingHours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, open: '10:00', close: '17:00' })) });
  assert.equal(hours.status, 200, JSON.stringify(hours.body));
  const job = await collected(await maya());
  const [r] = await requests(job.id);
  assert.ok(r, 'set up');
  assert.equal(new Date(r.send_after).toISOString(), londonInstant(plusDays(londonDate(new Date()), 3), '10:00').toISOString());
  assert.equal(r.body, `Thanks for coming to ${shopName}, Maya. If you have a minute, we’d love a review: ${PAGE}. Stop these: [link].`);
  assert.deepEqual(await requests((await collected(await maya({ yes: false }))).id), [], 'no yes: nothing');
  await switchOn(false);
});

test('reopening the collection drops it; when it goes, it is checked and written then', async () => {
  await settings({ reviewPageUrl: PAGE, reviewRequestDays: 3 });
  await switchOn(true);
  const job = await collected(await maya());
  const reopened = await staff(`/api/workshop-jobs/${job.id}/reopen-custody`, { method: 'POST', body: { version: job.version } });
  assert.equal(reopened.status, 200);
  assert.equal((await requests(job.id))[0].intent_state, 'undone');
  // Written when it goes: the shop's page as it is then.
  const later = await collected(await maya());
  const [r] = await requests(later.id);
  await settings({ reviewPageUrl: 'https://g.page/r/north-street-cycles/new' });
  await dueNow(r.id);
  const sent = await settled(r.id);
  assert.equal(sent.intent_state, 'delivered');
  assert.ok(sent.body.includes('we’d love a review: https://g.page/r/north-street-cycles/new.'), sent.body);
  // Not sent once the customer stopped them.
  const stopped = await maya();
  const [s] = await requests((await collected(stopped)).id);
  await inShop(() => prepare('UPDATE customers SET review_requests = false WHERE id = ?').run(stopped.id));
  await dueNow(s.id);
  assert.equal((await settled(s.id)).intent_state, 'undone');
  await switchOn(false);
  await settings({ reviewPageUrl: PAGE });
});

test('a review request’s stop link stops review requests only, and says so', async () => {
  const customer = await maya();
  const code = await inShop(() => makeStopCode(customer.id, 'review_requests'));
  const url = `${server.baseUrl}/api/portal/${owner.shop.slug}/reminder-stops/${code}`;
  const seen = await fetch(url).then((r) => r.json());
  assert.deepEqual({ kind: seen.kind, on: seen.on }, { kind: 'review_requests', on: true });
  const stop = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stop: true }) }).then((r) => r.json());
  assert.equal(stop.on, false);
  const a = await inShop(() => prepare('SELECT service_reminders, review_requests FROM customers WHERE id = ?').get(customer.id));
  assert.deepEqual({ ...a }, { service_reminders: true, review_requests: false });
});

test('rewording it before ever switching it on leaves it off', async () => {
  // A new shop, which has never touched it.
  const fresh = await staffSignup(server.baseUrl);
  try {
    const res = await staffRequest(server.baseUrl, fresh.cookie, '/api/message-templates/review_request', { method: 'PUT', body: { wording: 'Thanks, [Customer’s first name]: [Link to review]' } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.enabled, false);
  } finally {
    await deleteTestShop(fresh.shop.id);
  }
});

test('a review stop link says whether review requests are on, not service reminders', async () => {
  const customer = await maya();
  await inShop(() => prepare('UPDATE customers SET review_requests = false WHERE id = ?').run(customer.id));
  const code = await inShop(() => makeStopCode(customer.id, 'review_requests'));
  const seen = await fetch(`${server.baseUrl}/api/portal/${owner.shop.slug}/reminder-stops/${code}`).then((r) => r.json());
  assert.equal(seen.on, false);
});
