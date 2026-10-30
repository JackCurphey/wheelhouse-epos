// Asking to delete your account (openspec/changes/delete-account, design 3;
// ac-delete, ac-account-delete-pending, ac-account-delete-cancelled; account
// and reminders decision 4 and audit H3; coverage walks answer 4): the
// customer asks from their account, once, and can cancel.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
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
