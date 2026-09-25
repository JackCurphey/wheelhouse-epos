// The API client's contract, with fetch stubbed - no server, no browser.
//
// The stubbed bodies are the server's real 409 shapes ({ error, code }, from
// jobActionRoute and sendQuoteResult in server/server.js), not invented ones:
// a client that classifies a body the server never sends proves nothing.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { apiGet, apiMutate, jobAction, ApiError } from '../../src/lib/api/client.ts';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

function stubFetch(status, body) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      status,
      ok: status >= 200 && status < 300,
      json: async () => {
        if (body === undefined) throw new SyntaxError('Unexpected end of JSON input');
        return body;
      },
    };
  };
  return calls;
}

test('jobAction sends the version in the body', async () => {
  const calls = stubFetch(200, { id: 1, version: 4 });
  await jobAction(1, 'start', 3);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/workshop-jobs/1/start');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), { version: 3 });
});

test('jobAction keeps the caller body and the version wins over any version in it', async () => {
  const calls = stubFetch(200, { id: 1, version: 4 });
  await jobAction(1, 'hold', 3, { reason: 'awaiting part', version: 99 });
  assert.deepEqual(JSON.parse(calls[0].options.body), { reason: 'awaiting part', version: 3 });
});

test('a 409 the server marks stale becomes an ApiError with code "stale"', async () => {
  stubFetch(409, { error: 'This job changed while you were looking at it. Reload and try again.', code: 'stale' });
  await assert.rejects(
    () => jobAction(1, 'start', 3),
    (err) => err instanceof ApiError && err.status === 409 && err.code === 'stale'
      && /changed while you were looking/.test(err.message),
  );
});

test('a 409 illegal transition is distinguished from a stale one', async () => {
  stubFetch(409, { error: 'cannot start a job that is finished; from here you can do nothing', code: 'illegal' });
  await assert.rejects(() => jobAction(1, 'start', 3), (err) => err.code === 'illegal');
});

test('a 409 without a code is not guessed to be stale', async () => {
  // Treating an unknown refusal as stale would reload and invite a retry of
  // something that may never be allowed.
  stubFetch(409, { error: 'That time is no longer available - please choose another.' });
  await assert.rejects(() => jobAction(1, 'start', 3), (err) => err.status === 409 && err.code === 'unknown');
});

test('apiGet throws on 404 rather than returning undefined', async () => {
  stubFetch(404, { error: 'Job not found' });
  await assert.rejects(() => apiGet('/api/workshop-jobs/9'), (err) => err.status === 404 && err.code === 'not_found');
});

test('a 401 is "unauthorized" and a 400 is "bad_request"', async () => {
  stubFetch(401, { error: 'Not signed in' });
  await assert.rejects(() => apiGet('/api/auth/me'), (err) => err.code === 'unauthorized');
  stubFetch(400, { error: 'version is required - send the version you last read' });
  await assert.rejects(() => apiMutate('/api/x', {}), (err) => err.code === 'bad_request');
});

test('an error with no JSON body still throws an ApiError, not a parse error', async () => {
  stubFetch(502, undefined);
  await assert.rejects(() => apiGet('/api/workshop-jobs'), (err) => err instanceof ApiError && err.status === 502 && err.code === 'unknown');
});

test('requests send the session cookie and mutations declare JSON', async () => {
  const calls = stubFetch(200, {});
  await apiMutate('/api/x', { a: 1 }, { method: 'PUT' });
  assert.equal(calls[0].options.credentials, 'same-origin');
  assert.equal(calls[0].options.method, 'PUT');
  assert.equal(calls[0].options.headers['content-type'], 'application/json');
});

test('a 409 for used-up capacity is its own code, not stale', async () => {
  // The body server/server.js's capacityRefusal() sends.
  stubFetch(409, { error: 'That time is no longer available - please choose another.', code: 'capacity' });
  await assert.rejects(
    () => apiMutate('/api/portal/shop/bookings', {}),
    (err) => err instanceof ApiError && err.status === 409 && err.code === 'capacity'
  );
});
