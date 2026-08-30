import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { encryptSecret, decryptSecret, verifyShopifyWebhookHmac } from '../server/shopify.js';

test('encryptSecret/decryptSecret round-trip', () => {
  const plaintext = 'shpat_abc123secret';
  const encrypted = encryptSecret(plaintext);
  assert.notEqual(encrypted, plaintext);
  assert.equal(decryptSecret(encrypted), plaintext);
});

test('encryptSecret produces different ciphertext each time (random IV)', () => {
  const a = encryptSecret('same-input');
  const b = encryptSecret('same-input');
  assert.notEqual(a, b);
  assert.equal(decryptSecret(a), 'same-input');
  assert.equal(decryptSecret(b), 'same-input');
});

test('verifyShopifyWebhookHmac accepts a correctly signed body', () => {
  const secret = 'test-webhook-secret';
  const rawBody = '{"id":123,"line_items":[]}';
  const validHmac = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  assert.equal(verifyShopifyWebhookHmac(rawBody, validHmac, secret), true);
});

test('verifyShopifyWebhookHmac rejects a tampered body', () => {
  const secret = 'test-webhook-secret';
  const validHmac = createHmac('sha256', secret).update('{"id":123}', 'utf8').digest('base64');
  assert.equal(verifyShopifyWebhookHmac('{"id":456}', validHmac, secret), false);
});

test('verifyShopifyWebhookHmac rejects a missing signature', () => {
  assert.equal(verifyShopifyWebhookHmac('{"id":123}', undefined, 'test-webhook-secret'), false);
});
