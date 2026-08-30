# Per-Shop Digital Storefronts — Design

## Purpose

Give each bike shop using Wheelhouse EPOS a public-facing website — reachable at
`<shop-slug>.wheelhouseepos.com` — showing their branding, a curated product
catalog customers can actually buy from (via each shop's own Shopify store),
and a link into the existing workshop-booking portal. Shop-owned custom
domains and deeper theming remain a later, separate project — this spec
deliberately stops at the framework that makes those easy to add afterward.

## Non-goals (for this phase)

- No shop-owned custom domains (subdomain only, for now).
- No custom CSS/layout editing or fonts — theming is limited to the 5 existing
  color presets plus logo/hero image/text fields.
- No public OAuth "Install app" flow for Shopify — shops connect via a
  manually-generated custom-app access token (see below).
- No fully embedded payment UI — the final "pay now" step redirects to
  Shopify's own hosted checkout (see Checkout section). This is a platform
  constraint on non-Plus Shopify plans, not a scope cut.

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

### `products` — Shopify mapping columns (new)

`shopify_product_id`, `shopify_variant_id`, `shopify_inventory_item_id`
(all nullable text/bigint as appropriate). Populated once EPOS successfully
syncs a `show_online` product to the shop's connected Shopify store; null
means "not yet synced" (storefront shows "Coming soon", no Buy button).

### `shopify_connections` (new table, 1:1 with `shops`)

| column | type | notes |
|---|---|---|
| `shop_id` | fk → `shops.id` | primary key |
| `shop_domain` | text | e.g. `theirshop.myshopify.com` |
| `access_token` | text, encrypted at rest | Admin API token from a custom app the owner creates in their own Shopify admin |
| `storefront_api_token` | text | public Storefront API token, used client-side for cart/checkout |
| `webhook_secret` | text, encrypted at rest | used to verify inbound webhook HMAC signatures |
| `status` | text | `connected` / `sync_error` / `not_connected` |
| `connected_at` | timestamp | nullable |

RLS-scoped like other shop tables. A shop with no row here, or `status !=
connected`, simply shows no Buy buttons on its storefront — everything else
(catalog display, booking link) works independently of Shopify.

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
  (name, price, photo, description, `shopify_variant_id` if synced). No cost,
  supplier, stock-level, or other internal fields.

No write endpoints on this file. No customer PII is read or written here —
cart/checkout state lives entirely in Shopify (see Checkout section), and
order-completion data arrives via the separate webhook endpoint below.

## Shopify integration

### Connecting a shop

Each shop connects independently: the owner creates a **custom app** in
their own Shopify admin, generates an Admin API access token and a
Storefront API token, and pastes both (plus their `.myshopify.com` domain)
into EPOS storefront settings. EPOS stores them in `shopify_connections` and
registers the `orders/paid` and `refunds/create` webhooks against that store
via the Admin API, pointing at this app's webhook endpoint.

This avoids building and maintaining a public Shopify OAuth "Install app"
flow (which requires Partner app review for distribution) — appropriate
since this connects shops to your own platform, not a store other merchants
install from the Shopify App Store. Worth revisiting if manual token setup
proves too fiddly for non-technical shop owners.

### Product sync (EPOS → Shopify, push)

Whenever a product is flagged `show_online = true` (or edited/priced while
flagged, for a shop with `status = connected`), EPOS pushes a create/update
to Shopify's Admin API (product + variant + price) and stores the returned
`shopify_product_id`/`shopify_variant_id`/`shopify_inventory_item_id` back on
the product row. Un-flagging `show_online` unpublishes (not deletes) the
Shopify product, preserving any existing order history references to it.

### Stock sync (two-way)

- **EPOS → Shopify**: any EPOS stock change on a synced product (till sale,
  restock, manual adjustment) pushes the new available quantity to Shopify's
  `InventoryLevel` API for that `shopify_inventory_item_id`.
- **Shopify → EPOS**: the `orders/paid` webhook (`POST
  /webhooks/shopify/:shop_id/orders`) deducts EPOS stock per line item and
  records the sale in sales history tagged `channel = shopify`, so it appears
  in existing dashboards/reports alongside till sales.
- **Refunds/cancellations**: the `refunds/create` webhook restocks the
  corresponding quantity automatically.
- All webhook handlers verify the request's HMAC signature against
  `webhook_secret` and are idempotent by Shopify order/refund ID (Shopify
  retries delivery on failure or timeout).

### Checkout

Product browsing and cart are built natively into the storefront frontend
using Shopify's **Storefront API** (GraphQL) — add-to-cart, quantities, and
a cart view all styled with the shop's own theme, no Shopify branding
visible during browsing. Only the final "Pay now" action redirects to the
cart's `checkoutUrl`, Shopify's own hosted checkout page, to collect payment.

This is a deliberate constraint, not a shortcut: fully embedded card-entry
UI (never leaving the page) requires Shopify Plus's checkout extensibility,
unavailable on standard plans. Redirecting only for the payment step is the
standard, lowest-risk pattern for headless Shopify integrations — Shopify
still handles all PCI compliance, and it's a small expected hop rather than
a jarring context switch.

Product cards only show a "Buy" affordance once `shopify_variant_id` is
populated; a `show_online` product without a confirmed sync shows
"Coming soon" instead.

## Storefront frontend (`public-storefront/`, new)

A static HTML/CSS/JS bundle, structured the same way as the existing
`public-portal/` (booking portal): plain HTML + CSS + vanilla JS, no build
step. Fetches from the two endpoints above and renders:

- Header: logo, shop name, tagline.
- Hero: hero image + description, colored via the shop's `theme_preset`
  using the same CSS-custom-property mechanism already implemented in
  `applyShopTheme()` (`public/app.js`) — not a new theming implementation,
  just applied to a new page.
- Product grid: photo, name, price, description, and — for products with a
  confirmed Shopify sync — a "Buy" affordance backed by the Storefront-API
  cart described above; unsynced `show_online` products show "Coming soon".
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
- Shopify connection fields (store domain, Admin API token, Storefront API
  token) and a connection status indicator (connected / sync error / not
  connected).

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
- Shopify sync failures (rate limits, API errors) retry with backoff and set
  `shopify_connections.status = sync_error`, surfaced visibly in shop
  settings rather than failing silently.
- Webhook requests with an invalid HMAC signature are rejected (401) and
  logged; webhook handlers are idempotent by Shopify order/refund ID.

## Testing

- Middleware: valid+enabled slug, valid+disabled slug, unknown slug,
  path-based `/store/:slug` fallback — each resolves (or rejects) correctly.
- Public API: RLS scoping (shop A can never see shop B's data via these
  endpoints), `show_online` filtering excludes non-flagged products.
- Manual pass in-browser against a real seeded shop once built, checking
  theme application and booking-portal link.
- Shopify: unit tests for HMAC webhook verification; mocked-Shopify-API tests
  for product/inventory push; idempotency test for duplicate webhook
  delivery (order and refund); a manual end-to-end pass against a real
  Shopify dev store — buy a test item with Shopify's bogus payment gateway,
  confirm EPOS stock drops and the sale appears in history tagged
  `channel = shopify`; refund it, confirm stock is restored.

## Future seams (explicitly deferred, not designed here)

- **Custom domains**: `storefront_settings` gains a `custom_domain` column,
  a verification step (DNS TXT or CNAME check), and per-domain TLS
  (e.g. Let's Encrypt DNS-01 automation, or a service that handles this,
  such as Cloudflare for SaaS). The tenant-resolution middleware gains a
  second lookup path (by `custom_domain`, alongside `slug`) — no
  rearchitecture of routing needed.
- **Deeper theming**: custom colors beyond the 5 presets, fonts, layout
  blocks — additive to `storefront_settings` later.
