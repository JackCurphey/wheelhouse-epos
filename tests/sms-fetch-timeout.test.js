// tests/sms-fetch-timeout.test.js
//
// Proves the Twilio call in sendSms is bounded by an AbortSignal timeout -
// a Twilio endpoint that never responds must produce a bounded
// {ok:false, error} result (the same shape sendSms already returns for any
// other network failure), not an indefinite hang.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { sendSms } from '../server/sms.js';

function stubFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return () => { globalThis.fetch = original; };
}

function neverRespondingFetch() {
  return (url, opts) => new Promise((resolve, reject) => {
    opts?.signal?.addEventListener('abort', () => {
      reject(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
    });
  });
}

// Simulates the window Finding 1 lives in: the response headers arrive
// (2xx, res.ok true) but the body never finishes streaming. Real
// fetch/undici rejects res.json() with the same AbortSignal.timeout()
// DOMException in this case, since the signal covers the whole request
// including body read - this stub reproduces exactly that, rather than
// neverRespondingFetch's "no response at all" case which never reaches
// res.json() in the first place.
function headersArriveBodyStallsFetch() {
  return (url, opts) => Promise.resolve({
    ok: true,
    status: 200,
    json: () => new Promise((resolve, reject) => {
      opts?.signal?.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
      });
    }),
  });
}

test('sendSms fails within a bounded time instead of hanging when Twilio never responds', async () => {
  const originalSid = process.env.TWILIO_ACCOUNT_SID;
  const originalToken = process.env.TWILIO_AUTH_TOKEN;
  const originalFrom = process.env.TWILIO_FROM_NUMBER;
  process.env.TWILIO_ACCOUNT_SID = 'ACfake';
  process.env.TWILIO_AUTH_TOKEN = 'faketoken';
  process.env.TWILIO_FROM_NUMBER = '+441234567890';

  const restore = stubFetch(neverRespondingFetch());
  try {
    const start = Date.now();
    const watchdog = new Promise((resolve) => setTimeout(() => resolve('WATCHDOG'), 8000));
    const outcome = sendSms('+447700900123', 'test message').then((result) => ({ settled: 'RESULT', result }));
    const raced = await Promise.race([outcome, watchdog.then((v) => ({ settled: v }))]);
    const elapsed = Date.now() - start;
    assert.notEqual(raced.settled, 'WATCHDOG', `sendSms hung past the watchdog (${elapsed}ms) instead of timing out`);
    assert.equal(raced.result.ok, false);
    assert.match(raced.result.error, /timeout|abort/i, `expected a timeout-shaped error, got: ${raced.result.error}`);
    assert.ok(elapsed < 8000, `expected a bounded failure well under the watchdog, took ${elapsed}ms`);
  } finally {
    restore();
    process.env.TWILIO_ACCOUNT_SID = originalSid;
    process.env.TWILIO_AUTH_TOKEN = originalToken;
    process.env.TWILIO_FROM_NUMBER = originalFrom;
  }
});

// Finding 1: a successful (2xx) response whose body stalls until the
// timeout fires must still return the normal {ok:false, error} shape, not
// throw an uncaught TypeError from `data.sid` when `res.json()` rejects and
// the `.catch(() => null)` leaves `data` null.
test('sendSms returns a bounded {ok:false, error} instead of throwing when the response body stalls after 2xx headers', async () => {
  const originalSid = process.env.TWILIO_ACCOUNT_SID;
  const originalToken = process.env.TWILIO_AUTH_TOKEN;
  const originalFrom = process.env.TWILIO_FROM_NUMBER;
  process.env.TWILIO_ACCOUNT_SID = 'ACfake';
  process.env.TWILIO_AUTH_TOKEN = 'faketoken';
  process.env.TWILIO_FROM_NUMBER = '+441234567890';

  const restore = stubFetch(headersArriveBodyStallsFetch());
  try {
    const start = Date.now();
    const watchdog = new Promise((resolve) => setTimeout(() => resolve({ settled: 'WATCHDOG' }), 8000));
    // sendSms must not reject - if it does, this .catch turns the rejection
    // into a distinguishable outcome so the assertion below fails loudly
    // instead of the test crashing with an unhandled rejection.
    const outcome = sendSms('+447700900123', 'test message')
      .then((result) => ({ settled: 'RESULT', result }))
      .catch((err) => ({ settled: 'THREW', err }));
    const raced = await Promise.race([outcome, watchdog]);
    const elapsed = Date.now() - start;
    assert.notEqual(raced.settled, 'WATCHDOG', `sendSms hung past the watchdog (${elapsed}ms) instead of timing out`);
    assert.notEqual(raced.settled, 'THREW', `sendSms threw/rejected instead of returning {ok:false, error}: ${raced.err && raced.err.stack}`);
    assert.equal(raced.result.ok, false);
    assert.match(raced.result.error, /timeout|abort/i, `expected a timeout-shaped error, got: ${raced.result.error}`);
    assert.ok(elapsed < 8000, `expected a bounded failure well under the watchdog, took ${elapsed}ms`);
  } finally {
    restore();
    process.env.TWILIO_ACCOUNT_SID = originalSid;
    process.env.TWILIO_AUTH_TOKEN = originalToken;
    process.env.TWILIO_FROM_NUMBER = originalFrom;
  }
});
