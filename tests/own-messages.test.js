// A shop's own automatic messages, the server (openspec/changes/own-messages-server;
// owner setup decision 14; set-msg-new; Jack's answers of 26 Oct,
// docs/decisions/2026-10-26-receipt-and-own-messages.md). The routes, then
// what goes: queueOwnMessages is called with a fixed moment, so these never
// depend on the hour they run at; the server's own check is off here
// (WH_OWN_MESSAGES_SCAN=off) so it can't queue anything behind their backs.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic, setOpeningDays } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { queueOwnMessages } from '../server/messaging/own-messages.js';
import { makeStopCode, setStopped, stopView } from '../server/messaging/stop-codes.js';

let server;
let owner;
let alex;
before(async () => {
  server = await startLiveServer({ env: { WH_MESSAGES_TICK_MS: '200', WH_OWN_MESSAGES_SCAN: 'off' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  // Open Monday to Saturday, 9:00 to 18:00; closed on Sunday.
  await setOpeningDays(owner.shop.id, [1, 2, 3, 4, 5, 6]);
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const inShop = (fn) => runWithShop(owner.shop.id, fn);

// Wednesday 2 Sep 2026, 11:00 in London: the shop is open.
function londonInstant(date, hhmm) {
  const guess = new Date(`${date}T${hhmm}:00Z`);
  const shown = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(guess);
  const [h, m] = shown.split(':').map(Number);
  const [wh, wm] = hhmm.split(':').map(Number);
  return new Date(guess.getTime() - ((h * 60 + m) - (wh * 60 + wm)) * 60_000);
}
const NOW = londonInstant('2026-09-02', '11:00');
const LONG_AGO = '2025-01-01T00:00:00Z';

const SPRING = { name: 'Spring check', sendWhen: 'after_collected', amount: 6, unit: 'months', byText: false, byEmail: true, wording: 'Hi [Customer’s first name], time for your [Bike]’s spring check at [Shop name].' };
async function add(body = SPRING) {
  const res = await staff('/api/own-messages', { method: 'POST', body });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  // As if it was set up long ago, so what came due since counts.
  await inShop(() => prepare('UPDATE shop_messages SET active_from = ? WHERE id = ?').run(LONG_AGO, res.body.id));
  return res.body;
}
let n = 0;
async function customer({ yes = true, email = true, phone = true, channel = null } = {}) {
  n += 1;
  const body = { name: `Maya Patel ${n}`, ...(phone ? { phone: `07700 9001${String(n).padStart(2, '0')}` } : {}), ...(email ? { email: `maya${n}@example.test` } : {}) };
  const c = (await staff('/api/customers', { method: 'POST', body })).body;
  await inShop(() => prepare('UPDATE customers SET marketing_permission = ?, update_channel = COALESCE(?, update_channel) WHERE id = ?').run(yes, channel, c.id));
  return c;
}
async function job(c, { collectedAt = null, jobDate = '2026-09-07', booking = 'scheduled' } = {}) {
  const { id } = await inShop(() => prepare(
    `INSERT INTO workshop_jobs (title, customer_id, mechanic_id, job_date, start_time, end_time, booking_state, work_state, custody_state, collected_at, updated_at)
     VALUES ('Standard service', ?, ?, ?, '10:00', '11:00', ?, ?, ?, ?, now()) RETURNING id`
  ).get(c.id, alex, jobDate, booking, collectedAt ? 'complete' : 'not_started', collectedAt ? 'collected' : 'expected', collectedAt));
  return id;
}
const queued = (messageId) => inShop(() => prepare("SELECT * FROM customer_messages WHERE shop_message_id = ? AND template_key = 'own_message' ORDER BY id").all(messageId));
const run = (at = NOW) => runWithShop(owner.shop.id, () => queueOwnMessages(owner.shop.id, at));

// ---------- The routes ----------

test('the Owner adds one, and it is listed, on', async () => {
  const m = await add({ ...SPRING, name: 'Listed one' });
  assert.equal(m.enabled, true);
  const list = (await staff('/api/own-messages')).body;
  const mine = list.find((x) => x.id === m.id);
  assert.deepEqual(
    { name: mine.name, sendWhen: mine.sendWhen, amount: mine.amount, unit: mine.unit, byText: mine.byText, byEmail: mine.byEmail, wording: mine.wording },
    { name: 'Listed one', sendWhen: 'after_collected', amount: 6, unit: 'months', byText: false, byEmail: true, wording: SPRING.wording },
  );
});

test('each missing or wrong part is refused, saying what to fix', async () => {
  const cases = [
    [{ name: '  ' }, 'Give the message a name.'],
    [{ wording: '' }, 'Write what the message says.'],
    [{ amount: 0, unit: 'days' }, 'Type how long as a whole number from 1 to 365 days.'],
    [{ amount: 1.5, unit: 'days' }, 'Type how long as a whole number from 1 to 365 days.'],
    [{ amount: 25, unit: 'months' }, 'Type how long as a whole number from 1 to 24 months.'],
    [{ byText: false, byEmail: false }, 'Choose text, email or both.'],
    [{ sendWhen: 'whenever' }, 'Choose when the message goes.'],
  ];
  for (const [change, error] of cases) {
    const res = await staff('/api/own-messages', { method: 'POST', body: { ...SPRING, ...change } });
    assert.equal(res.status, 400, JSON.stringify(change));
    assert.equal(res.body.error, error);
  }
});

test('changing it, switching it off and on, and removing it', async () => {
  const m = await add({ ...SPRING, name: 'To change' });
  const changed = await staff(`/api/own-messages/${m.id}`, { method: 'PUT', body: { ...SPRING, name: 'Changed', amount: 3 } });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.equal(changed.body.name, 'Changed');
  assert.equal(changed.body.amount, 3);
  const off = await staff(`/api/own-messages/${m.id}`, { method: 'PUT', body: { ...SPRING, enabled: false } });
  assert.equal(off.body.enabled, false);
  assert.equal((await staff(`/api/own-messages/${m.id}`, { method: 'DELETE', body: {} })).status, 200);
  assert.equal((await staff('/api/own-messages')).body.some((x) => x.id === m.id), false);
  assert.equal((await staff(`/api/own-messages/${m.id}`, { method: 'DELETE', body: {} })).status, 404);
});

test('a new time, or switching back on, starts counting again, so no backlog goes at once', async () => {
  const m = await add({ ...SPRING, name: 'Retimed' });
  const before = (await inShop(() => prepare('SELECT active_from FROM shop_messages WHERE id = ?').get(m.id))).active_from;
  await staff(`/api/own-messages/${m.id}`, { method: 'PUT', body: { ...SPRING, name: 'Retimed, new words', wording: 'New words.' } });
  const sameTime = (await inShop(() => prepare('SELECT active_from FROM shop_messages WHERE id = ?').get(m.id))).active_from;
  assert.equal(sameTime.getTime(), before.getTime(), 'new words alone keep the count');
  await staff(`/api/own-messages/${m.id}`, { method: 'PUT', body: { ...SPRING, amount: 2 } });
  const retimed = (await inShop(() => prepare('SELECT active_from FROM shop_messages WHERE id = ?').get(m.id))).active_from;
  assert.ok(retimed.getTime() > before.getTime(), 'a new time starts again');
});

// ---------- What goes ----------

test('six months after collection, to a customer who said yes: once, by email, with the shop’s words, the stop line and the name as subject', async () => {
  const m = await add();
  const maya = await customer({ channel: 'email' });
  const jobId = await job(maya, { collectedAt: londonInstant('2026-03-01', '12:00').toISOString() });
  await run();
  await run();
  const rows = (await queued(m.id)).filter((r) => r.job_id === jobId);
  assert.equal(rows.length, 1, 'once');
  assert.equal(rows[0].channel, 'email');
  assert.equal(rows[0].subject, 'Spring check');
  assert.match(rows[0].body, /^Hi Maya, time for your .*spring check at North Street Cycles.* Stop these: \[link\]\.$/);
  assert.equal(rows[0].event_key, `job:${jobId}`);
});

test('not before its time, not without the yes, not to a customer with no way it goes', async () => {
  const m = await add({ ...SPRING, name: 'Not yet' });
  const early = await customer();
  const earlyJob = await job(early, { collectedAt: londonInstant('2026-04-01', '12:00').toISOString() });
  const no = await customer({ yes: false });
  const noJob = await job(no, { collectedAt: londonInstant('2026-03-01', '12:00').toISOString() });
  const textOnly = await customer({ email: false });
  const textJob = await job(textOnly, { collectedAt: londonInstant('2026-03-01', '12:00').toISOString() });
  await run();
  const jobs = (await queued(m.id)).map((r) => r.job_id);
  assert.equal(jobs.includes(earlyJob), false, 'five months is too soon');
  assert.equal(jobs.includes(noJob), false, 'no yes to offers and news');
  assert.equal(jobs.includes(textJob), false, 'sent by email only, and she has no email');
});

test('nothing for a collection before the message was set up or retimed', async () => {
  const m = await add({ ...SPRING, name: 'New one' });
  await inShop(() => prepare('UPDATE shop_messages SET active_from = ? WHERE id = ?').run(londonInstant('2026-09-01', '09:00').toISOString(), m.id));
  const c = await customer();
  const old = await job(c, { collectedAt: londonInstant('2026-02-01', '12:00').toISOString() });
  await run();
  assert.equal((await queued(m.id)).some((r) => r.job_id === old), false, 'due in August, before it was set up');
});

test('nothing while the shop is closed; it goes when the shop opens', async () => {
  const m = await add({ ...SPRING, name: 'Closed' });
  const c = await customer();
  const j = await job(c, { collectedAt: londonInstant('2026-03-01', '12:00').toISOString() });
  await run(londonInstant('2026-09-06', '11:00')); // a Sunday
  await run(londonInstant('2026-09-02', '06:00')); // before opening
  assert.equal((await queued(m.id)).some((r) => r.job_id === j), false);
  await run();
  assert.equal((await queued(m.id)).some((r) => r.job_id === j), true);
});

test('by the customer’s own way when the message goes that way; else its other way; text covers WhatsApp', async () => {
  const both = await add({ ...SPRING, name: 'Both ways', byText: true, byEmail: true });
  const prefersText = await customer({ channel: 'sms' });
  const t = await job(prefersText, { collectedAt: londonInstant('2026-03-01', '12:00').toISOString() });
  const prefersWhatsApp = await customer({ channel: 'whatsapp' });
  const w = await job(prefersWhatsApp, { collectedAt: londonInstant('2026-03-01', '12:00').toISOString() });
  const emailOnly = await add({ ...SPRING, name: 'Email only' });
  const prefersText2 = await customer({ channel: 'sms' });
  const e = await job(prefersText2, { collectedAt: londonInstant('2026-03-01', '12:00').toISOString() });
  await run();
  const byJob = async (m, jobId) => (await queued(m.id)).find((r) => r.job_id === jobId);
  assert.equal((await byJob(both, t)).channel, 'sms');
  assert.equal((await byJob(both, t)).subject, null, 'no subject on a text');
  assert.equal((await byJob(both, w)).channel, 'whatsapp');
  assert.equal((await byJob(emailOnly, e)).channel, 'email', 'she chose text, but this one goes only by email');
});

test('before a booked job: the days before, only while the booking is live and the day hasn’t passed', async () => {
  const m = await add({ ...SPRING, name: 'See you soon', sendWhen: 'before_booked', amount: 7, unit: 'days' });
  const c = await customer();
  const soon = await job(c, { jobDate: '2026-09-08' });
  const later = await job(c, { jobDate: '2026-09-20' });
  const cancelled = await job(c, { jobDate: '2026-09-05', booking: 'cancelled' });
  const past = await job(c, { jobDate: '2026-09-01' });
  await run();
  const jobs = (await queued(m.id)).map((r) => r.job_id);
  assert.equal(jobs.includes(soon), true, 'six days off');
  assert.equal(jobs.includes(later), false, 'eighteen days off');
  assert.equal(jobs.includes(cancelled), false, 'cancelled');
  assert.equal(jobs.includes(past), false, 'yesterday');
});

test('after a sale: only a sale with a customer on it, once', async () => {
  const m = await add({ ...SPRING, name: 'Thanks for shopping', sendWhen: 'after_sale', amount: 2, unit: 'days' });
  const c = await customer();
  const sale = await inShop(() => prepare("INSERT INTO sales (customer_id, subtotal, discount, total, payment_method, created_at) VALUES (?, 10, 0, 10, 'cash', ?) RETURNING id").get(c.id, londonInstant('2026-08-30', '12:00').toISOString()));
  const nobody = await inShop(() => prepare("INSERT INTO sales (customer_id, subtotal, discount, total, payment_method, created_at) VALUES (NULL, 10, 0, 10, 'cash', ?) RETURNING id").get(londonInstant('2026-08-30', '12:00').toISOString()));
  await run();
  await run();
  const rows = await queued(m.id);
  assert.equal(rows.filter((r) => r.event_key === `sale:old:${sale.id}`).length, 1);
  assert.equal(rows.some((r) => r.event_key === `sale:old:${nobody.id}`), false);
  const body = rows.find((r) => r.event_key === `sale:old:${sale.id}`).body;
  assert.match(body, /^Hi Maya, .* at North Street Cycles/);
  assert.equal(body.includes('['.concat('Bike]')), false, 'no bike on a sale: left out, never shown in brackets');
});

test('a message switched off sends nothing', async () => {
  const m = await add({ ...SPRING, name: 'Off' });
  await staff(`/api/own-messages/${m.id}`, { method: 'PUT', body: { ...SPRING, enabled: false } });
  const c = await customer();
  await job(c, { collectedAt: londonInstant('2026-03-01', '12:00').toISOString() });
  await run();
  assert.equal((await queued(m.id)).length, 0);
});

test('Stop these stops just that message for that customer; pressing again turns it back on', async () => {
  const first = await add({ ...SPRING, name: 'First' });
  const second = await add({ ...SPRING, name: 'Second' });
  const c = await customer();
  const code = await inShop(() => makeStopCode(c.id, 'own_message', first.id));
  assert.deepEqual(await inShop(() => stopView(code)), { kind: 'own_message', on: true, name: 'First' });
  assert.deepEqual(await inShop(() => setStopped(code, true)), { kind: 'own_message', on: false, name: 'First' });
  const j = await job(c, { collectedAt: londonInstant('2026-03-01', '12:00').toISOString() });
  await run();
  assert.equal((await queued(first.id)).some((r) => r.job_id === j), false, 'stopped');
  assert.equal((await queued(second.id)).some((r) => r.job_id === j), true, 'the other still goes');
  const yes = await inShop(() => prepare('SELECT marketing_permission FROM customers WHERE id = ?').get(c.id));
  assert.equal(yes.marketing_permission, true, 'her yes to offers and news stays');
  assert.equal((await inShop(() => setStopped(code, false))).on, true);
});

test('removing a message stops any of its messages still waiting', async () => {
  const m = await add({ ...SPRING, name: 'Removed' });
  const c = await customer();
  const j = await job(c, { collectedAt: londonInstant('2026-03-01', '12:00').toISOString() });
  // Queued for a day far ahead, so the server's sender can't send it first (26 Oct).
  await run(londonInstant('2099-09-02', '11:00'));
  const [row] = (await queued(m.id)).filter((r) => r.job_id === j);
  await staff(`/api/own-messages/${m.id}`, { method: 'DELETE', body: {} });
  const after = await inShop(() => prepare('SELECT intent_state, shop_message_id FROM customer_messages WHERE id = ?').get(row.id));
  assert.equal(after.intent_state, 'undone');
});

test('checked again as it goes: a customer who took back their yes gets nothing', async () => {
  const m = await add({ ...SPRING, name: 'Checked' });
  const c = await customer();
  const j = await job(c, { collectedAt: londonInstant('2026-03-01', '12:00').toISOString() });
  await inShop(() => prepare("UPDATE shop_messages SET active_from = ? WHERE id = ?").run(LONG_AGO, m.id));
  // Queue it for a day far ahead, so the server's sender can't take it before
  // the yes is taken back (it raced on a quick machine; 26 Oct), then let it come due.
  // Wednesday 2 Sep 2099, 11:00: the shop is open.
  await run(londonInstant('2099-09-02', '11:00'));
  const [row] = (await queued(m.id)).filter((r) => r.job_id === j);
  await inShop(() => prepare('UPDATE customers SET marketing_permission = false WHERE id = ?').run(c.id));
  await inShop(() => prepare("UPDATE customer_messages SET send_after = now() - interval '1 second' WHERE id = ?").run(row.id));
  // Up to 20 seconds: one sender round walks every shop in the test database,
  // 3 to 4 seconds when two test files run at once on a long-lived one (28 Oct).
  const end = Date.now() + 20_000;
  let state;
  do {
    await new Promise((r) => setTimeout(r, 150));
    state = (await inShop(() => prepare('SELECT intent_state FROM customer_messages WHERE id = ?').get(row.id))).intent_state;
  } while (!['undone', 'delivered', 'failed'].includes(state) && Date.now() < end);
  assert.equal(state, 'undone');
});

// Review findings 2 and 3.
test('before a booked job: a booking made after the message was set up still gets it, inside the time', async () => {
  const m = await add({ ...SPRING, name: 'See you Monday', sendWhen: 'before_booked', amount: 7, unit: 'days' });
  // Set up yesterday: a booking made today for five days' time is inside the seven days.
  await inShop(() => prepare('UPDATE shop_messages SET active_from = ? WHERE id = ?').run(londonInstant('2026-09-01', '12:00').toISOString(), m.id));
  const c = await customer();
  const late = await job(c, { jobDate: '2026-09-07' });
  await inShop(() => prepare('UPDATE workshop_jobs SET created_at = ? WHERE id = ?').run(londonInstant('2026-09-02', '10:00').toISOString(), late));
  const before = await job(c, { jobDate: '2026-09-06' });
  await inShop(() => prepare('UPDATE workshop_jobs SET created_at = ? WHERE id = ?').run(londonInstant('2026-08-20', '10:00').toISOString(), before));
  await run();
  const jobs = (await queued(m.id)).map((r) => r.job_id);
  assert.equal(jobs.includes(late), true, 'booked after it was set up');
  assert.equal(jobs.includes(before), false, 'booked before, and its seven days began before it was set up');
});

test('a change that leaves out On or Off keeps it as it was', async () => {
  const m = await add({ ...SPRING, name: 'Stays off' });
  await staff(`/api/own-messages/${m.id}`, { method: 'PUT', body: { ...SPRING, name: 'Stays off', enabled: false } });
  const res = await staff(`/api/own-messages/${m.id}`, { method: 'PUT', body: { ...SPRING, name: 'Stays off, new words', wording: 'New.' } });
  assert.equal(res.body.enabled, false);
});

