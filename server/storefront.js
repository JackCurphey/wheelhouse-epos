import { prepare, pool, runWithShop } from './db.js';
import { getShopifyConnection } from './shopify.js';

export const THEME_PRESETS = ['forest', 'ocean', 'sunset', 'slate', 'plum'];

export function serializeStorefrontSettings(row) {
  return {
    enabled: !!row.enabled,
    tagline: row.tagline || '',
    description: row.description || '',
    logoUrl: row.logo_url || null,
    heroImageUrl: row.hero_image_url || null,
    themePreset: row.theme_preset,
    updatedAt: row.updated_at,
  };
}

export async function getOrCreateStorefrontSettings() {
  let row = await prepare('SELECT * FROM storefront_settings LIMIT 1').get();
  if (!row) {
    await prepare('INSERT INTO storefront_settings DEFAULT VALUES').run();
    row = await prepare('SELECT * FROM storefront_settings LIMIT 1').get();
  }
  return row;
}

export async function updateStorefrontSettings(patch) {
  const existing = await getOrCreateStorefrontSettings();

  if (patch.themePreset !== undefined && !THEME_PRESETS.includes(patch.themePreset)) {
    throw new Error(`Invalid theme preset: must be one of ${THEME_PRESETS.join(', ')}`);
  }

  const enabled = patch.enabled !== undefined ? Boolean(patch.enabled) : existing.enabled;
  const tagline = patch.tagline !== undefined ? String(patch.tagline) : existing.tagline;
  const description = patch.description !== undefined ? String(patch.description) : existing.description;
  const logoUrl = patch.logoUrl !== undefined ? (patch.logoUrl || null) : existing.logo_url;
  const heroImageUrl = patch.heroImageUrl !== undefined ? (patch.heroImageUrl || null) : existing.hero_image_url;
  const themePreset = patch.themePreset !== undefined ? patch.themePreset : existing.theme_preset;

  await prepare(
    `UPDATE storefront_settings
     SET enabled = ?, tagline = ?, description = ?, logo_url = ?, hero_image_url = ?, theme_preset = ?, updated_at = ?
     WHERE id = ?`
  ).run(enabled, tagline, description, logoUrl, heroImageUrl, themePreset, new Date().toISOString(), existing.id);

  return prepare('SELECT * FROM storefront_settings LIMIT 1').get();
}

export const STOREFRONT_BASE_DOMAIN = process.env.STOREFRONT_BASE_DOMAIN || 'wheelhouseepos.com';

// Subdomains of STOREFRONT_BASE_DOMAIN that must never be treated as a
// storefront slug lookup, even if no shop happens to be slugged that way.
// This is a safety net for common internal/infrastructure subdomains, not a
// configurable allowlist - see README.md for the deployment implications of
// putting the staff app (or any other internal service) on a bare subdomain
// of this same base domain.
const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'admin', 'staff']);

// Cheap, DB-free check for "does this request look like it's addressed to a
// storefront at all" - used by the dispatcher to decide between "not a
// storefront request, keep routing normally" and "was a storefront request,
// but didn't resolve to one - show a generic not-found page" (never fall
// through to the staff app for the latter, and never distinguish "unknown
// slug" from "disabled storefront" in the response).
export function parseStorefrontSlugCandidate(req, url) {
  const hostHeader = String(req.headers.host || '').split(':')[0].toLowerCase();
  const suffix = `.${STOREFRONT_BASE_DOMAIN}`;

  if (hostHeader.endsWith(suffix)) {
    const sub = hostHeader.slice(0, -suffix.length);
    if (sub && !RESERVED_SUBDOMAINS.has(sub)) return sub;
  }
  const pathMatch = url.pathname.match(/^\/store\/([^/]+)/);
  if (pathMatch) return pathMatch[1];

  return url.searchParams.get('storefrontSlug') || null;
}

export async function resolveStorefrontShop(req, url) {
  const slug = parseStorefrontSlugCandidate(req, url);
  if (!slug) return null;

  const { rows: [shop] } = await pool.query('SELECT id, slug, name FROM shops WHERE slug = $1', [slug]);
  if (!shop) return null;

  const enabled = await runWithShop(shop.id, async () => {
    const settings = await prepare('SELECT enabled FROM storefront_settings LIMIT 1').get();
    return settings?.enabled || false;
  });
  if (!enabled) return null;

  return { id: shop.id, slug: shop.slug, name: shop.name };
}

export async function getStorefrontInfo(shopRow) {
  const settings = await getOrCreateStorefrontSettings();
  const shopifyConnection = await getShopifyConnection();
  const shopifyConnected = shopifyConnection && shopifyConnection.status === 'connected';
  return {
    shopName: shopRow.name,
    tagline: settings.tagline || '',
    description: settings.description || '',
    logoUrl: settings.logo_url || null,
    heroImageUrl: settings.hero_image_url || null,
    themePreset: settings.theme_preset,
    shopifyDomain: shopifyConnected ? shopifyConnection.shop_domain : null,
    shopifyStorefrontToken: shopifyConnected ? shopifyConnection.storefront_api_token : null,
  };
}

export function serializeStorefrontProduct(row) {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    description: row.description || '',
    photoUrl: row.photo_url || null,
    shopifyVariantId: row.shopify_variant_id || null,
  };
}

export async function listStorefrontProducts() {
  const rows = await prepare(
    'SELECT id, name, price, description, photo_url, shopify_variant_id FROM products WHERE show_online = ? AND active = 1 ORDER BY category, name'
  ).all(true);
  return rows.map(serializeStorefrontProduct);
}
