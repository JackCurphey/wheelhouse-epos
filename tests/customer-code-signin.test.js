// Customers sign in with a code sent by email (openspec/changes/customer-code-signin;
// signing-in decision 5; cust-signin, cust-code, cust-code-expired): the
// server, against the pretend provider, which keeps its codes where the test
// can read them, as WorkOS would on its side.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare, pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let off;
let shop;
let other;

before(async () => {
  // TRUST_PROXY so each test can be its own network, and the limits of one
  // don't spill into the next.
  [server, off] = await Promise.all([
    startLiveServer({ env: { TRUST_PROXY: '1', CUSTOMER_SIGNIN_PROVIDER: 'pretend' } }),
    startLiveServer({ env: { CUSTOMER_SIGNIN_PROVIDER: '' } }),
  ]);
  shop = (await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' })).shop;
  other = (await staffSignup(server.baseUrl, { shopName: 'Elsewhere Cycles' })).shop;
});

after(async () => {
  if (shop) await deleteTestShop(shop.id);
  if (other) await deleteTestShop(other.id);
  await Promise.all([server?.stop(), off?.stop()]);
});

let network = 0;
const newNetwork = () => `203.0.113.${++network}`;
async function post(path, body, { ip = newNetwork(), base = server.baseUrl } = {}) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, cookie: res.headers.get('set-cookie') };
}
const ask = (email, opts, at = shop) => post(`/api/portal/${at.slug}/sign-in/code`, { email }, opts);
const check = (email, code, opts, at = shop) => post(`/api/portal/${at.slug}/sign-in/check`, { email, code }, opts);
const codeFor = (email, at = shop) => runWithShop(at.id, async () =>
  (await prepare('SELECT code FROM pretend_signin_codes WHERE email = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1').get(email))?.code);
const loginFor = async (email, at = shop) =>
  (await pool.query('SELECT * FROM customer_logins WHERE shop_id = $1 AND email = $2', [at.id, email])).rows;

test('Maya asks for a code and signs in with it: a new customer and a login with no password', async () => {
  const ip = newNetwork();
  const sent = await ask('Maya@Example.test ', { ip });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  assert.deepEqual(sent.body, { ok: true });
  const code = await codeFor('maya@example.test');
  assert.match(code, /^\d{6}$/);
  const signedIn = await check('maya@example.test', code, { ip });
  assert.equal(signedIn.status, 200, JSON.stringify(signedIn.body));
  assert.match(signedIn.cookie, /^wh_customer_session=[0-9a-f]{64}; HttpOnly; Path=\/; SameSite=Lax/);
  assert.equal(signedIn.body.email, 'maya@example.test');
  assert.equal(signedIn.body.shopSlug, shop.slug);
  const [login] = await loginFor('maya@example.test');
  assert.equal(login.password_hash, null);
  const customer = await runWithShop(shop.id, () => prepare('SELECT name, email FROM customers WHERE id = ?').get(login.customer_id));
  assert.deepEqual(customer, { name: '', email: 'maya@example.test' });
  // The session is the portal's own: /me knows her.
  const me = await fetch(`${server.baseUrl}/api/portal/${shop.slug}/me`, { headers: { cookie: signedIn.cookie.split(';')[0] } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).email, 'maya@example.test');
});

test('signing in again reuses the login, and never joins a customer the shop already has', async () => {
  const existing = await runWithShop(shop.id, () => prepare("INSERT INTO customers (name, email) VALUES ('Sam Reed', 'sam@example.test') RETURNING id").get());
  const ip = newNetwork();
  await ask('sam@example.test', { ip });
  const first = await check('sam@example.test', await codeFor('sam@example.test'), { ip });
  assert.equal(first.status, 200);
  const [login] = await loginFor('sam@example.test');
  assert.notEqual(login.customer_id, existing.id, 'an email typed isn’t proof of owning it');
  await ask('sam@example.test', { ip });
  assert.equal((await check('sam@example.test', await codeFor('sam@example.test'), { ip })).status, 200);
  assert.equal((await loginFor('sam@example.test')).length, 1);
});

test('a code works once; a wrong one says so; a new code replaces the old', async () => {
  const ip = newNetwork();
  await ask('lena@example.test', { ip });
  const code = await codeFor('lena@example.test');
  const wrong = await check('lena@example.test', code === '000000' ? '111111' : '000000', { ip });
  assert.equal(wrong.status, 401);
  assert.deepEqual(wrong.body, { error: 'That code isn’t right. Check it, or send a new one', reason: 'wrong' });
  assert.equal(wrong.cookie, null);
  assert.equal((await check('lena@example.test', code, { ip })).status, 200);
  assert.equal((await check('lena@example.test', code, { ip })).body.reason, 'expired', 'used once');
  await ask('lena@example.test', { ip });
  const first = await codeFor('lena@example.test');
  await ask('lena@example.test', { ip });
  const second = await codeFor('lena@example.test');
  if (first !== second) assert.equal((await check('lena@example.test', first, { ip })).status, 401, 'the earlier code is replaced');
  assert.equal((await check('lena@example.test', second, { ip })).status, 200);
});

test('a code more than 10 minutes old has expired, as drawn', async () => {
  const ip = newNetwork();
  await ask('kit@example.test', { ip });
  const code = await codeFor('kit@example.test');
  const expires = await runWithShop(shop.id, () => prepare("SELECT expires_at > now() + interval '9 minutes' AND expires_at <= now() + interval '10 minutes' AS ten FROM pretend_signin_codes WHERE email = ?").get('kit@example.test'));
  assert.equal(expires.ten, true, 'valid for 10 minutes');
  await runWithShop(shop.id, () => prepare("UPDATE pretend_signin_codes SET expires_at = now() - interval '1 second' WHERE email = ?").run('kit@example.test'));
  const late = await check('kit@example.test', code, { ip });
  assert.equal(late.status, 401);
  assert.deepEqual(late.body, { error: 'That code has expired — send a new one', reason: 'expired' });
});

test('the fifth wrong try uses the code up', async () => {
  const ip = newNetwork();
  await ask('ash@example.test', { ip });
  const code = await codeFor('ash@example.test');
  const wrong = code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) assert.equal((await check('ash@example.test', wrong, { ip })).body.reason, 'wrong');
  assert.equal((await check('ash@example.test', code, { ip })).body.reason, 'expired');
});

test('another shop’s code never signs in here', async () => {
  const ip = newNetwork();
  await ask('jo@example.test', { ip }, other);
  const code = await codeFor('jo@example.test', other);
  assert.equal((await check('jo@example.test', code, { ip })).status, 401);
  assert.equal((await loginFor('jo@example.test')).length, 0);
});

test('two checks of one code at once sign in once and make one login', async () => {
  const ip = newNetwork();
  await ask('two@example.test', { ip });
  const code = await codeFor('two@example.test');
  const answers = await Promise.all([check('two@example.test', code, { ip }), check('two@example.test', code, { ip })]);
  assert.deepEqual(answers.map((a) => a.status).sort(), [200, 401]);
  assert.equal((await loginFor('two@example.test')).length, 1);
});

test('a switched-off login is refused', async () => {
  const ip = newNetwork();
  await ask('off@example.test', { ip });
  await check('off@example.test', await codeFor('off@example.test'), { ip });
  await pool.query('UPDATE customer_logins SET active = 0 WHERE shop_id = $1 AND email = $2', [shop.id, 'off@example.test']);
  await ask('off@example.test', { ip });
  const refused = await check('off@example.test', await codeFor('off@example.test'), { ip });
  assert.equal(refused.status, 403);
  assert.deepEqual(refused.body, { error: 'This account can’t sign in. Ask the shop' });
  assert.equal(refused.cookie, null);
});

test('asking answers the same for any email; a bad email or a missing shop is refused', async () => {
  const ip = newNetwork();
  assert.deepEqual((await ask('maya@example.test', { ip })).body, { ok: true });
  assert.deepEqual((await ask('nobody-yet@example.test', { ip })).body, { ok: true });
  const bad = await ask('not an email', { ip });
  assert.equal(bad.status, 400);
  assert.equal((await post('/api/portal/no-such-shop/sign-in/code', { email: 'maya@example.test' })).status, 404);
});

test('a login with no password can’t be signed into with a password', async () => {
  const ip = newNetwork();
  await ask('nopass@example.test', { ip });
  await check('nopass@example.test', await codeFor('nopass@example.test'), { ip });
  for (const password of ['', 'null', 'undefined']) {
    const res = await post(`/api/portal/${shop.slug}/login`, { email: 'nopass@example.test', password }, { ip });
    assert.equal(res.status, 401, password);
  }
});

test('asking is limited: 5 per email and 10 per network in 15 minutes; checking 30 per network', async () => {
  const ip = newNetwork();
  for (let i = 0; i < 5; i++) assert.equal((await ask('busy@example.test', { ip: newNetwork() })).status, 200);
  const perEmail = await ask('busy@example.test', { ip: newNetwork() });
  assert.equal(perEmail.status, 429);
  assert.equal(perEmail.body.error, 'Too many codes asked for. Wait a few minutes, then try again');
  for (let i = 0; i < 10; i++) assert.equal((await ask(`n${i}@example.test`, { ip })).status, 200);
  assert.equal((await ask('n10@example.test', { ip })).status, 429);
  const checker = newNetwork();
  for (let i = 0; i < 30; i++) assert.notEqual((await check('busy@example.test', '000000', { ip: checker })).status, 429);
  const tooMany = await check('busy@example.test', '000000', { ip: checker });
  assert.equal(tooMany.status, 429);
  assert.equal(tooMany.body.error, 'Too many tries. Wait a few minutes, then try again');
});

test('with no provider connected, asking says signing in by email isn’t switched on', async () => {
  const offShop = (await staffSignup(off.baseUrl, { shopName: 'Off Cycles' })).shop;
  try {
    const res = await ask('maya@example.test', { base: off.baseUrl }, offShop);
    assert.equal(res.status, 503);
    assert.deepEqual(res.body, { error: 'Signing in by email isn’t switched on yet' });
    assert.equal((await check('maya@example.test', '123456', { base: off.baseUrl }, offShop)).status, 503);
  } finally {
    await deleteTestShop(offShop.id);
  }
});

// Review: two asks at once leave one live code; a null body or a huge email is refused, not a crash.
test('two codes asked for at once leave one that works', async () => {
  const ip = newNetwork();
  await Promise.all([ask('double@example.test', { ip }), ask('double@example.test', { ip })]);
  const live = await runWithShop(shop.id, () => prepare('SELECT count(*)::int AS n FROM pretend_signin_codes WHERE email = ? AND used_at IS NULL').get('double@example.test'));
  assert.equal(live.n, 1);
});

test('a body of null, or an email longer than any real one, is refused as a bad request', async () => {
  for (const path of ['code', 'check']) {
    const res = await fetch(`${server.baseUrl}/api/portal/${shop.slug}/sign-in/${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': newNetwork() }, body: 'null',
    });
    assert.ok(res.status === 400 || res.status === 401, `${path}: ${res.status}`);
  }
  assert.equal((await ask(`${'a'.repeat(250)}@example.test`)).status, 400);
});
