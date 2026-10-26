# Proposal: the stock list and a product's page

## Why

Stockroom › Stock is a "Not built yet" placeholder in the staff app. Jack's
stock decisions 2 and 3 (`docs/decisions/2026-10-01-stock-control-review.md`)
say Stock opens on a searchable list with filters, and each product has a
page with its stock first and one history of what changed it. Slice C,
WP-2.1, Jack's lane, on the defaults decided on 26 Oct: build on today's
products (one `stock_qty`, prices in pounds, a text category), read only.

**Risky area:** money and stock (it reads `stock_qty` and prices). It
changes nothing: no migration, no write, and no change to how stock goes
down (Mark is rewriting till sync, `server/till/sync.js`). `/review` runs
before merging.

## What Changes

- **`GET /api/products/:id`** (new, read only): the product and its stock
  history (`stock_movements`), newest first. Cost is left out for anyone
  but the Owner.
- **`GET /api/products`**: its search also matches the supplier, and every
  product carries its VAT rate (`vatRateBp`), so margin is worked out on the
  price before VAT.
- **Stock, `/workshop/stock`** (`st-list`): one search box; All, Running
  low and Below zero; each product's name, code, category and supplier, its
  stock with Running low or Below zero, its price, and (Owner only) its
  margin; sortable headings; each row opens the product's page.
- **A product's page, `/workshop/stock/:id`** (`st-product`,
  `st-product-staff`, `st-product-bike`): back to Stock; its photo and
  codes; In stock with the low-stock level; Price and VAT (and for the
  Owner, Cost, Margin and Show on website); Stock history with Everything,
  Sold, Received, and Counted and adjusted.

## Drawings and decisions

- Drawings: `st-list`, `st-product`, `st-product-staff`, `st-product-bike`
  (`docs/design/user-journeys/generator/stock.mjs:59-200, 297-311`).
- Decisions: stock control 2, 3 and 11 ("Staff see no cost or margin");
  roles and switches (`2026-10-05-roles-and-switches.md`). Until roles are
  built only the Owner is told apart (`isOwner`), so "Owner" stands in for
  Owner and Manager.

## Out of scope

- Sizes and colours, the category tree with each category's details, and
  prices in pence: WP-1.5, Mark's server work (`st-product-sizes`,
  `st-categories`, `st-prices`). So no category pill, no detail columns and
  no Details box.
- Anything that changes stock or a product: Adjust stock (the next piece),
  Send to another shop, Edit, + Add a product, and the tick boxes and their
  bar. Prices are shown, not edited, until products move to pence.
- Bikes by frame number: nothing records a stock bike's frame numbers yet,
  so a bike's page is a product's page.
- **The old app's inventory screen** (`public/app.js`) stays in this piece;
  it goes once this merges (CLAUDE.md rule 5).

## Capabilities

### New Capabilities

- `stock`: the stock list and a product's page.
