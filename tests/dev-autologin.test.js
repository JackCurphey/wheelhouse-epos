// Local development without signing in: with WHEELHOUSE_DEV_AUTOLOGIN=1 a
// request with no session, addressed to localhost, is the dev login (the
// WHEELHOUSE_DEV_LOGIN_EMAIL owner, else the oldest active owner). It is off
// unless asked for, never in production or on the hosted copy (the server
// refuses to start with both), never for a request addressed to anything but
// localhost, and a real session cookie still wins.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { devAutologinOn, devAutologinRefusal, isLocalHost } from '../server/lib/dev-autologin.js';

const shops = [];
const servers = [];
after(async () => {
  for (const s of servers) await s.stop();
  for (const s of shops) await deleteTestShop(s.id);
  await pool.end();
});
async function owner() {
  const o = await staffSignup('http://unused');
  shops.push(o.shop);
  return o;
}
async function server(env) {
  const s = await startLiveServer({ env });
  servers.push(s);
  return s;
}
const get = (baseUrl, path, headers = {}) => new Promise((resolve, reject) => {
  const url = new URL(path, baseUrl);
  const req = http.request(url, { headers }, (res) => {
    let text = '';
    res.on('data', (d) => { text += d; });
    res.on('end', () => resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }));
  });
  req.on('error', reject);
  req.end();
});

test('it is on only when asked for, outside production and the hosted copy', () => {
  assert.equal(devAutologinOn({}), false);
  assert.equal(devAutologinOn({ WHEELHOUSE_DEV_AUTOLOGIN: '0' }), false);
  assert.equal(devAutologinOn({ WHEELHOUSE_DEV_AUTOLOGIN: '1' }), true);
  assert.equal(devAutologinOn({ WHEELHOUSE_DEV_AUTOLOGIN: '1', NODE_ENV: 'development' }), true);
  assert.equal(devAutologinOn({ WHEELHOUSE_DEV_AUTOLOGIN: '1', NODE_ENV: 'production' }), false);
  assert.equal(devAutologinOn({ WHEELHOUSE_DEV_AUTOLOGIN: '1', WHEELHOUSE_HOSTED_COPY: '1' }), false);
});

test('the server refuses to start with it set in production or on the hosted copy', () => {
  assert.equal(devAutologinRefusal({}), null);
  assert.equal(devAutologinRefusal({ WHEELHOUSE_DEV_AUTOLOGIN: '1' }), null);
  assert.match(devAutologinRefusal({ WHEELHOUSE_DEV_AUTOLOGIN: '1', NODE_ENV: 'production' }), /WHEELHOUSE_DEV_AUTOLOGIN/);
  assert.match(devAutologinRefusal({ WHEELHOUSE_DEV_AUTOLOGIN: '1', WHEELHOUSE_HOSTED_COPY: '1' }), /WHEELHOUSE_DEV_AUTOLOGIN/);
  assert.equal(devAutologinRefusal({ NODE_ENV: 'production' }), null);
});

test('only a request addressed to localhost counts as local', () => {
  const at = (host) => ({ headers: { host } });
  for (const ok of ['localhost:8080', 'localhost', '127.0.0.1:4000', '[::1]:8080']) assert.equal(isLocalHost(at(ok)), true, ok);
  for (const no of ['example.com', 'localhost.evil.com', '127.0.0.1.evil.com:80', '192.168.1.5:8080', 'evil.com:localhost', undefined]) assert.equal(isLocalHost(at(no)), false, String(no));
});

test('with it on, a request with no session is the dev login, and the API works', async () => {
  const o = await owner();
  const s = await server({ WHEELHOUSE_DEV_AUTOLOGIN: '1', WHEELHOUSE_DEV_LOGIN_EMAIL: o.email });
  const me = await get(s.baseUrl, '/api/auth/me');
  assert.equal(me.status, 200, JSON.stringify(me.body));
  assert.equal(me.body.email, o.email);
  assert.equal((await get(s.baseUrl, '/api/dashboard')).status, 200);
});

test('a real session still wins over the dev login', async () => {
  const dev = await owner();
  const other = await owner();
  const s = await server({ WHEELHOUSE_DEV_AUTOLOGIN: '1', WHEELHOUSE_DEV_LOGIN_EMAIL: dev.email });
  const me = await staffRequest(s.baseUrl, other.cookie, '/api/auth/me');
  assert.equal(me.body.email, other.email);
});

test('addressed to anything but localhost, there is no dev login', async () => {
  const o = await owner();
  const s = await server({ WHEELHOUSE_DEV_AUTOLOGIN: '1', WHEELHOUSE_DEV_LOGIN_EMAIL: o.email });
  assert.equal((await get(s.baseUrl, '/api/auth/me', { host: 'wheelhouse.example.com' })).status, 401);
});

test('with it off, a request with no session is not signed in', async () => {
  const o = await owner();
  const s = await server({ WHEELHOUSE_DEV_LOGIN_EMAIL: o.email });
  assert.equal((await get(s.baseUrl, '/api/auth/me')).status, 401);
});

test('no matching login means not signed in, rather than someone else', async () => {
  const s = await server({ WHEELHOUSE_DEV_AUTOLOGIN: '1', WHEELHOUSE_DEV_LOGIN_EMAIL: 'nobody@example.com' });
  assert.equal((await get(s.baseUrl, '/api/auth/me')).status, 401);
});

test('a server in production with it set does not start, and says why', async () => {
  const child = spawn(process.execPath, ['server/server.js'], {
    cwd: new URL('..', import.meta.url).pathname,
    env: { ...process.env, PORT: '0', NODE_ENV: 'production', WHEELHOUSE_DEV_AUTOLOGIN: '1', SHOPIFY_TOKEN_ENCRYPTION_KEY: 'a'.repeat(64) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let text = '';
  child.stdout.on('data', (d) => { text += d; });
  child.stderr.on('data', (d) => { text += d; });
  const code = await new Promise((resolve) => child.on('exit', resolve));
  assert.equal(code, 1, text);
  assert.match(text, /WHEELHOUSE_DEV_AUTOLOGIN/);
});

test('a test run never inherits the sign-in skip from a developer\'s .env', () => {
  // node:test marks its child processes; load-env.js drops the switch there.
  assert.ok(process.env.NODE_TEST_CONTEXT, 'run this file with node --test');
  assert.notEqual(process.env.WHEELHOUSE_DEV_AUTOLOGIN, '1');
});
