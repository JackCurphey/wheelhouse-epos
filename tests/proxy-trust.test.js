// tests/proxy-trust.test.js
//
// The app used to sit behind a Cloudflare Tunnel, which stripped any
// forwarding headers a client tried to spoof before they reached this
// process. Nothing does that any more, so anything a client can set is
// attacker-controlled and must not be believed unless a proxy we trust put
// it there. The per-IP rate limiter on login/signup is what depends on
// getting this right: a spoofable key means no brute-force protection at
// all, because every request can claim a fresh IP.
import test from 'node:test';
import assert from 'node:assert/strict';
import { clientIp, isHttpsRequest } from '../server/proxy-trust.js';

function fakeReq(headers = {}, remoteAddress = '203.0.113.7') {
  return { headers, socket: { remoteAddress } };
}

test('clientIp ignores cf-connecting-ip even when a proxy is trusted', () => {
  const req = fakeReq({ 'cf-connecting-ip': '1.2.3.4' });
  assert.equal(clientIp(req, { trustProxy: true }), '203.0.113.7');
  assert.equal(clientIp(req, { trustProxy: false }), '203.0.113.7');
});

test('clientIp ignores x-forwarded-for when no proxy is trusted', () => {
  const req = fakeReq({ 'x-forwarded-for': '1.2.3.4' });
  assert.equal(clientIp(req, { trustProxy: false }), '203.0.113.7');
});

test('clientIp uses the first x-forwarded-for entry when a proxy is trusted', () => {
  const req = fakeReq({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' });
  assert.equal(clientIp(req, { trustProxy: true }), '1.2.3.4');
});

test('clientIp falls back to the socket address when a trusted proxy sends no header', () => {
  assert.equal(clientIp(fakeReq({}), { trustProxy: true }), '203.0.113.7');
});

test('clientIp cannot be driven to a constant by an empty spoofed header', () => {
  // A blank x-forwarded-for must not collapse every caller onto one key.
  const a = clientIp(fakeReq({ 'x-forwarded-for': '' }, '198.51.100.1'), { trustProxy: true });
  const b = clientIp(fakeReq({ 'x-forwarded-for': '' }, '198.51.100.2'), { trustProxy: true });
  assert.notEqual(a, b);
});

test('isHttpsRequest ignores x-forwarded-proto when no proxy is trusted', () => {
  const req = fakeReq({ 'x-forwarded-proto': 'https' });
  assert.equal(isHttpsRequest(req, { trustProxy: false }), false);
});

test('isHttpsRequest honours x-forwarded-proto from a trusted proxy', () => {
  const req = fakeReq({ 'x-forwarded-proto': 'https' });
  assert.equal(isHttpsRequest(req, { trustProxy: true }), true);
});

test('isHttpsRequest reports true for a directly-terminated TLS socket', () => {
  const req = { headers: {}, socket: { remoteAddress: '203.0.113.7', encrypted: true } };
  assert.equal(isHttpsRequest(req, { trustProxy: false }), true);
});
