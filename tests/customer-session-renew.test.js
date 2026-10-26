// A customer stays signed in for 30 days from their last visit (Jack, 26 Oct,
// docs/decisions/2026-10-26-day-answers.md 2.2; openspec/changes/ask-the-shop-server
// design 6): a session used with less than 29 days left is renewed to 30, and
// its cookie set again; one with more isn't written; an expired one ends.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { CUSTOMER_SESSION_COOKIE } from '../server/customer-auth.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup } from './helpers/staff.js';
import { portalSignup } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';

const DAY = 86_400_000;
let server;
let owner;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

async function signedIn() {
  const { cookie } = await portalSignup(server.baseUrl, owner.shop.slug, { name: 'Maya Patel' });
  return { cookie, token: cookie.split('=')[1] };
}
const expiresAt = async (token) => (await pool.query('SELECT expires_at FROM customer_sessions WHERE token = $1', [token])).rows[0]?.expires_at ?? null;
const setLeft = (token, ms) => pool.query('UPDATE customer_sessions SET expires_at = $2 WHERE token = $1', [token, new Date(Date.now() + ms).toISOString()]);
const me = (cookie) => fetch(`${server.baseUrl}/api/portal/${owner.shop.slug}/me`, { headers: { cookie } });

test('a visit with less than 29 days left renews the sign-in to 30 days from now, cookie and all', async () => {
  const { cookie, token } = await signedIn();
  await setLeft(token, 20 * DAY); // signed in ten days ago
  const res = await me(cookie);
  assert.equal(res.status, 200);
  const left = (await expiresAt(token)).getTime() - Date.now();
  assert.ok(left > 29.9 * DAY && left <= 30 * DAY, `${left / DAY} days left`);
  const set = (res.headers.getSetCookie?.() ?? []).find((c) => c.startsWith(`${CUSTOMER_SESSION_COOKIE}=`));
  assert.ok(set, 'the cookie is set again');
  assert.match(set, new RegExp(`^${CUSTOMER_SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`));
});

test('a visit with more than 29 days left writes nothing', async () => {
  const { cookie, token } = await signedIn();
  const before = await expiresAt(token);
  const res = await me(cookie);
  assert.equal(res.status, 200);
  assert.equal((await expiresAt(token)).getTime(), before.getTime());
  assert.equal((res.headers.getSetCookie?.() ?? []).length, 0);
});

test('a sign-in not used for 30 days has ended, and is removed', async () => {
  const { cookie, token } = await signedIn();
  await setLeft(token, -1000);
  assert.equal((await me(cookie)).status, 401);
  assert.equal(await expiresAt(token), null);
});
