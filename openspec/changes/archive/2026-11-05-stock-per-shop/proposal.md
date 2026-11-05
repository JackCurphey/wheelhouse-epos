## Why

Release 2 rule 3 and stock control decision 8 have stock belonging to a shop, and a product's page showing its stock at each shop. Today a product has one figure, a new business has no shop at all, and older stock lines say no shop. WP-1.5, piece 3 (`openspec/changes/wp-1-5-products/`). Transfers, the restock list and the shop switcher start from this.

## What Changes

- Every business has a first shop: a new one when it signs up, an existing one with none when this goes out. It is named after the business, with its first letter as its code.
- Each product's stock is held per shop, in a new table, `product_stock`. `products.stock_qty` stays as the business's total, so the old till, Shopify, reports and the below-zero warning read what they read today. Only `moveStock` writes either figure, so they can't drift.
- Existing stock goes to the business's oldest shop. Older stock lines get their shop: a till sale's line the till's shop, any other the oldest.
- A count belongs to the shop it was started at: what's expected, what's allowed for, Apply and Undo are all that shop's.
- Adjust stock works on this shop's figure, and can't take this shop below zero whatever another shop holds.
- A product's page shows its stock at each shop (`tr-sites`' lines, not the send or "on its way").
- Till setup shows the first shop as drawn; "This business has no shops" goes.

## Out of scope

The shop switcher and a session's chosen shop (WP-1.4, WP-5.2); Add a shop and renaming a shop (`ms-sites`, `ms-add-shop`); sending stock between shops (`tr-send`, `tr-incoming`); low-stock levels per shop; the stock list and Today by shop. Step C and the till deposit, roles and the settings store (Mark's). The Citrus import's other-store rows stay as they are: design 8.

## Who and risk

WP-1.5, piece 3, Jack's side. Risky: **migrations** (117, 118), **money and stock**, and **sign-in** (`createShop`).

## Follows

- Decisions: `docs/decisions/2026-10-01-stock-control-review.md` 3, 5, 6, 8 and its 3 Oct later change; `docs/decisions/2026-10-01-multiple-sites-review.md` 2, 7, 9; `docs/decisions/2026-10-05-shops-and-sites.md`; `docs/decisions/2026-10-18-shop-details.md`; `docs/decisions/2026-11-04-answers.md` answers 6 to 8.
- Specs: `docs/superpowers/specs/2026-10-05-wp-1-4-shops-and-sites.md` §2, §3, §4, §5; `openspec/changes/wp-1-5-products/design.md` section 4.
- Drawings: `tr-sites`, `st-product`, `st-adjust`, `till-setup`, `till-setup-workshop`, `ms-add-shop` (the code "suggested from the name").

## Capabilities

### New Capabilities

### Modified Capabilities
- `stock`: stock at each shop; a first shop; older lines' shop.
- `stock-take`: a count belongs to one shop.

## Impact

Migrations 117 and 118; `server/lib/stock.js`, `server/lib/first-site.js`, `server/auth.js`, `server/lib/stock-take-differences.js`, `server/routes/stock-takes.js`, `server/routes/products.js`; `src/screens/stock/`, `src/screens/till/`. Two stacked pull requests: the data and `moveStock`, then the count, Adjust and the screens.
