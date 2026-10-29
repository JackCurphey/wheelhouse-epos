// The staff sign-in providers (openspec/changes/staff-signin-workos design 2):
// which one is connected, and the real WorkOS one's three calls against a
// stand-in fetch, as WorkOS's API reference describes them (checked 25 Oct).
import test from 'node:test';
import assert from 'node:assert/strict';
import { staffSigninProvider } from '../server/staff-signin/provider.js';
import { workosProvider } from '../server/staff-signin/workos.js';

const KEYS = { WORKOS_API_KEY: 'sk_test_abc', WORKOS_CLIENT_ID: 'client_123' };

// A JWT-shaped token whose payload carries `sid`; WorkOS signs it, but only
// sid is read, from a token that came straight from WorkOS.
const token = (payload) => ['e30', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'sig'].join('.');

function quietLog() {
  const lines = [];
  return { lines, log: (line) => lines.push(line) };
}

test('which provider: pretend, workos, or none', () => {
  assert.equal(staffSigninProvider({ STAFF_SIGNIN_PROVIDER: 'pretend' }).name, 'pretend');
  assert.equal(staffSigninProvider({ STAFF_SIGNIN_PROVIDER: 'workos', ...KEYS }).name, 'workos');
  assert.equal(staffSigninProvider({}), null);
  assert.equal(staffSigninProvider({ STAFF_SIGNIN_PROVIDER: 'something-else' }), null);
});

test('the pretend one never runs in production', () => {
  const { lines, log } = quietLog();
  assert.equal(staffSigninProvider({ STAFF_SIGNIN_PROVIDER: 'pretend', NODE_ENV: 'production' }, { log }), null);
  assert.match(lines.join('\n'), /pretend/i);
});

test('a missing WorkOS setting means not connected, naming the setting', () => {
  for (const missing of ['WORKOS_API_KEY', 'WORKOS_CLIENT_ID']) {
    const { lines, log } = quietLog();
    const env = { STAFF_SIGNIN_PROVIDER: 'workos', ...KEYS, [missing]: '' };
    assert.equal(staffSigninProvider(env, { log }), null, missing);
    assert.match(lines.join('\n'), new RegExp(missing));
  }
});

test('the authorize address sends the person to AuthKit with the right settings', () => {
  const p = workosProvider({ ...KEYS });
  const url = new URL(p.authorizeUrl({ state: 's1', redirectUri: 'http://localhost:8080/api/auth/workos/callback' }));
  assert.equal(url.origin + url.pathname, 'https://api.workos.com/user_management/authorize');
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    client_id: 'client_123',
    redirect_uri: 'http://localhost:8080/api/auth/workos/callback',
    response_type: 'code',
    provider: 'authkit',
    state: 's1',
  });
});

test('asked for Google, the authorize address goes straight to Google (provider=GoogleOAuth)', () => {
  const url = new URL(workosProvider({ ...KEYS }).authorizeUrl({ state: 's1', redirectUri: 'http://localhost:8080/api/auth/workos/callback', provider: 'GoogleOAuth' }));
  assert.equal(url.searchParams.get('provider'), 'GoogleOAuth');
});

test('the redirect address comes from WORKOS_REDIRECT_URI, with localhost:8080 by default', () => {
  assert.equal(workosProvider({ ...KEYS }).redirectUri(), 'http://localhost:8080/api/auth/workos/callback');
  assert.equal(workosProvider({ ...KEYS, WORKOS_REDIRECT_URI: 'https://test.example/api/auth/workos/callback' }).redirectUri(), 'https://test.example/api/auth/workos/callback');
});

test('authenticate sends the API key as client_secret and reads the person and sid', async () => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({
      user: { id: 'user_01', email: 'Owner@Example.com', email_verified: true },
      access_token: token({ sid: 'session_01', sub: 'user_01' }),
      refresh_token: 'r',
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const p = workosProvider({ ...KEYS }, { fetch });
  const got = await p.authenticate({ code: 'c1' });
  assert.deepEqual(got, { user: { id: 'user_01', email: 'owner@example.com', emailVerified: true }, sessionId: 'session_01' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.workos.com/user_management/authenticate');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    client_id: 'client_123', client_secret: 'sk_test_abc', grant_type: 'authorization_code', code: 'c1',
  });
});

test('authenticate gives null when WorkOS refuses the code, or can’t be reached', async () => {
  const refused = workosProvider({ ...KEYS }, { fetch: async () => new Response('{"error":"invalid_grant"}', { status: 400 }) });
  assert.equal(await refused.authenticate({ code: 'old' }), null);
  const { log } = quietLog();
  const down = workosProvider({ ...KEYS }, { fetch: async () => { throw new Error('offline'); }, log });
  assert.equal(await down.authenticate({ code: 'c' }), null);
});

// A workshop computer keeps no remembered WorkOS session (workshop-lock-server,
// the review of #578): POST /user_management/sessions/revoke, as WorkOS's API
// reference shows it (checked 29 Oct, workos.com/docs/reference/user-management/session/revoke).
test('revoking a WorkOS session sends its id with the API key, and says whether it is over (taken, or already gone)', async () => {
  const calls = [];
  const p = workosProvider({ ...KEYS }, { fetch: async (url, init) => { calls.push({ url, init }); return new Response('{}', { status: 200 }); } });
  assert.equal(await p.revokeSession({ sessionId: 'session_01' }), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.workos.com/user_management/sessions/revoke');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.authorization, 'Bearer sk_test_abc');
  assert.equal(calls[0].init.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0].init.body), { session_id: 'session_01' });
  assert.equal(await p.revokeSession({ sessionId: null }), false, 'nothing to revoke');
  assert.equal(calls.length, 1);
  // Already gone, or refused for good (a 4xx other than 429): nothing left to
  // end, so no retry. Not reached, 429 or a WorkOS fault (5xx): try again.
  // WorkOS's reference (session/revoke, errors) doesn't say what an unknown
  // or ended session gets; its errors page lists 404 as "The resource was not found".
  for (const [status, done] of [[404, true], [400, true], [422, true], [429, false], [500, false], [503, false]]) {
    const p2 = workosProvider({ ...KEYS }, { fetch: async () => new Response('{}', { status }), log: quietLog().log });
    assert.equal(await p2.revokeSession({ sessionId: 'session_02' }), done, String(status));
  }
  const down = workosProvider({ ...KEYS }, { fetch: async () => { throw new Error('offline'); }, log: quietLog().log });
  assert.equal(await down.revokeSession({ sessionId: 'session_03' }), false);
});

test('the sign-out address ends that WorkOS session and comes back to Wheelhouse', () => {
  const p = workosProvider({ ...KEYS });
  const url = new URL(p.logoutUrl({ sessionId: 'session_01' }));
  assert.equal(url.origin + url.pathname, 'https://api.workos.com/user_management/sessions/logout');
  assert.equal(url.searchParams.get('session_id'), 'session_01');
  // The Sign-out URI set in WorkOS's Redirects: the app's own address.
  assert.equal(url.searchParams.get('return_to'), 'http://localhost:8080/workshop/signed-out');
  assert.equal(p.logoutUrl({ sessionId: null }), null);
});

test('a reply from WorkOS that isn’t what it should be signs nobody in', async () => {
  const { lines, log } = quietLog();
  const notJson = workosProvider({ ...KEYS }, { fetch: async () => new Response('<html>', { status: 200 }), log });
  assert.equal(await notJson.authenticate({ code: 'c' }), null);
  const noUser = workosProvider({ ...KEYS }, { fetch: async () => Response.json({ access_token: token({ sid: 's' }) }), log });
  assert.equal(await noUser.authenticate({ code: 'c' }), null);
  assert.ok(lines.length >= 2, 'each is logged');
});

test('the pretend one never runs on the hosted test copy', () => {
  const { log } = quietLog();
  assert.equal(staffSigninProvider({ STAFF_SIGNIN_PROVIDER: 'pretend', WHEELHOUSE_HOSTED_COPY: '1' }, { log }), null);
});
