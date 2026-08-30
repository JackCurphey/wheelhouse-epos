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

// Small in-process retry for transient Shopify API failures (rate limits,
// momentary 5xxs). Not a persistent job queue - there's no background
// worker infrastructure in this app yet, and one shop's occasional sync
// hiccup doesn't warrant building one. If every attempt fails, the caller
// marks the connection sync_error so it's visible in shop settings rather
// than failing silently; the next successful product edit or sale clears
// it back to connected on its own.
async function withRetry(fn, attempts = 3, baseDelayMs = 500) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** i));
      }
    }
  }
  throw lastError;
}

export async function syncProductToShopify(product) {
  const connection = await getShopifyConnection();
  if (!connection || connection.status === 'not_connected') return null;

  try {
    const result = await withRetry(async () => {
      const payload = {
        product: {
          title: product.name,
          body_html: product.description || '',
          variants: [{ price: String(product.price) }],
        },
      };

      let response;
      if (product.shopify_product_id) {
        payload.product.id = product.shopify_product_id;
        response = await shopifyAdminRequest(connection, 'PUT', `/products/${product.shopify_product_id}.json`, payload);
      } else {
        response = await shopifyAdminRequest(connection, 'POST', '/products.json', payload);
      }

      const shopifyProduct = response.product;
      const variant = shopifyProduct.variants[0];
      await prepare(
        'UPDATE products SET shopify_product_id = ?, shopify_variant_id = ?, shopify_inventory_item_id = ? WHERE id = ?'
      ).run(String(shopifyProduct.id), String(variant.id), String(variant.inventory_item_id), product.id);

      return { shopifyProductId: String(shopifyProduct.id), shopifyVariantId: String(variant.id) };
    }, 3, 50);
    if (connection.status === 'sync_error') {
      await prepare('UPDATE shopify_connections SET status = ? WHERE id = ?').run('connected', connection.id);
    }
    return result;
  } catch (err) {
    await prepare('UPDATE shopify_connections SET status = ? WHERE id = ?').run('sync_error', connection.id);
    throw err;
  }
}

export async function pushInventoryLevel(product, quantity) {
  if (!product.shopify_inventory_item_id) return;
  const connection = await getShopifyConnection();
  // 'sync_error' still attempts the push (it means "was connected, one
  // sync failed" - not "give up permanently"). Only a connection that was
  // never established at all is skipped.
  if (!connection || connection.status === 'not_connected') return;

  try {
    await withRetry(() => shopifyAdminRequest(connection, 'POST', '/inventory_levels/set.json', {
      location_id: connection.location_id,
      inventory_item_id: product.shopify_inventory_item_id,
      available: quantity,
    }), 3, 50);
    if (connection.status === 'sync_error') {
      await prepare('UPDATE shopify_connections SET status = ? WHERE id = ?').run('connected', connection.id);
    }
  } catch (err) {
    await prepare('UPDATE shopify_connections SET status = ? WHERE id = ?').run('sync_error', connection.id);
    throw err;
  }
}

export async function unpublishProductFromShopify(product) {
  const connection = await getShopifyConnection();
  if (!connection || connection.status !== 'connected' || !product.shopify_product_id) return;
  await shopifyAdminRequest(connection, 'PUT', `/products/${product.shopify_product_id}.json`, {
    product: { id: product.shopify_product_id, published: false },
  });
}

export async function matchOrderLineItemsToProducts(order) {
  const items = [];
  for (const lineItem of order.line_items) {
    const product = await prepare('SELECT id FROM products WHERE shopify_variant_id = ?').get(String(lineItem.variant_id));
    if (product) {
      items.push({ productId: product.id, qty: lineItem.quantity, unitPrice: Number(lineItem.price) });
    }
  }
  return items;
}

export async function matchRefundLineItemsToProducts(refund) {
  const items = [];
  for (const refundLineItem of refund.refund_line_items || []) {
    const variantId = refundLineItem.line_item?.variant_id;
    if (!variantId) continue;
    const product = await prepare('SELECT * FROM products WHERE shopify_variant_id = ?').get(String(variantId));
    if (product) items.push({ product, qty: refundLineItem.quantity });
  }
  return items;
}

export async function claimShopifyEvent(shopifyEventId, kind) {
  const result = await prepare(
    `INSERT INTO shopify_processed_events (shopify_order_id, kind) VALUES (?, ?)
     ON CONFLICT (shop_id, shopify_order_id, kind) DO NOTHING`
  ).run(String(shopifyEventId), kind);
  return result.changes > 0;
}

export async function markShopifyEventError(shopifyEventId, kind, errorMessage) {
  await prepare(
    'UPDATE shopify_processed_events SET status = ?, error_message = ? WHERE shopify_order_id = ? AND kind = ?'
  ).run('error', errorMessage, String(shopifyEventId), kind);
}
