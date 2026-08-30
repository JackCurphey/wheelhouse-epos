import { createCipheriv, createDecipheriv, createHmac, timingSafeEqual, randomBytes, scryptSync } from 'node:crypto';

const ENCRYPTION_KEY = scryptSync(process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY || 'dev-only-insecure-key', 'shopify-token-salt', 32);

export function encryptSecret(plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

export function decryptSecret(encoded) {
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function verifyShopifyWebhookHmac(rawBody, hmacHeader, webhookSecret) {
  if (!hmacHeader) return false;
  const computed = createHmac('sha256', webhookSecret).update(rawBody, 'utf8').digest('base64');
  const a = Buffer.from(computed);
  const b = Buffer.from(hmacHeader);
  return a.length === b.length && timingSafeEqual(a, b);
}
