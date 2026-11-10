// Edit your details, name and mobile (openspec/changes/finish-account design 6;
// ac-account; Jack, 9 Nov, answer 3): each saved at once for the signed-in
// customer's own record. A bad mobile, a cleared one while job updates go by
// text, and another website's request are refused. The email changes by code
// (portal-email-change.test.js).
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
let maya;
let mayaCookie;

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
async function portal(path, { cookie = mayaCookie, method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${server.baseUrl}/api/portal/${owner.shop.slug}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const edit = (body, options = {}) => portal('/me', { method: 'PUT', body, ...options });
const record = () => runWithShop(owner.shop.id, () => prepare('SELECT name, phone, email, update_channel FROM customers WHERE id = ?').get(maya.id));

let network = 0;
async function signIn(email) {
  const ip = `203.0.113.${++network}`;
  const post = (path, body) => fetch(`${server.baseUrl}/api/portal/${owner.shop.slug}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body),
  });
  await post('/sign-in/code', { email });
  const { code } = await runWithShop(owner.shop.id, () => prepare('SELECT code FROM pretend_signin_codes WHERE email = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1').get(email));
  const res = await post('/sign-in/check', { email, code });
  assert.equal(res.status, 200, await res.text());
  return res.headers.get('set-cookie').split(';')[0];
}

before(async () => {
  server = await startLiveServer({ env: { TRUST_PROXY: '1', CUSTOMER_SIGNIN_PROVIDER: 'pretend' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const email = `maya-${randomUUID().slice(0, 8)}@example.test`;
  maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', email, phone: '07700 900142' } })).body;
  await runWithShop(owner.shop.id, () => prepare("UPDATE customers SET email_from_customer = true, update_channel = 'sms' WHERE id = ?").run(maya.id));
  mayaCookie = await signIn(email);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

test('a changed name and mobile save at once and show on her account', async () => {
  const res = await edit({ name: '  Maya   Patel-Shah ', phone: '07700 900199' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body, { name: 'Maya Patel-Shah', phone: '07700 900199' });
  const me = await portal('/me');
  assert.deepEqual([me.body.name, me.body.phone], ['Maya Patel-Shah', '07700 900199']);
  assert.deepEqual(await record(), { name: 'Maya Patel-Shah', phone: '07700 900199', email: me.body.email, update_channel: 'sms' });
});

test('a bad mobile, or a blank name, is refused and nothing changes', async () => {
  const before = await record();
  for (const phone of ['0770', 'call me', '07700 900199 ext 4 5 6 7 8 9 0', 12345678901]) {
    const res = await edit({ phone });
    assert.equal(res.status, 400, String(phone));
    assert.equal(res.body.error, 'That doesn’t look like a mobile number — check it');
  }
  assert.equal((await edit({ name: '   ' })).body.error, 'Enter your name');
  assert.equal((await edit({})).status, 400);
  assert.deepEqual(await record(), before);
});

test('clearing the mobile is refused while job updates go by text; allowed by email', async () => {
  const res = await edit({ phone: '' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'We don’t have a mobile number for you, so we can’t text you.');
  assert.ok((await record()).phone);
  await runWithShop(owner.shop.id, () => prepare("UPDATE customers SET update_channel = 'email' WHERE id = ?").run(maya.id));
  try {
    const cleared = await edit({ phone: '' });
    assert.equal(cleared.status, 200, JSON.stringify(cleared.body));
    assert.equal(cleared.body.phone, null);
    assert.equal((await record()).phone, null);
  } finally {
    await runWithShop(owner.shop.id, () => prepare("UPDATE customers SET update_channel = 'sms', phone = '07700 900142' WHERE id = ?").run(maya.id));
  }
});

test('another website’s request, or no sign-in, changes nothing', async () => {
  const before = await record();
  const cross = await edit({ name: 'Someone Else' }, { headers: { 'sec-fetch-site': 'cross-site' } });
  assert.equal(cross.status, 403);
  assert.equal((await edit({ name: 'Someone Else' }, { cookie: null })).status, 401);
  assert.deepEqual(await record(), before);
});
