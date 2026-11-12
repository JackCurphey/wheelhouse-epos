// The shop's website and its Shopify connection: /api/storefront-settings
// (with the logo and hero image uploads, which share readUploadedImage in
// server/lib/uploads.js) and /api/shopify/connection.
// Staff routes: they run under the dispatcher's /api/ branch (server.js), so
// a handler gets (req, res, params, query, afterRelease, shopId) with the
// shop's row-level security already bound, and needs a staff session.
// Moved out of server.js unchanged (split plan §4.1, WP-0.4).
import { badRequest, readJsonBody, sendJson, ValidationError } from '../lib/http.js';
import { ownerOnly } from '../lib/owner-only.js';
import { readUploadedImage, uploadedImageBody } from '../lib/uploads.js';
import { getShopifyConnection, registerShopifyWebhooks, saveShopifyConnection, serializeShopifyConnection } from '../shopify.js';
import { getOrCreateStorefrontSettings, serializeStorefrontSettings, updateStorefrontSettings } from '../storefront.js';
import { currentSession } from '../lib/session.js';
import {
  WebsiteError, discard, history, historyVersion, ownerNames, publish, restore, saveColour, saveLogo, savePart, setUp, savePartPhoto, turnOff, turnOn, websiteInUse, websiteState,
} from '../website.js';

// Public-storefront on/off switch plus its branding fields (tagline,
// description, logo/hero images, theme preset) - same singleton-per-shop,
// lazy-create-on-GET pattern as shop_theme (server/routes/shop-settings.js).
// Persistence and validation live in storefront.js (Task 3); these two routes
// are thin HTTP glue over it, same shape as the shop-theme pair there.

// Per-shop connection to a Shopify store via a custom-app Admin API token
// (Task 3, shopify.js). These two routes are thin HTTP glue over
// getShopifyConnection/saveShopifyConnection - same shape as the
// storefront-settings pair above.

const MAX_SHOP_IMAGE_BYTES = 5 * 1024 * 1024;

// The new Website page (openspec/changes/website-management, design 2). Owner
// only, as all Settings until roles (Jack, 19 Oct). Reading it is owner only
// too: anyone else is told which Owners can (ws-no-access).
const WEBSITE_REFUSED = "Only the shop's owner can change the website";

// Answers with the Website page's state, or the refusal a WebsiteError carries.
async function answer(res, fn) {
  try {
    sendJson(res, 200, await fn());
  } catch (err) {
    if (err instanceof WebsiteError) return sendJson(res, err.status, { error: err.message });
    if (err instanceof ValidationError) return badRequest(res, err.message);
    throw err;
  }
}
const loginId = async (req) => (await currentSession(req)).login.id;

// The old Settings screen's words, photos and switch, refused once the
// Website page is in use (decided while building, 12 Nov).
const USE_WEBSITE_PAGE = 'The website is now changed on the Website page.';

function registerWebsite(route) {
  route('GET', '/api/website', async (req, res, params, query, afterRelease, shopId) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    if (!ctx.login.is_owner) {
      return sendJson(res, 403, { error: WEBSITE_REFUSED, code: 'owner_only', owners: await ownerNames(shopId) });
    }
    sendJson(res, 200, await websiteState());
  });
  route('PUT', '/api/website/parts/:key', async (req, res, params) => {
    if (await ownerOnly(req, res, WEBSITE_REFUSED)) return;
    await answer(res, async () => savePart(params.key, await readJsonBody(req), await loginId(req)));
  });
  route('POST', '/api/website/parts/:key/photo', async (req, res, params) => {
    if (await ownerOnly(req, res, WEBSITE_REFUSED)) return;
    await answer(res, async () => savePartPhoto(params.key, await readUploadedImage(req, MAX_SHOP_IMAGE_BYTES), await loginId(req)));
  }, uploadedImageBody(MAX_SHOP_IMAGE_BYTES));
  route('POST', '/api/website/logo', async (req, res) => {
    if (await ownerOnly(req, res, WEBSITE_REFUSED)) return;
    await answer(res, async () => saveLogo(await readUploadedImage(req, MAX_SHOP_IMAGE_BYTES), await loginId(req)));
  }, uploadedImageBody(MAX_SHOP_IMAGE_BYTES));
  route('POST', '/api/website/set-up', async (req, res) => {
    if (await ownerOnly(req, res, WEBSITE_REFUSED)) return;
    await answer(res, async () => setUp(await readJsonBody(req), await loginId(req)));
  });
  route('PUT', '/api/website/colour', async (req, res) => {
    if (await ownerOnly(req, res, WEBSITE_REFUSED)) return;
    await answer(res, async () => saveColour((await readJsonBody(req))?.colour, await loginId(req)));
  });
  route('POST', '/api/website/publish', async (req, res) => {
    if (await ownerOnly(req, res, WEBSITE_REFUSED)) return;
    await answer(res, async () => publish(await loginId(req)));
  });
  route('POST', '/api/website/discard', async (req, res) => {
    if (await ownerOnly(req, res, WEBSITE_REFUSED)) return;
    await answer(res, async () => discard(await loginId(req)));
  });
  route('POST', '/api/website/turn-on', async (req, res) => {
    if (await ownerOnly(req, res, WEBSITE_REFUSED)) return;
    await answer(res, async () => turnOn(await loginId(req)));
  });
  route('POST', '/api/website/turn-off', async (req, res) => {
    if (await ownerOnly(req, res, WEBSITE_REFUSED)) return;
    await answer(res, () => turnOff());
  });
  route('GET', '/api/website/history', async (req, res) => {
    if (await ownerOnly(req, res, WEBSITE_REFUSED)) return;
    await answer(res, () => history());
  });
  route('GET', '/api/website/history/:id', async (req, res, params) => {
    if (await ownerOnly(req, res, WEBSITE_REFUSED)) return;
    await answer(res, () => historyVersion(Number(params.id)));
  });
  route('POST', '/api/website/history/:id/restore', async (req, res, params) => {
    if (await ownerOnly(req, res, WEBSITE_REFUSED)) return;
    await answer(res, async () => restore(Number(params.id), await loginId(req)));
  });
}

export function register(route) {
  registerWebsite(route);
  route('GET', '/api/storefront-settings', async (req, res) => {
    sendJson(res, 200, serializeStorefrontSettings(await getOrCreateStorefrontSettings()));
  });

  route('PUT', '/api/storefront-settings', async (req, res) => {
    // Owner only, as all Settings until roles (Jack, 22 Oct; Mark's audit P2 1).
    if (await ownerOnly(req, res)) return;
    const body = await readJsonBody(req);
    // Only the theme is still set here once the Website page is in use.
    if (Object.keys(body || {}).some((k) => k !== 'themePreset') && await websiteInUse()) {
      return sendJson(res, 409, { error: USE_WEBSITE_PAGE, code: 'use_website_page' });
    }
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

  // The hosted test copy never connects a real online shop (add-hosted-copy
  // design §5), so it refuses before reading anything and saves nothing.
  route('POST', '/api/shopify/connection', async (req, res) => {
    // Owner only, as all Settings until roles (Jack, 22 Oct; Mark's audit P2 1).
    if (await ownerOnly(req, res)) return;
    if (process.env.WHEELHOUSE_HOSTED_COPY === '1') {
      return sendJson(res, 403, { error: 'This is a test copy of Wheelhouse: connecting Shopify is switched off.' });
    }
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

  route('POST', '/api/storefront-settings/logo', async (req, res) => {
    // Owner only, as all Settings until roles (Jack, 22 Oct; Mark's audit P2 1).
    if (await ownerOnly(req, res)) return;
    if (await websiteInUse()) return sendJson(res, 409, { error: USE_WEBSITE_PAGE, code: 'use_website_page' });
    let logoUrl;
    try {
      logoUrl = await readUploadedImage(req, MAX_SHOP_IMAGE_BYTES);
    } catch (err) {
      if (err instanceof ValidationError) return badRequest(res, err.message);
      throw err;
    }
    sendJson(res, 200, serializeStorefrontSettings(await updateStorefrontSettings({ logoUrl })));
  }, uploadedImageBody(MAX_SHOP_IMAGE_BYTES));

  route('POST', '/api/storefront-settings/hero', async (req, res) => {
    // Owner only, as all Settings until roles (Jack, 22 Oct; Mark's audit P2 1).
    if (await ownerOnly(req, res)) return;
    if (await websiteInUse()) return sendJson(res, 409, { error: USE_WEBSITE_PAGE, code: 'use_website_page' });
    let heroImageUrl;
    try {
      heroImageUrl = await readUploadedImage(req, MAX_SHOP_IMAGE_BYTES);
    } catch (err) {
      if (err instanceof ValidationError) return badRequest(res, err.message);
      throw err;
    }
    sendJson(res, 200, serializeStorefrontSettings(await updateStorefrontSettings({ heroImageUrl })));
  }, uploadedImageBody(MAX_SHOP_IMAGE_BYTES));
}
