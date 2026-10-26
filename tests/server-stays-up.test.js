// One request the server can't look up never takes every shop down
// (openspec/changes/server-stays-up-when-busy). The request dispatcher's own
// steps (reading the address, finding an online shop or a website's shop by
// name, the staff sign-in lookup) sat outside any try: a database that
// refused the lookup, or a pool whose 5-second wait ran out, became an
// unhandled rejection and the crash guard stopped the process. Here each
// lookup is made to fail with something Postgres or the server refuses: %00
// decodes to a NUL character, which Postgres won't take in text, and %ZZ is
// not a valid escape at all.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

const FIXED = { error: 'Internal server error' };

// The answer, or what went wrong reaching the server (it stopped mid-request).
async function ask(baseUrl, path, { method = 'GET', headers = {} } = {}) {
  try {
    const res = await fetch(`${baseUrl}${path}`, { method, headers });
    const text = await res.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: res.status, body, text };
  } catch (err) {
    return { status: null, error: String(err.cause?.code ?? err.message) };
  }
}

// The server's log reaches this process a moment after its answer does.
async function loggedSince(from, re, ms = 2000) {
  const end = Date.now() + ms;
  for (;;) {
    const since = server.stderr.slice(from);
    if (re.test(since) || Date.now() > end) return since;
    await new Promise((r) => setTimeout(r, 50));
  }
}

async function stillUp(baseUrl) {
  const next = await ask(baseUrl, '/healthz');
  assert.equal(next.status, 200, `the next request: ${JSON.stringify(next)}`);
}

// ---------- Lookups that used to stop the server: a fresh server for each ----------

async function onItsOwnServer(fn) {
  const server = await startLiveServer();
  try {
    await fn(server.baseUrl);
  } finally {
    await server.stop();
  }
}

for (const [what, path, headers] of [
  ['a staff sign-in cookie the database refuses', '/api/label-settings', { cookie: 'wh_session=%00' }],
  ['a website shop name the database refuses', '/api/portal/%00/services', {}],
  ['an online shop name the database refuses', '/?storefrontSlug=%00', {}],
]) {
  test(`${what}: that request gets an error and the server answers the next one`, () => onItsOwnServer(async (baseUrl) => {
    const got = await ask(baseUrl, path, { headers });
    assert.equal(got.status, 500, JSON.stringify(got));
    assert.deepEqual(got.body, FIXED);
    await stillUp(baseUrl);
  }));
}

// ---------- The rest on one server, with a real shop ----------

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

test('a garbled address gets 400 Bad request, with no stack trace logged, and the server answers the next one', async () => {
  const logged = server.stderr.length;
  const got = await ask(server.baseUrl, '/%ZZ');
  assert.equal(got.status, 400, JSON.stringify(got));
  assert.deepEqual(got.body, { error: 'Bad request' });
  await stillUp(server.baseUrl);
  // Waits the full time unless a stack trace turns up, so a late one is still seen.
  const since = await loggedSince(logged, /URIError|\n\s+at /, 500);
  assert.ok(!/URIError|\n\s+at /.test(since), `logged: ${since}`);
});

test('a cookie another app on the same domain set, which is not a valid escape, doesn’t stop a signed-in request', async () => {
  const got = await ask(server.baseUrl, '/api/label-settings', { headers: { cookie: `promo=50%off; ${owner.cookie}` } });
  assert.equal(got.status, 200, JSON.stringify(got));
  // A sign-in cookie that is not a valid escape is just a sign-in that isn't there.
  const garbled = await ask(server.baseUrl, '/api/label-settings', { headers: { cookie: 'wh_session=%ZZ' } });
  assert.equal(garbled.status, 401, JSON.stringify(garbled));
  await stillUp(server.baseUrl);
});

// Each branch of the dispatcher that answers people who aren't signed in.
const BEARER = `Bearer ${'0'.repeat(64)}`;
for (const [what, path, method, headers] of [
  ['the website, before its shop is found', '/api/portal/%00/services', 'GET', {}],
  ['a till, whose shop name the database refuses', '/api/till/%00/snapshot', 'GET', { authorization: BEARER }],
  ['the website’s sign-out, with a cookie the database refuses', '/api/portal/%00/logout', 'POST', { cookie: 'wh_customer_session=%00' }],
  ['staff sign-in’s own routes, with a cookie the database refuses', '/api/auth/me', 'GET', { cookie: 'wh_session=%00' }],
  ['a website route, with a cookie the database refuses', null, 'GET', { cookie: 'wh_customer_session=%00' }],
]) {
  test(`${what}: the error answer says nothing about the database, and the details are logged`, async () => {
    const logged = server.stderr.length;
    const got = await ask(server.baseUrl, path ?? `/api/portal/${owner.shop.slug}/me`, { method, headers });
    assert.equal(got.status, 500, JSON.stringify(got));
    assert.deepEqual(got.body, FIXED);
    assert.ok(!/UTF8|byte sequence/.test(got.text), got.text);
    assert.match(await loggedSince(logged, /invalid byte sequence/), /invalid byte sequence/);
  });
}
