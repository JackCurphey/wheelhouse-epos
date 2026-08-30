# Per-Shop Digital Storefronts — Design

## Purpose

Give each bike shop using Wheelhouse EPOS a public-facing website — reachable at
`<shop-slug>.wheelhouseepos.com` — showing their branding, a curated product
catalog, and a link into the existing workshop-booking portal. This is the
first of two planned sub-projects; a later, separate project will connect
storefront products to Shopify for actual checkout, and another later project
will add shop-owned custom domains. Neither is designed here — this spec
deliberately stops at the framework that makes both easy to add afterward.

## Non-goals (for this phase)

- No checkout, cart, or payment processing (that's the future Shopify project).
- No shop-owned custom domains (subdomain only, for now).
- No custom CSS/layout editing or fonts — theming is limited to the 5 existing
  color presets plus logo/hero image/text fields.

## Data model

Two additions to the existing Postgres schema, following the established
`shop_id`-scoped, row-level-security pattern used throughout the app.

### `storefront_settings` (new table, 1:1 with `shops`)

| column | type | notes |
|---|---|---|
| `shop_id` | fk → `shops.id` | primary key |
| `enabled` | boolean | default `false` — storefront is opt-in |
| `tagline` | text | nullable |
| `description` | text | nullable |
| `logo_url` | text | nullable |
| `hero_image_url` | text | nullable |
| `theme_preset` | text | one of the existing 5 presets (forest/ocean/sunset/slate/plum) used by `shop_theme` |

Created lazily (upsert) the first time an owner opens storefront settings, or
via a migration default row per existing shop with `enabled = false`.

RLS policy: same pattern as other shop-scoped tables — scoped to
`current_setting('app.current_shop_id')`.

### `products.show_online` (new column)

`boolean`, default `false`. Per-product opt-in for public visibility, editable
from the existing inventory UI. Nothing appears on a storefront until an owner
explicitly flips this for a product.

## Routing & tenant resolution

- **DNS/TLS**: one wildcard DNS record (`*.wheelhouseepos.com`) and one
  wildcard TLS certificate covering all shops. One-time infra setup,
  independent of shop count.
- **Gateway**: `server/gateway.js` proxies to the app; verify during
  implementation that it passes the `Host` header through unmodified (typical
  reverse-proxy default — likely no change needed, but confirm).
- **Tenant-resolution middleware** (new, in the main app): on each incoming
  request, extract the subdomain, look up the shop by `slug`:
  - Unknown slug, or known slug with `storefront_settings.enabled = false` →
    a generic "storefront not found" page. Never leak whether a slug exists
    vs. is just disabled.
  - Known + enabled → resolve `shop_id`, enter `runWithShop()` (the existing
    `AsyncLocalStorage` context used for RLS), continue to the storefront
    routes.
- **Path-based fallback**: also serve the storefront at `/store/:slug` for
  local development, where wildcard subdomains aren't practical.

This reuses the existing tenant-resolution mechanism (`runWithShop`/RLS)
end-to-end — the only new logic is resolving `shop_id` from a hostname
instead of from an authenticated session.

## Public API (`server/storefront.js`, new file)

Unauthenticated, read-only, scoped to the `shop_id` resolved by the
middleware above:

- `GET /api/storefront/info` → shop name, tagline, description, logo/hero
  URLs, theme preset.
- `GET /api/storefront/products` → products where `show_online = true`
  (name, price, photo, description). No cost, supplier, stock-level, or other
  internal fields.

No write endpoints. No customer PII is read or written by this API.

## Storefront frontend (`public-storefront/`, new)

A static HTML/CSS/JS bundle, structured the same way as the existing
`public-portal/` (booking portal): plain HTML + CSS + vanilla JS, no build
step. Fetches from the two endpoints above and renders:

- Header: logo, shop name, tagline.
- Hero: hero image + description, colored via the shop's `theme_preset`
  using the same CSS-custom-property mechanism already implemented in
  `applyShopTheme()` (`public/app.js`) — not a new theming implementation,
  just applied to a new page.
- Product grid: photo, name, price, description. No buy button — a plain
  "Available in store" label (or equivalent) until the Shopify project adds
  one.
- Footer: shop hours/location (if available on the `shops` record) and a
  link into the existing `/book/:slug` workshop-booking portal.

## Owner-facing configuration

Extend the existing shop admin/settings screen (no new admin app) with:

- Storefront enabled/disabled toggle.
- Tagline, description text fields.
- Theme preset picker (reuses the existing preset selector UI/values from
  `shop_theme`).
- Logo and hero image upload.
- Per-product "show online" toggle, added to the existing inventory edit UI.

## Error handling

- Middleware treats "slug not found" and "slug found but disabled" identically
  from the visitor's perspective (generic not-found page) to avoid leaking
  which shops exist but haven't enabled a storefront.
- Public API endpoints 404 if the resolved shop has no `storefront_settings`
  row or `enabled = false`, even if reached directly.
- Image upload fields (logo/hero) need basic size/type validation, consistent
  with any existing upload handling in the app (check for a precedent during
  implementation; if none exists, keep this minimal — reasonable size cap and
  image-mimetype check only).

## Testing

- Middleware: valid+enabled slug, valid+disabled slug, unknown slug,
  path-based `/store/:slug` fallback — each resolves (or rejects) correctly.
- Public API: RLS scoping (shop A can never see shop B's data via these
  endpoints), `show_online` filtering excludes non-flagged products.
- Manual pass in-browser against a real seeded shop once built, checking
  theme application and booking-portal link.

## Future seams (explicitly deferred, not designed here)

- **Shopify checkout**: product cards gain a "Buy" affordance; products gain
  an optional `shopify_variant_id` mapping; checkout redirects to
  Shopify-hosted checkout or uses their Storefront API. This design's product
  grid component is not expected to need rearchitecting for this.
- **Custom domains**: `storefront_settings` gains a `custom_domain` column,
  a verification step (DNS TXT or CNAME check), and per-domain TLS
  (e.g. Let's Encrypt DNS-01 automation, or a service that handles this,
  such as Cloudflare for SaaS). The tenant-resolution middleware gains a
  second lookup path (by `custom_domain`, alongside `slug`) — no
  rearchitecture of routing needed.
- **Deeper theming**: custom colors beyond the 5 presets, fonts, layout
  blocks — additive to `storefront_settings` later.
