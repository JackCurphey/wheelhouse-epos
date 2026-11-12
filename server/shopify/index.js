// The Shopify adapter (openspec/changes/website-management design 7): what the
// server calls to connect a shop's own Shopify shop, list what is in it and
// send it a product. Until a real Shopify app exists the only one is the
// pretend Shopify, and only when asked for with SHOPIFY_PROVIDER=pretend (the
// tests, and a developer's .env): left out, there is none. The older
// token-based sync in server/shopify.js is separate and unchanged.
import { pretendShopify } from './pretend.js';

const PROVIDERS = { pretend: pretendShopify };

export function shopify() {
  return PROVIDERS[process.env.SHOPIFY_PROVIDER] ?? null;
}

/** What the Owner typed, as Shopify's address: no https://, slash or capitals. */
export function cleanAddress(typed) {
  return String(typed).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
}
