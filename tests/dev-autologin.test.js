// Local development without signing in: with WHEELHOUSE_DEV_AUTOLOGIN=1 a
// request with no session, addressed to localhost, is the dev login (the
// WHEELHOUSE_DEV_LOGIN_EMAIL owner, else the oldest active owner). It is off
// unless asked for, never in production or on the hosted copy (the server
// refuses to start with both), never for a request addressed to anything but
// localhost, and a real session cookie still wins.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir, networkInterfaces } from 'node:os';
import path from 'node:path';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { devAutologinOn, devAutologinRefusal, isLocalHost, remoteIsLocal, sameOriginEnough } from '../server/lib/dev-autologin.js';

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
const send = (baseUrl, path, { method = 'GET', headers = {}, body } = {}) => new Promise((resolve, reject) => {
  const url = new URL(path, baseUrl);
  const req = http.request(url, { method, headers: { ...(body ? { 'content-type': 'text/plain' } : {}), ...headers } }, (res) => {
    let text = '';
    res.on('data', (d) => { text += d; });
    res.on('end', () => resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null, headers: res.headers }));
  });
  req.on('error', reject);
  req.end(body);
});
const get = (baseUrl, path, headers = {}) => send(baseUrl, path, { headers });

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

// A web page the developer visits can make the browser call localhost with no
// cookie; reading the answer is blocked, but a write would land. So anything
// that isn't a plain read must come from the app's own origin (or a tool that
// sends no browser headers).
test('what counts as the app’s own origin for a write', () => {
  const at = (headers) => ({ method: 'POST', headers: { host: 'localhost:8080', ...headers } });
  assert.equal(sameOriginEnough(at({})), true, 'curl and tests send neither header');
  assert.equal(sameOriginEnough(at({ 'sec-fetch-site': 'same-origin' })), true);
  assert.equal(sameOriginEnough(at({ 'sec-fetch-site': 'none' })), true);
  assert.equal(sameOriginEnough(at({ 'sec-fetch-site': 'same-site' })), false, 'another localhost port is same-site');
  assert.equal(sameOriginEnough(at({ 'sec-fetch-site': 'cross-site' })), false);
  assert.equal(sameOriginEnough(at({ origin: 'http://localhost:8080' })), true);
  assert.equal(sameOriginEnough(at({ origin: 'https://evil.example' })), false);
  assert.equal(sameOriginEnough(at({ origin: 'null' })), false);
  assert.equal(sameOriginEnough({ method: 'GET', headers: { host: 'localhost:8080', 'sec-fetch-site': 'cross-site' } }), true, 'reads are not writes');
});

test('a cross-site write is not the dev login, and a same-origin one is', async () => {
  const o = await owner();
  const s = await server({ WHEELHOUSE_DEV_AUTOLOGIN: '1', WHEELHOUSE_DEV_LOGIN_EMAIL: o.email });
  const post = (headers) => send(s.baseUrl, '/api/customers', { method: 'POST', body: JSON.stringify({ name: 'Cross Site' }), headers });
  assert.equal((await post({ origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' })).status, 401);
  assert.equal((await post({ origin: 'https://evil.example' })).status, 401);
  assert.equal((await post({ 'sec-fetch-site': 'same-site' })).status, 401);
  assert.equal((await post({ 'sec-fetch-site': 'same-origin' })).status, 201);
});

test('signing out stays signed out until someone signs in', async () => {
  const o = await owner();
  const s = await server({ WHEELHOUSE_DEV_AUTOLOGIN: '1', WHEELHOUSE_DEV_LOGIN_EMAIL: o.email });
  const out = await send(s.baseUrl, '/api/auth/logout', { method: 'POST' });
  assert.equal(out.status, 200);
  const cookie = [].concat(out.headers['set-cookie']).map((c) => c.split(';')[0]).filter((c) => !c.endsWith('=')).join('; ');
  assert.equal((await get(s.baseUrl, '/api/auth/me', { cookie })).status, 401, 'signed out after logout');
  assert.equal((await get(s.baseUrl, '/api/auth/me')).status, 200, 'a browser without the signed-out mark is still the dev login');
  const real = await staffRequest(s.baseUrl, `${cookie}; ${o.cookie}`, '/api/auth/me');
  assert.equal(real.status, 200, 'a real session still signs in');
});

test('NODE_ENV is compared without regard to case or spaces', () => {
  for (const production of ['Production', 'PRODUCTION', ' production ']) {
    assert.equal(devAutologinOn({ WHEELHOUSE_DEV_AUTOLOGIN: '1', NODE_ENV: production }), false, production);
    assert.match(devAutologinRefusal({ WHEELHOUSE_DEV_AUTOLOGIN: '1', NODE_ENV: production }), /WHEELHOUSE_DEV_AUTOLOGIN/, production);
  }
});

// load-env.js: the switch in .env is dropped for a node:test process, kept when
// it was set before .env was read, and kept outside tests.
test('load-env drops the switch from .env in a test run only', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'envtest-'));
  const file = path.join(dir, '.env');
  writeFileSync(file, 'WHEELHOUSE_DEV_AUTOLOGIN=1\n');
  const run = (extra) => spawnSync(process.execPath, ['--input-type=module', '-e',
    "await import('./server/load-env.js'); console.log(JSON.stringify(process.env.WHEELHOUSE_DEV_AUTOLOGIN ?? null))"], {
    cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8',
    env: { PATH: process.env.PATH, WHEELHOUSE_ENV_FILE: file, ...extra },
  }).stdout.trim();
  assert.equal(run({}), '"1"', 'outside a test run it is kept');
  assert.equal(run({ NODE_TEST_CONTEXT: 'child-v8' }), 'null', 'in a test run it is dropped');
  assert.equal(run({ NODE_TEST_CONTEXT: 'child-v8', WHEELHOUSE_DEV_AUTOLOGIN: '1' }), '"1"', 'set outside .env, it is kept');
});

// A machine on the same network can write "Host: localhost" itself, so the real
// address of the connection has to be this machine too, unless the server sits
// behind the compose gateway (TRUST_PROXY=1), which only listens on 127.0.0.1.
test('which connections count as this machine', () => {
  const from = (remoteAddress) => ({ socket: { remoteAddress } });
  for (const ok of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) assert.equal(remoteIsLocal(from(ok), {}), true, ok);
  for (const no of ['192.168.1.20', '10.0.0.5', '::ffff:192.168.1.20', undefined]) assert.equal(remoteIsLocal(from(no), {}), false, String(no));
  assert.equal(remoteIsLocal(from('172.18.0.3'), { TRUST_PROXY: '1' }), true, 'behind the compose gateway');
  assert.equal(remoteIsLocal(from('172.18.0.3'), { TRUST_PROXY: 'true' }), true);
  assert.equal(remoteIsLocal(from('172.18.0.3'), { TRUST_PROXY: '0' }), false);
});

const lanAddress = Object.values(networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
test('another machine on the network can’t borrow the dev login by writing Host: localhost', { skip: !lanAddress && 'no network address on this machine' }, async () => {
  const o = await owner();
  const s = await server({ WHEELHOUSE_DEV_AUTOLOGIN: '1', WHEELHOUSE_DEV_LOGIN_EMAIL: o.email });
  const port = new URL(s.baseUrl).port;
  const viaLan = await send(`http://${lanAddress}:${port}`, '/api/auth/me', { headers: { host: `localhost:${port}` } });
  assert.equal(viaLan.status, 401, 'a request from the network address is not this machine');
  const write = await send(`http://${lanAddress}:${port}`, '/api/customers', { method: 'POST', body: JSON.stringify({ name: 'From Wifi' }), headers: { host: `localhost:${port}` } });
  assert.equal(write.status, 401);
  assert.equal((await get(s.baseUrl, '/api/auth/me')).status, 200, 'the same server, over loopback, still signs in');
});

test('signing in (WorkOS, pretend) clears the signed-out mark', async () => {
  const o = await owner();
  const s = await server({ WHEELHOUSE_DEV_AUTOLOGIN: '1', WHEELHOUSE_DEV_LOGIN_EMAIL: o.email, STAFF_SIGNIN_PROVIDER: 'pretend' });
  const hop = async (url, { cookie = '', method = 'GET', form } = {}) => {
    const res = await fetch(new URL(url, s.baseUrl), {
      method, redirect: 'manual',
      headers: { cookie, ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
      body: form ? new URLSearchParams(form).toString() : undefined,
    });
    return { status: res.status, location: res.headers.get('location'), cookies: res.headers.getSetCookie() };
  };
  const start = await hop('/api/auth/workos/start');
  const stateCookie = start.cookies.map((c) => c.split(';')[0]).find((c) => c.startsWith('wh_signin_state='));
  const page = new URL(start.location, s.baseUrl);
  const back = await hop('/api/auth/workos/pretend', { method: 'POST', form: { email: o.email, verified: 'on', state: page.searchParams.get('state'), redirect_uri: page.searchParams.get('redirect_uri') } });
  const callback = new URL(back.location, s.baseUrl);
  const done = await hop(callback.pathname + callback.search, { cookie: stateCookie });
  assert.equal(done.status, 302);
  assert.ok(done.cookies.some((c) => c.startsWith('wh_dev_signed_out=;') && /Max-Age=0/.test(c)), done.cookies.join(' | '));
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
