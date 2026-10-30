// Asking to delete your account (openspec/changes/delete-account, design 3;
// ac-delete, ac-account-delete-pending, ac-account-delete-cancelled; account
// and reminders decision 4 and audit H3; coverage walks answer 4): the
// customer asks from their account, once, and can cancel.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { runWithShop, prepare, pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { futureDate } from './helpers/workshopFixtures.js';
import { bookingLockKey } from '../server/capacity.js';
import { BOOKING_CONTACT } from './helpers/bookable.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;

const staff = (p, options, who = owner) => staffRequest(server.baseUrl, who.cookie, p, options);
const inShop = (fn, shop = owner.shop.id) => runWithShop(shop, fn);

async function portal(p, { cookie, method = 'GET', shop = owner, headers = {} } = {}) {
  const res = await fetch(`${server.baseUrl}/api/portal/${shop.shop.slug}${p}`, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers },
    body: method === 'GET' ? undefined : '{}',
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

let network = 0;
async function signIn(email, shop = owner) {
  const ip = `203.0.113.${++network}`;
  const post = (p, body) => fetch(`${server.baseUrl}/api/portal/${shop.shop.slug}${p}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body),
  });
  await post('/sign-in/code', { email });
  const { code } = await runWithShop(shop.shop.id, () => prepare('SELECT code FROM pretend_signin_codes WHERE email = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1').get(email));
  const res = await post('/sign-in/check', { email, code });
  assert.equal(res.status, 200, await res.text());
  return res.headers.get('set-cookie').split(';')[0];
}

// A customer of North Street Cycles with an online account of their own.
async function customer(name = 'Maya Patel') {
  const email = `c-${randomUUID().slice(0, 8)}@example.test`;
  const made = (await staff('/api/customers', { method: 'POST', body: { name, email, phone: '07700 900 142' } })).body;
  await inShop(() => prepare('UPDATE customers SET email_from_customer = true WHERE id = ?').run(made.id));
  const cookie = await signIn(email);
  const { id: loginId } = await inShop(() => prepare('SELECT id FROM customer_logins WHERE customer_id = ?').get(made.id));
  return { id: made.id, email, cookie, loginId };
}

// The shop's day for a moment, and a month on, as the database works them out.
const shopDay = (sqlMoment) => inShop(async () => (await prepare(
  `SELECT to_char((${sqlMoment}) AT TIME ZONE coalesce((SELECT time_zone FROM workshop_settings LIMIT 1), 'Europe/London'), 'YYYY-MM-DD') AS day`
).get()).day);
const monthOn = (sqlMoment) => inShop(async () => (await prepare(
  `SELECT to_char(((${sqlMoment}) AT TIME ZONE coalesce((SELECT time_zone FROM workshop_settings LIMIT 1), 'Europe/London'))::date + interval '1 month', 'YYYY-MM-DD') AS day`
).get()).day);

const ask = (c) => portal('/me/delete-request', { cookie: c.cookie, method: 'POST' });
const openFor = (customerId) => inShop(() => prepare("SELECT * FROM privacy_requests WHERE customer_id = ? AND kind = 'delete' AND done_at IS NULL AND cancelled_at IS NULL").all(customerId));
const jobFor = (customerId, custody = 'collected') => inShop(async () => {
  const { id } = await prepare(
    `INSERT INTO workshop_jobs (title, customer_id, job_date, start_time, end_time, booking_state, work_state, custody_state, notes, updated_at)
     VALUES ('Standard service', ?, '2026-09-05', '10:00', '11:00', 'scheduled', ?, ?, '[Shop’s workshop note]', now()) RETURNING id, reference`
  ).get(customerId, custody === 'expected' ? 'not_started' : 'complete', custody);
  return (await prepare('SELECT id, reference FROM workshop_jobs WHERE id = ?').get(id));
});

before(async () => {
  server = await startLiveServer({ env: { TRUST_PROXY: '1', CUSTOMER_SIGNIN_PROVIDER: 'pretend', APP_PUBLIC_URL: 'https://wh.test' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  other = await staffSignup(server.baseUrl, { shopName: 'Elsewhere Cycles' });
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
});

// ---------- The customer asks, and can cancel ----------

test('Maya asks to delete her account: one request from her account, shown with when it’s done by', async () => {
  const maya = await customer();
  const res = await ask(maya);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const askedOn = await shopDay('now()');
  const finishBy = await monthOn('now()');
  assert.deepEqual(res.body.deletion, { askedOn, finishBy });
  const [row] = await openFor(maya.id);
  assert.deepEqual([row.kind, row.source, row.customer_login_id], ['delete', 'account', maya.loginId]);
  assert.deepEqual((await portal('/me', { cookie: maya.cookie })).body.deletion, { askedOn, finishBy });
  // Asking again answers with the same request.
  assert.deepEqual((await ask(maya)).body.deletion, { askedOn, finishBy });
  assert.equal((await openFor(maya.id)).length, 1);
});

test('two asks at the same moment make one request', async () => {
  const sam = await customer('Sam Reed');
  const both = await Promise.all([ask(sam), ask(sam)]);
  assert.deepEqual(both.map((r) => r.status), [200, 200]);
  assert.equal((await openFor(sam.id)).length, 1);
});

test('a bike still in the workshop doesn’t stop her asking', async () => {
  const ola = await customer('Oliver Chen');
  await jobFor(ola.id, 'in_shop');
  assert.equal((await ask(ola)).status, 200);
  assert.equal((await openFor(ola.id)).length, 1);
});

test('Cancel my request: cancelled, and asking again is a new request', async () => {
  const kai = await customer('Jamie Brooks');
  await ask(kai);
  const cancelled = await portal('/me/delete-request/cancel', { cookie: kai.cookie, method: 'POST' });
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
  assert.equal(cancelled.body.deletion, null);
  assert.equal((await openFor(kai.id)).length, 0);
  assert.equal((await portal('/me', { cookie: kai.cookie })).body.deletion, null);
  // Nothing open to cancel.
  assert.equal((await portal('/me/delete-request/cancel', { cookie: kai.cookie, method: 'POST' })).status, 404);
  assert.equal((await ask(kai)).status, 200);
  assert.equal((await openFor(kai.id)).length, 1);
});

test('signed out, signed in to another shop, or from another website: refused, nothing recorded', async () => {
  const aisha = await customer('Aisha Khan');
  const oluCookie = await signIn(`olu-${randomUUID().slice(0, 8)}@example.test`, other);
  assert.equal((await portal('/me/delete-request', { method: 'POST' })).status, 401);
  assert.equal((await portal('/me/delete-request', { cookie: oluCookie, method: 'POST' })).status, 401);
  for (const site of ['cross-site', 'same-site']) {
    assert.equal((await portal('/me/delete-request', { cookie: aisha.cookie, method: 'POST', headers: { 'sec-fetch-site': site } })).status, 403);
    assert.equal((await portal('/me/delete-request/cancel', { cookie: aisha.cookie, method: 'POST', headers: { 'sec-fetch-site': site } })).status, 403);
  }
  assert.equal((await openFor(aisha.id)).length, 0);
});

test('the account knows the shop’s phone, for “Call [shop phone] if you need to talk it through”', async () => {
  const zoe = await customer('[Zoe’s name]');
  await inShop(() => prepare("UPDATE shops SET phone = '[shop phone]' WHERE id = ?").run(owner.shop.id));
  assert.equal((await portal('/me', { cookie: zoe.cookie })).body.shopPhone, '[shop phone]');
  await inShop(() => prepare('UPDATE shops SET phone = NULL WHERE id = ?').run(owner.shop.id));
  assert.equal((await portal('/me', { cookie: zoe.cookie })).body.shopPhone, null);
});

// A booking already under way when her details are deleted (review of #590):
// it must not add a bike or a job to the blanked record, or write her email
// and answers back onto it.
async function blockedBy(conn) {
  const { rows: [{ pid }] } = await conn.query('SELECT pg_backend_pid() AS pid');
  for (let i = 0; i < 250; i += 1) {
    const { rows: [{ n }] } = await conn.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))', [pid]);
    if (n > 0) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('nothing came to wait on this connection’s lock');
}

test('a booking under way while her details are deleted is refused, and writes nothing to the blank record', async () => {
  const mechanic = await seedMechanic(owner.shop.id, { name: 'Sam' });
  const serviceId = await inShop(async () => (await prepare(
    "INSERT INTO workshop_services (name, price, price_pence, minutes, bookable_online, active, updated_at) VALUES ('[Service]', 50, 5000, 60, 1, 1, now())"
  ).run()).lastInsertRowid);
  const lia = await customer('[Lia’s name]');
  await ask(lia);
  const [req] = await openFor(lia.id);
  const jobDate = futureDate(2);
  // Another connection holds the booking's own day, so the booking is under
  // way, past its sign-in check, and waits there while the shop deletes her
  // details through the real route; then it goes on.
  const conn = await pool.connect();
  let res;
  try {
    await conn.query('BEGIN');
    await conn.query("SELECT set_config('app.current_shop_id', $1, true)", [String(owner.shop.id)]);
    await conn.query("SELECT pg_advisory_xact_lock(current_setting('app.current_shop_id')::int, $1::int)", [bookingLockKey(jobDate)]);
    const booking = fetch(`${server.baseUrl}/api/portal/${owner.shop.slug}/bookings`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: lia.cookie },
      body: JSON.stringify({ mechanicId: mechanic, jobDate, startTime: '10:00', description: '[What’s wrong]', newBike: { make: '[Make]', model: '[Model]' }, serviceIds: [serviceId], ...BOOKING_CONTACT, email: lia.email, serviceReminders: true }),
    });
    await blockedBy(conn);
    const deleted = await staff(`/api/privacy-requests/${req.id}/delete`, { method: 'POST', body: {} });
    assert.equal(deleted.status, 200, JSON.stringify(deleted.body));
    await conn.query('COMMIT');
    res = await booking;
  } finally {
    await conn.query('ROLLBACK').catch(() => {});
    conn.release();
  }
  assert.ok([401, 409].includes(res.status), `refused: ${res.status} ${await res.text()}`);
  const left = await inShop(async () => ({
    jobs: await prepare('SELECT id FROM workshop_jobs WHERE customer_id = ?').all(lia.id),
    bikes: await prepare('SELECT id FROM customer_bikes WHERE customer_id = ?').all(lia.id),
    me: await prepare('SELECT email, service_reminders FROM customers WHERE id = ?').get(lia.id),
  }));
  assert.deepEqual(left, { jobs: [], bikes: [], me: { email: '', service_reminders: false } });
});
