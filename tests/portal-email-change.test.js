// Changing the account's email, confirmed by a code sent to the new address
// (openspec/changes/finish-account design 6; Jack, 9 Nov, answer 3). Nothing
// changes until the right code is entered; then the login's and the
// customer's email change, the old address is told, and devices already
// signed in stay signed in. Refused before any code is sent: the same
// address, a badly formed one, one that's another account's here.
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
const shopName = () => owner.shop.name;

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
let network = 0;
async function portal(path, { cookie, method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${server.baseUrl}/api/portal/${owner.shop.slug}${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `198.51.100.${(++network % 250) + 1}`, ...(cookie ? { cookie } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null), cookie: res.headers.get('set-cookie')?.split(';')[0] };
}
const inShop = (fn) => runWithShop(owner.shop.id, fn);
const codeFor = (email) => inShop(async () => (await prepare('SELECT code FROM pretend_signin_codes WHERE email = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1').get(email))?.code);
async function signIn(email) {
  await portal('/sign-in/code', { method: 'POST', body: { email } });
  const res = await portal('/sign-in/check', { method: 'POST', body: { email, code: await codeFor(email) } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.cookie;
}
const unique = (who) => `${who}-${randomUUID().slice(0, 8)}@example.test`;
// Maya, a customer whose own email signs her in.
async function maya() {
  const email = unique('maya');
  const customer = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', email, phone: '07700 900142' } })).body;
  await inShop(() => prepare('UPDATE customers SET email_from_customer = true WHERE id = ?').run(customer.id));
  return { customer, email, cookie: await signIn(email) };
}
const ask = (cookie, email, headers) => portal('/me/email', { method: 'POST', body: { email }, cookie, headers });
const confirm = (cookie, code) => portal('/me/email/confirm', { method: 'POST', body: { code }, cookie });

before(async () => {
  server = await startLiveServer({ env: { TRUST_PROXY: '1', CUSTOMER_SIGNIN_PROVIDER: 'pretend' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  await inShop(() => prepare("UPDATE shops SET phone = '01204 555 010' WHERE id = ?").run(owner.shop.id));
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

test('a new email gets a code and waits; until it is confirmed the old one still signs in', async () => {
  const m = await maya();
  const next = unique('m.patel');
  const res = await ask(m.cookie, next.toUpperCase());
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body, { pendingEmail: next });
  assert.ok(await codeFor(next), 'a code went to the new address');
  const login = await inShop(() => prepare('SELECT email, pending_email, pending_email_at FROM customer_logins WHERE customer_id = ?').get(m.customer.id));
  assert.equal(login.email, m.email);
  assert.equal(login.pending_email, next);
  assert.ok(login.pending_email_at);
  assert.equal((await portal('/me', { cookie: m.cookie })).body.email, m.email);
  assert.ok(await signIn(m.email), 'the old email still signs in');
});

test('the right code changes the login’s and her own email, says so, and tells the old address', async () => {
  const m = await maya();
  const next = unique('m.patel');
  await ask(m.cookie, next);
  const res = await confirm(m.cookie, await codeFor(next));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body, { email: next, said: `Your email is now ${next}. Use it to sign in from now on.` });
  const after = await inShop(() => prepare(
    'SELECT l.email AS login, l.pending_email, c.email, c.email_from_customer FROM customer_logins l JOIN customers c ON c.id = l.customer_id WHERE c.id = ?'
  ).get(m.customer.id));
  assert.deepEqual(after, { login: next, pending_email: null, email: next, email_from_customer: true });
  // Devices already signed in stay signed in.
  assert.equal((await portal('/me', { cookie: m.cookie })).body.email, next);
  const told = await inShop(() => prepare("SELECT to_address, subject, body FROM customer_messages WHERE customer_id = ? AND template_key = 'account_email_changed'").all(m.customer.id));
  assert.equal(told.length, 1);
  assert.equal(told[0].to_address, m.email);
  assert.equal(told[0].subject, `Your email address has changed — ${shopName()}`);
  assert.equal(told[0].body, `The email on your ${shopName()} account is now m•••@example.test. You’ll sign in with it from now on. If you didn’t make this change, call 01204 555 010.`);
  // The new email signs in to her account; the old one no longer does.
  const fresh = await signIn(next);
  assert.equal((await portal('/me', { cookie: fresh })).body.id, (await portal('/me', { cookie: m.cookie })).body.id);
  const old = await signIn(m.email);
  assert.notEqual((await portal('/me', { cookie: old })).body.id, (await portal('/me', { cookie: m.cookie })).body.id, 'the old email is no longer hers');
});

test('a wrong, expired or used-up code is refused with the sign-in’s words and changes nothing', async () => {
  const m = await maya();
  const next = unique('m.patel');
  await ask(m.cookie, next);
  const right = await codeFor(next);
  const wrong = right === '000000' ? '111111' : '000000';
  const res = await confirm(m.cookie, wrong);
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'That code isn’t right. Check it, or send a new one');
  await inShop(() => prepare("UPDATE customer_logins SET pending_email_at = now() - interval '11 minutes' WHERE customer_id = ?").run(m.customer.id));
  const late = await confirm(m.cookie, right);
  assert.equal(late.status, 400);
  assert.equal(late.body.error, 'That code has expired — send a new one');
  assert.equal((await portal('/me', { cookie: m.cookie })).body.email, m.email);
  // Used up: five wrong tries.
  await ask(m.cookie, next);
  for (let i = 0; i < 5; i += 1) await confirm(m.cookie, wrong);
  assert.equal((await confirm(m.cookie, await codeFor(next) ?? right)).body.error, 'That code has expired — send a new one');
  assert.equal((await portal('/me', { cookie: m.cookie })).body.email, m.email);
});

test('refused before a code is sent: her own address, a badly formed one, and one another account here uses', async () => {
  const m = await maya();
  const other = await maya();
  const staffTyped = unique('typed');
  await staff('/api/customers', { method: 'POST', body: { name: 'Sam Lee', email: staffTyped } });
  const before = await inShop(async () => (await prepare('SELECT count(*)::int AS n FROM pretend_signin_codes').get()).n);
  assert.equal((await ask(m.cookie, m.email)).body.error, 'That’s already your email');
  assert.equal((await ask(m.cookie, 'not an email')).body.error, 'That doesn’t look like an email address — check it');
  const taken = `That email is already used for another account at ${shopName()}. Ask ${shopName()} to help.`;
  assert.equal((await ask(m.cookie, other.email)).body.error, taken, 'another login');
  await inShop(() => prepare('UPDATE customers SET email_from_customer = true WHERE lower(email) = ?').run(staffTyped));
  assert.equal((await ask(m.cookie, staffTyped)).body.error, taken, 'another customer’s own email');
  assert.equal(await inShop(async () => (await prepare('SELECT count(*)::int AS n FROM pretend_signin_codes').get()).n), before, 'no code sent');
});

test('the sign-in’s limit on codes asked for applies', async () => {
  const m = await maya();
  const next = unique('m.patel');
  const answers = [];
  for (let i = 0; i < 6; i += 1) answers.push((await ask(m.cookie, next)).status);
  assert.deepEqual(answers, [200, 200, 200, 200, 200, 429]);
});

test('“already used” counts towards the limit, so addresses can’t be tried one after another', async () => {
  const m = await maya();
  const other = await maya();
  const answers = [];
  for (let i = 0; i < 6; i += 1) answers.push((await ask(m.cookie, other.email)).status);
  // Five codes an address in 15 minutes; the other account's own sign-in used one.
  assert.deepEqual(answers, [400, 400, 400, 400, 429, 429]);
});

test('another website’s request, or no sign-in, is refused', async () => {
  const m = await maya();
  assert.equal((await ask(m.cookie, unique('x'), { 'sec-fetch-site': 'cross-site' })).status, 403);
  assert.equal((await ask(null, unique('x'))).status, 401);
  assert.equal((await portal('/me/email/confirm', { method: 'POST', body: { code: '123456' }, cookie: m.cookie, headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
});
