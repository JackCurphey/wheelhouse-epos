// One request the server can't look up never takes every shop down
// (openspec/changes/server-stays-up-when-busy). The request dispatcher's own
// steps (reading the address, finding an online shop or a website's shop by
// name, the staff sign-in lookup) sat outside any try: a database that
// refused the lookup, or a pool whose 5-second wait ran out, became an
// unhandled rejection and the crash guard stopped the process. Here each
// lookup is made to fail with something Postgres or the server refuses: %00
// decodes to a NUL character, which Postgres won't take in text, and %ZZ is
// not a valid escape at all.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';

// The answer, or what went wrong reaching the server (it stopped mid-request).
async function ask(baseUrl, path, headers = {}) {
  try {
    const res = await fetch(`${baseUrl}${path}`, { headers });
    return { status: res.status, body: await res.json().catch(() => null) };
  } catch (err) {
    return { status: null, error: String(err.cause?.code ?? err.message) };
  }
}

// A fresh server for each, so one that stops can't fail the others.
async function onItsOwnServer(fn) {
  const server = await startLiveServer();
  try {
    await fn(server.baseUrl);
  } finally {
    await server.stop();
  }
}

async function stillUp(baseUrl) {
  const next = await ask(baseUrl, '/healthz');
  assert.equal(next.status, 200, `the next request: ${JSON.stringify(next)}`);
}

for (const [what, path, headers] of [
  ['a staff sign-in cookie the database refuses', '/api/label-settings', { cookie: 'wh_session=%00' }],
  ['a staff sign-in cookie that is not a valid escape', '/api/label-settings', { cookie: 'wh_session=%ZZ' }],
  ['a website shop name the database refuses', '/api/portal/%00/services', {}],
  ['an online shop name the database refuses', '/?storefrontSlug=%00', {}],
  ['an address that is not a valid escape', '/%ZZ', {}],
]) {
  test(`${what}: that request gets an error and the server answers the next one`, () => onItsOwnServer(async (baseUrl) => {
    const got = await ask(baseUrl, path, headers);
    assert.equal(got.status, 500, JSON.stringify(got));
    assert.deepEqual(got.body, { error: 'Internal server error' });
    await stillUp(baseUrl);
  }));
}
