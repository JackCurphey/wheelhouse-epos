// tests/gateway-headers.test.js
//
// TRUST_PROXY is only safe because the gateway overwrites the forwarding
// headers rather than passing the client's version through. If a spoofed
// x-forwarded-for could survive the hop, turning TRUST_PROXY on would hand
// the rate limiter's key straight to the caller. These tests hold that
// end of the bargain.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProxyHeaders } from '../server/gateway.js';

test('a client-supplied x-forwarded-for is replaced with the real socket address', () => {
  const out = buildProxyHeaders({ 'x-forwarded-for': '1.2.3.4' }, '198.51.100.9');
  assert.equal(out['x-forwarded-for'], '198.51.100.9');
});

test('cf-connecting-ip and friends are stripped, not forwarded', () => {
  const out = buildProxyHeaders(
    { 'cf-connecting-ip': '1.2.3.4', 'true-client-ip': '1.2.3.4', 'x-real-ip': '1.2.3.4' },
    '198.51.100.9'
  );
  assert.equal(out['cf-connecting-ip'], undefined);
  assert.equal(out['true-client-ip'], undefined);
  assert.equal(out['x-real-ip'], undefined);
});

test('a client cannot claim https by setting x-forwarded-proto', () => {
  const out = buildProxyHeaders({ 'x-forwarded-proto': 'https' }, '198.51.100.9');
  assert.equal(out['x-forwarded-proto'], 'http');
});

test('ordinary headers pass through untouched', () => {
  const out = buildProxyHeaders(
    { host: 'acme.wheelhouseepos.com', cookie: 'session=abc', 'content-type': 'application/json' },
    '198.51.100.9'
  );
  assert.equal(out.host, 'acme.wheelhouseepos.com');
  assert.equal(out.cookie, 'session=abc');
  assert.equal(out['content-type'], 'application/json');
});

test('the Host header survives, since storefront subdomains resolve from it', () => {
  const out = buildProxyHeaders({ host: 'shop.example.com' }, '198.51.100.9');
  assert.equal(out.host, 'shop.example.com');
});

test('the original headers object is not mutated', () => {
  const original = { 'x-forwarded-for': '1.2.3.4' };
  buildProxyHeaders(original, '198.51.100.9');
  assert.equal(original['x-forwarded-for'], '1.2.3.4');
});
