// The shop's website and its Shopify connection: /api/storefront-settings and /api/shopify/connection.
// Staff routes: they run under the dispatcher's /api/ branch (server.js), so
// a handler gets (req, res, params, query, afterRelease, shopId) with the
// shop's row-level security already bound, and needs a staff session.
// Moved out of server.js unchanged (split plan §4.1, WP-0.4).
import { badRequest, readJsonBody, sendJson } from '../lib/http.js';
import { getShopifyConnection, registerShopifyWebhooks, saveShopifyConnection, serializeShopifyConnection } from '../shopify.js';
import { getOrCreateStorefrontSettings, serializeStorefrontSettings, updateStorefrontSettings } from '../storefront.js';

// Public-storefront on/off switch plus its branding fields (tagline,
// description, logo/hero images, theme preset) - same singleton-per-shop,
// lazy-create-on-GET pattern as shop_theme (server/routes/shop-settings.js).
// Persistence and validation live in storefront.js (Task 3); these two routes
// are thin HTTP glue over it, same shape as the shop-theme pair there.

// Per-shop connection to a Shopify store via a custom-app Admin API token
// (Task 3, shopify.js). These two routes are thin HTTP glue over
// getShopifyConnection/saveShopifyConnection - same shape as the
// storefront-settings pair above.

export function register(route) {
  route('GET', '/api/storefront-settings', async (req, res) => {
    sendJson(res, 200, serializeStorefrontSettings(await getOrCreateStorefrontSettings()));
  });

  route('PUT', '/api/storefront-settings', async (req, res) => {
    const body = await readJsonBody(req);
    try {
      const updated = await updateStorefrontSettings(body);
      sendJson(res, 200, serializeStorefrontSettings(updated));
    } catch (err) {
      if (err.message.startsWith('Invalid theme preset')) return badRequest(res, err.message);
      throw err;
    }
  });

  route('GET', '/api/shopify/connection', async (req, res) => {
    sendJson(res, 200, serializeShopifyConnection(await getShopifyConnection()));
  });

  route('POST', '/api/shopify/connection', async (req, res) => {
    const body = await readJsonBody(req);
    const shopDomain = String(body.shopDomain || '').trim();
    const accessToken = String(body.accessToken || '').trim();
    const storefrontApiToken = String(body.storefrontApiToken || '').trim();
    if (!shopDomain || !accessToken || !storefrontApiToken) {
      return badRequest(res, 'shopDomain, accessToken, and storefrontApiToken are all required');
    }

    let connection;
    try {
      connection = await saveShopifyConnection({ shopDomain, accessToken, storefrontApiToken });
    } catch (err) {
      return badRequest(res, `Could not connect to Shopify: ${err.message}`);
    }

    try {
      await registerShopifyWebhooks(connection, connection.shop_id);
    } catch (err) {
      console.error('Failed to register Shopify webhooks', err);
      return sendJson(res, 200, {
        ...serializeShopifyConnection(connection),
        warning: 'Connected, but webhook registration failed - online orders will not sync back to stock until this is retried.',
      });
    }

    sendJson(res, 200, serializeShopifyConnection(connection));
  });
}
