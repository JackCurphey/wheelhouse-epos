// The shop's own privacy notice (openspec/changes/finish-account design 7;
// Jack, 9 Nov, answer 2): the Owner types it in Settings › Shop details; the
// account shows it, on its own page, only once it's added. No Wheelhouse
// wording is offered: a new shop has none.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let a;
let b;
let jo;
before(async () => {
  server = await startLiveServer();
  a = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  b = await staffSignup(server.baseUrl, { shopName: 'Other Cycles' });
  const made = await staffRequest(server.baseUrl, a.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${Date.now()}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
});
after(async () => {
  if (a) await deleteTestShop(a.shop.id);
  if (b) await deleteTestShop(b.shop.id);
  if (server) await server.stop();
  await pool.end();
});
const as = (who) => (path, options) => staffRequest(server.baseUrl, who.cookie, path, options);
const put = (who, text) => as(who)('/api/privacy-notice', { method: 'PUT', body: { text } });
async function shown(shop) {
  const res = await fetch(`${server.baseUrl}/api/portal/${shop.shop.slug}/privacy`);
  return { status: res.status, body: await res.json().catch(() => null) };
}
const WORDS = '[Your privacy notice, first paragraph]\n\n[Second paragraph]\n  [an indented line]';

test('a new shop has no privacy notice, and the account has none to show', async () => {
  const res = await as(a)('/api/privacy-notice');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body, { text: null });
  assert.equal((await shown(a)).status, 404);
});

test('the Owner adds, changes and removes it; the account shows it as typed, line breaks kept', async () => {
  const added = await put(a, `  ${WORDS}\n`);
  assert.equal(added.status, 200, JSON.stringify(added.body));
  assert.deepEqual(added.body, { text: WORDS });
  assert.deepEqual((await as(a)('/api/privacy-notice')).body, { text: WORDS });
  const page = await shown(a);
  assert.equal(page.status, 200, JSON.stringify(page.body));
  assert.equal(page.body.text, WORDS);
  assert.match(page.body.shopName, /^North Street Cycles/);
  assert.deepEqual((await put(a, '[Changed notice]')).body, { text: '[Changed notice]' });
  assert.equal((await shown(a)).body.text, '[Changed notice]');
  assert.deepEqual((await put(a, null)).body, { text: null });
  assert.equal((await shown(a)).status, 404);
  await put(a, '[Again]');
  assert.deepEqual((await put(a, '   ')).body, { text: null }, 'blank removes it too');
});

test('up to 20,000 characters, and only text', async () => {
  const long = await put(a, 'x'.repeat(20001));
  assert.equal(long.status, 400);
  assert.equal(long.body.error, 'The privacy notice can be up to 20,000 characters');
  assert.equal((await put(a, 42)).status, 400);
  assert.equal((await put(a, 'x'.repeat(20000))).status, 200);
  await put(a, null);
});

test('only the Owner changes it; anyone signed in at the shop can read it', async () => {
  await put(a, '[Owner’s notice]');
  const refused = await put(jo, '[Jo’s notice]');
  assert.equal(refused.status, 403, JSON.stringify(refused.body));
  assert.equal(refused.body.code, 'owner_only');
  assert.deepEqual((await as(jo)('/api/privacy-notice')).body, { text: '[Owner’s notice]' });
  await put(a, null);
});

test('each shop has its own', async () => {
  await put(a, '[North Street’s notice]');
  assert.equal((await shown(b)).status, 404);
  assert.deepEqual((await as(b)('/api/privacy-notice')).body, { text: null });
  await put(a, null);
});
