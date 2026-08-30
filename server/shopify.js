import { createCipheriv, createDecipheriv, createHmac, timingSafeEqual, randomBytes, scryptSync } from 'node:crypto';
import { prepare } from './db.js';

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

const SHOPIFY_API_VERSION = '2024-10';

export async function shopifyAdminRequest(connection, method, path, body) {
  const accessToken = decryptSecret(connection.access_token);
  const res = await fetch(`https://${connection.shop_domain}/admin/api/${SHOPIFY_API_VERSION}${path}`, {
    method,
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Shopify API error (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

export function serializeShopifyConnection(row) {
  if (!row) return { connected: false, shopDomain: null, status: 'not_connected', connectedAt: null };
  return {
    connected: row.status === 'connected',
    shopDomain: row.shop_domain,
    status: row.status,
    connectedAt: row.connected_at,
  };
}

export async function getShopifyConnection() {
  const row = await prepare('SELECT * FROM shopify_connections LIMIT 1').get();
  return row || null;
}

export async function getShopifyConnectionByShopId(shopId) {
  const row = await prepare('SELECT * FROM shopify_connections WHERE shop_id = ?').get(shopId);
  return row || null;
}

export async function saveShopifyConnection({ shopDomain, accessToken, storefrontApiToken }) {
  // Verify the token works, and fetch the shop's primary location, before
  // ever storing anything - a bad token should fail loudly here rather
  // than being saved as a silently broken "connected" state.
  const probeConnection = { shop_domain: shopDomain, access_token: encryptSecret(accessToken) };
  const locationsResponse = await shopifyAdminRequest(probeConnection, 'GET', '/locations.json');
  const locationId = String(locationsResponse.locations[0].id);

  const existing = await getShopifyConnection();
  const webhookSecret = existing ? decryptSecret(existing.webhook_secret) : randomBytes(32).toString('hex');
  const encryptedAccessToken = encryptSecret(accessToken);
  const encryptedWebhookSecret = encryptSecret(webhookSecret);
  const now = new Date().toISOString();

  if (existing) {
    await prepare(
      `UPDATE shopify_connections
       SET shop_domain = ?, access_token = ?, storefront_api_token = ?, webhook_secret = ?, location_id = ?, status = ?, connected_at = ?, updated_at = ?
       WHERE id = ?`
    ).run(shopDomain, encryptedAccessToken, storefrontApiToken, encryptedWebhookSecret, locationId, 'connected', now, now, existing.id);
  } else {
    await prepare(
      `INSERT INTO shopify_connections (shop_domain, access_token, storefront_api_token, webhook_secret, location_id, status, connected_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(shopDomain, encryptedAccessToken, storefrontApiToken, encryptedWebhookSecret, locationId, 'connected', now, now);
  }
  return getShopifyConnection();
}

export async function registerShopifyWebhooks(connection, shopId) {
  const baseUrl = process.env.APP_PUBLIC_URL;
  if (!baseUrl) throw new Error('APP_PUBLIC_URL is not configured');
  await shopifyAdminRequest(connection, 'POST', '/webhooks.json', {
    webhook: { topic: 'orders/paid', address: `${baseUrl}/webhooks/shopify/${shopId}/orders`, format: 'json' },
  });
  await shopifyAdminRequest(connection, 'POST', '/webhooks.json', {
    webhook: { topic: 'refunds/create', address: `${baseUrl}/webhooks/shopify/${shopId}/refunds`, format: 'json' },
  });
}
