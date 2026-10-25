// "Stop these" for service reminders (openspec/changes/stop-reminders; account
// and reminders decision 6; Jack's answer 5 of 25 Oct): a code that needs no
// sign-in and never runs out; opening it changes nothing; a press stops them,
// another turns them back on as a yes from the stop page; a made-up code is
// refused like any other. The link is kept with the message and put back when
// it goes.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { makeStopCode, stopLink } from '../server/messaging/stop-codes.js';

let server;
let owner;
let other;
let alex;
before(async () => {
  server = await startLiveServer({ env: { WH_MESSAGES_TICK_MS: '200' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  other = await staffSignup(server.baseUrl);
  alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const inShop = (fn) => runWithShop(owner.shop.id, fn);
const url = (code, slug = owner.shop.slug) => `${server.baseUrl}/api/portal/${slug}/reminder-stops/${code}`;
const get = (code, slug) => fetch(url(code, slug)).then(async (r) => ({ status: r.status, body: await r.json() }));
const post = (code, body, slug) => fetch(url(code, slug), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json() }));
// Maya Patel (the drawings' example), who said yes when booking.
async function maya() {
  const customer = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } })).body;
  await inShop(() => prepare("UPDATE customers SET service_reminders = true, review_requests = true, reminders_said_yes_at = now() - interval '1 day', reminders_said_yes_via = 'booking' WHERE id = ?").run(customer.id));
  return customer;
}
const answers = (id) => inShop(() => prepare('SELECT service_reminders, review_requests, reminders_said_yes_via, reminders_said_yes_at FROM customers WHERE id = ?').get(id));

test('opening the link changes nothing; a press stops them; another turns them back on, as a yes from the stop page', async () => {
  const customer = await maya();
  const code = await inShop(() => makeStopCode(customer.id));
  const before = await answers(customer.id);
  const seen = await get(code);
  assert.equal(seen.status, 200, JSON.stringify(seen.body));
  assert.equal(seen.body.on, true);
  assert.equal(seen.body.shopName, (await staff('/api/shop-details')).body.name);
  assert.deepEqual({ ...(await answers(customer.id)) }, { ...before }, 'opening it changes nothing');
  const stopped = await post(code, { stop: true });
  assert.equal(stopped.status, 200, JSON.stringify(stopped.body));
  assert.equal(stopped.body.on, false);
  const off = await answers(customer.id);
  assert.equal(off.service_reminders, false);
  assert.equal(off.review_requests, true, 'only service reminders stop');
  const back = await post(code, { stop: false });
  assert.equal(back.body.on, true);
  const on = await answers(customer.id);
  assert.equal(on.service_reminders, true);
  assert.equal(on.reminders_said_yes_via, 'stop_page');
  assert.ok(on.reminders_said_yes_at > before.reminders_said_yes_at, 'the yes is dated now');
  // The code still works: stop again.
  assert.equal((await post(code, { stop: true })).body.on, false);
});

test('a made-up, malformed or other shop’s code is refused alike, and nothing about anyone is said', async () => {
  const customer = await maya();
  const code = await inShop(() => makeStopCode(customer.id));
  const made = 'a'.repeat(64);
  const refusals = [await get(made), await get('not-a-code'), await get(code, other.shop.slug), await post(made, { stop: true })];
  for (const r of refusals) {
    assert.equal(r.status, 404, JSON.stringify(r.body));
    assert.deepEqual(r.body, { error: 'This link doesn’t work' });
  }
  assert.equal((await answers(customer.id)).service_reminders, true);
  assert.equal((await post(code, { stop: 'yes' })).status, 400);
});

test('the link is the shop’s stop page with a fresh code that works', async () => {
  const customer = await maya();
  const link = await inShop(() => stopLink('https://shop.example', owner.shop.slug, customer.id));
  const m = link.match(new RegExp(`^https://shop\\.example/book/${owner.shop.slug}/stop/([0-9a-f]{64})$`));
  assert.ok(m, link);
  assert.equal((await get(m[1])).body.on, true);
});

test('the reminder keeps its Stop these line, and puts it back after the shop’s words when it goes', async () => {
  const customer = await maya();
  const svc = (await staff('/api/workshop-services', { method: 'POST', body: { name: 'Standard service', price: 65, minutes: 60, kind: 'full', reminderMonths: 12 } })).body.id;
  const bikeId = await inShop(async () => (await prepare("INSERT INTO customer_bikes (customer_id, make, model) VALUES (?, 'Trek', 'Domane AL 3') RETURNING id").get(customer.id)).id);
  let job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Service', jobDate: '2026-10-13', mechanicId: alex, customerId: customer.id, bikeId, serviceIds: [svc] } })).body;
  job = (await staff(`/api/workshop-jobs/${job.id}/book-in`, { method: 'POST', body: { version: job.version } })).body;
  assert.equal((await staff(`/api/workshop-jobs/${job.id}/collect`, { method: 'POST', body: { version: job.version } })).status, 200);
  const r = await inShop(() => prepare("SELECT * FROM customer_messages WHERE job_id = ? AND template_key = 'service_reminder'").get(job.id));
  // Pretend sending: the link reads [link], as every pretend link does.
  assert.equal(r.ending, 'Stop these: [link].');
  // The kept line is what goes, whatever the shop's words.
  await inShop(() => prepare("UPDATE customer_messages SET ending = 'Stop these: https://shop.example/book/x/stop/abc.', send_after = now() - interval '1 second' WHERE id = ?").run(r.id));
  const end = Date.now() + 8000;
  let sent;
  while (Date.now() < end) {
    sent = await inShop(() => prepare('SELECT * FROM customer_messages WHERE id = ?').get(r.id));
    if (sent.intent_state === 'delivered') break;
    await new Promise((res) => setTimeout(res, 100));
  }
  assert.equal(sent.intent_state, 'delivered');
  assert.ok(sent.body.endsWith('[link]. Stop these: https://shop.example/book/x/stop/abc.'), sent.body);
});

// Review: a merge moves the duplicate's stop codes to the kept record, so a
// link from before the merge stops the kept record's reminders; Undo puts them back.
test('after a merge, a stop link made for the duplicate stops the kept record’s reminders', async () => {
  const kept = await maya();
  const guest = await maya();
  const code = await inShop(() => makeStopCode(guest.id));
  const merged = await staff(`/api/customers/${kept.id}/merge`, { method: 'POST', body: { otherId: guest.id, keep: {} } });
  assert.equal(merged.status, 200, JSON.stringify(merged.body));
  assert.equal((await post(code, { stop: true })).body.on, false);
  assert.equal((await answers(kept.id)).service_reminders, false, 'the kept record stops');
  const undone = await staff(`/api/customer-merges/${merged.body.id}/undo`, { method: 'POST', body: {} });
  assert.equal(undone.status, 200, JSON.stringify(undone.body));
  const owner = await inShop(() => prepare('SELECT customer_id FROM reminder_stop_codes ORDER BY id DESC LIMIT 1').get());
  assert.equal(owner.customer_id, guest.id, 'Undo gives the code back');
});

// Last in this file: it uses up the attempts. Codes can't be churned through.
test('too many attempts from one place are refused for a while', async () => {
  let last;
  for (let i = 0; i < 31; i++) last = await get('b'.repeat(64));
  assert.equal(last.status, 429, JSON.stringify(last.body));
});
