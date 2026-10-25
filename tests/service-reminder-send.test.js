// Sending service reminders (openspec/changes/service-reminder-send; account and
// reminders decision 2; Jack's answers of 25 Oct, docs/decisions/2026-10-25-morning-questions.md
// 1 to 4): set up when a bike is collected, for a customer who said yes, at the
// soonest service's months, when the shop opens; one per bike; checked and
// written again when it goes. Sending is pretend.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

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
const reminders = (jobId) => inShop(() => prepare("SELECT * FROM customer_messages WHERE job_id = ? AND template_key = 'service_reminder' ORDER BY id").all(jobId));
const service = async (name, reminderMonths) => {
  const res = await staff('/api/workshop-services', { method: 'POST', body: { name, price: 65, minutes: 60, kind: 'full', reminderMonths } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.id;
};
// Maya Patel (the drawings' example) and her Trek Domane AL 3; yes to reminders unless told otherwise.
async function maya({ yes = true } = {}) {
  const customer = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } })).body;
  if (yes) {
    await inShop(() => prepare("UPDATE customers SET service_reminders = true, review_requests = true, reminders_said_yes_at = now(), reminders_said_yes_via = 'booking' WHERE id = ?").run(customer.id));
  }
  const bikeId = await inShop(async () => (await prepare("INSERT INTO customer_bikes (customer_id, make, model) VALUES (?, 'Trek', 'Domane AL 3') RETURNING id").get(customer.id)).id);
  return { customer, bikeId };
}
async function collectedJob({ customer, bikeId }, serviceIds) {
  let job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Service', jobDate: '2026-10-13', mechanicId: alex, customerId: customer.id, bikeId, serviceIds } })).body;
  assert.ok(job.id, JSON.stringify(job));
  job = (await staff(`/api/workshop-jobs/${job.id}/book-in`, { method: 'POST', body: { version: job.version } })).body;
  const collected = await staff(`/api/workshop-jobs/${job.id}/collect`, { method: 'POST', body: { version: job.version } });
  assert.equal(collected.status, 200, JSON.stringify(collected.body));
  return collected.body;
}
// The instant a London wall-clock time is, worked out here without Postgres.
function londonInstant(date, hhmm) {
  const guess = new Date(`${date}T${hhmm}:00Z`);
  const shown = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(guess);
  const [h, m] = shown.split(':').map(Number);
  const [wh, wm] = hhmm.split(':').map(Number);
  return new Date(guess.getTime() - ((h * 60 + m) - (wh * 60 + wm)) * 60_000);
}
const londonDate = (instant) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(instant);
function plusMonths(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + n, Math.min(d, last))).toISOString().slice(0, 10);
}
const nextDay = (date) => new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
const weekday = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();
const until = async (check, ms = 8000) => {
  const end = Date.now() + ms;
  for (;;) {
    const got = await check();
    if (got) return got;
    if (Date.now() > end) throw new Error('timed out waiting');
    await new Promise((r) => setTimeout(r, 100));
  }
};
const dueNow = (id) => inShop(() => prepare("UPDATE customer_messages SET send_after = now() - interval '1 second' WHERE id = ?").run(id));
const settled = (id) => until(async () => {
  const row = await inShop(() => prepare('SELECT * FROM customer_messages WHERE id = ?').get(id));
  return ['delivered', 'undone', 'failed'].includes(row.intent_state) ? row : null;
});

test('collected: one reminder, at the soonest service’s months, naming it, when the shop opens on the next open day', async () => {
  const who = await maya();
  const standard = await service('Standard service', 12);
  const brakes = await service('Brake service', 6);
  // The due day is closed, so it goes the next day, at that day's opening time.
  const today = londonDate(new Date());
  const due = plusMonths(today, 6);
  const openDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== weekday(due));
  const hours = await staff('/api/workshop-settings', { method: 'PUT', body: { openingHours: openDays.map((d) => ({ weekday: d, open: '10:00', close: '17:00' })) } });
  assert.equal(hours.status, 200, JSON.stringify(hours.body));
  const job = await collectedJob(who, [standard, brakes]);
  const [r] = await reminders(job.id);
  assert.ok(r, 'a reminder is set up');
  assert.equal(r.intent_state, 'intended');
  assert.equal(new Date(r.send_after).toISOString(), londonInstant(nextDay(due), '10:00').toISOString());
  assert.equal(r.body, `Hi Maya, your Trek Domane AL 3 is due its Brake service at ${shopName}. Book a repair here — it’s ready to go: [link]. Stop these: [link].`);
  assert.equal(r.to_address, '07700 900142');
});

test('no reminder without a yes, or with no service that has months', async () => {
  const months = await service('Standard service', 12);
  const none = await service('Puncture repair', null);
  const noYes = await collectedJob(await maya({ yes: false }), [months]);
  assert.deepEqual(await reminders(noYes.id), []);
  const noMonths = await collectedJob(await maya(), [none]);
  assert.deepEqual(await reminders(noMonths.id), []);
});

test('the bike collected again: the earlier reminder is dropped, the newest visit’s stands', async () => {
  const who = await maya();
  const svc = await service('Standard service', 12);
  const first = await collectedJob(who, [svc]);
  const second = await collectedJob(who, [svc]);
  assert.equal((await reminders(first.id))[0].intent_state, 'undone');
  assert.equal((await reminders(second.id))[0].intent_state, 'intended');
});

test('reopening the collection drops the reminder', async () => {
  const job = await collectedJob(await maya(), [await service('Standard service', 12)]);
  const reopened = await staff(`/api/workshop-jobs/${job.id}/reopen-custody`, { method: 'POST', body: { version: job.version } });
  assert.equal(reopened.status, 200, JSON.stringify(reopened.body));
  assert.equal((await reminders(job.id))[0].intent_state, 'undone');
});

test('when it goes, its words are written then: the shop’s new wording, and the customer’s new number', async () => {
  const who = await maya();
  const job = await collectedJob(who, [await service('Standard service', 12)]);
  const [r] = await reminders(job.id);
  const put = await staff('/api/message-templates/service_reminder', { method: 'PUT', body: { wording: 'Hi [Customer’s first name], time for your [Bike]’s [Service]. [Link to book]' } });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  await inShop(() => prepare("UPDATE customers SET phone = '07700 900999' WHERE id = ?").run(who.customer.id));
  await dueNow(r.id);
  const sent = await settled(r.id);
  assert.equal(sent.intent_state, 'delivered');
  assert.equal(sent.pretend, true);
  assert.equal(sent.body, 'Hi Maya, time for your Trek Domane AL 3’s Standard service. [link] Stop these: [link].');
  assert.equal(sent.to_address, '07700 900999');
  await staff('/api/message-templates/service_reminder', { method: 'PUT', body: { wording: null } });
});

test('when it goes, it doesn’t if the customer stopped saying yes, the message is off, or the bike is booked in again', async () => {
  const svc = await service('Standard service', 12);
  // Stopped saying yes.
  const stopped = await maya();
  const [a] = await reminders((await collectedJob(stopped, [svc])).id);
  await inShop(() => prepare('UPDATE customers SET service_reminders = false WHERE id = ?').run(stopped.customer.id));
  await dueNow(a.id);
  assert.equal((await settled(a.id)).intent_state, 'undone');
  // The bike booked in again, not yet collected.
  const booked = await maya();
  const [b] = await reminders((await collectedJob(booked, [svc])).id);
  const again = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Service', jobDate: '2026-10-20', mechanicId: alex, customerId: booked.customer.id, bikeId: booked.bikeId } })).body;
  assert.ok(again.id, JSON.stringify(again));
  await dueNow(b.id);
  assert.equal((await settled(b.id)).intent_state, 'undone');
  // The message switched off.
  const [c] = await reminders((await collectedJob(await maya(), [svc])).id);
  await staff('/api/message-templates/service_reminder', { method: 'PUT', body: { enabled: false } });
  await dueNow(c.id);
  assert.equal((await settled(c.id)).intent_state, 'undone');
  await staff('/api/message-templates/service_reminder', { method: 'PUT', body: { enabled: true } });
});

test('Settings › Messages shows it, and its preview reads as drawn, ending “Stop these”', async () => {
  const list = (await staff('/api/message-templates')).body;
  const row = list.find((t) => t.key === 'service_reminder');
  assert.ok(row && row.live && row.enabled, JSON.stringify(row));
  const preview = await staff('/api/message-templates/service_reminder/preview', { method: 'POST', body: {} });
  assert.equal(preview.body.text, `Hi Maya, your Trek Domane AL 3 is due its Standard service at ${shopName}. Book a repair here — it’s ready to go: [link]. Stop these: [link].`);
});
