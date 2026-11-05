## Why

Stock control decision 10 has each category hold its own details (a number with a unit, a choice from a list, or text), categories sitting inside others and inheriting their details, set in Settings › Stockroom › Categories. Today a product's category is free text, with "Drivetrain › Derailleurs" written by the Citrus import as a path. WP-1.5, piece 4 (`openspec/changes/wp-1-5-products/`, design 6): the tree, its details and the server behind `st-categories` and `st-category-edit`. The screens are piece 8; a product's answers and searching by them are piece 6.

## What Changes

- Three tables: `product_categories` (the tree), `category_details` (each category's own details), `product_details` (a product's answers; nothing writes them until piece 6).
- The tree is built from the text products already have, a business at a time, by splitting on "›". "Uncategorised" isn't a category.
- A product's text category stays, for every old reader, and is the link: it's always a category's whole path. Wherever a product's category is written, the categories in its path are found or made.
- The Settings server: list the tree with each category's own details and how many products answer each; add a category; save a category's name, where it sits, and its own details, as the edit box does. Renaming or moving a category rewrites its products' text, and a count running on it follows.
- From piece 3's re-check: design 5's wording on `(id, shop_id)` corrected; two items for the switcher's list.

## Out of scope

The Categories screens (piece 8), a product's answers and Edit (piece 6), filtering and search by a detail (pieces 6 and 9), deleting a category (not drawn), the restock list's supplier question (piece 6). Roles: Owner only until "Can order stock" (Mark's WP-1.1).

## Who and risk

WP-1.5, piece 4, Jack's side. Risky: **migrations** (119). It writes `products.category`, never stock.

## Follows

- Decisions: `docs/decisions/2026-10-01-stock-control-review.md` 2, 10, 11 and the 5 Oct later change; `docs/decisions/2026-11-04-answers.md` answer 5 (sizes stay products, piece 5).
- Specs: `openspec/changes/wp-1-5-products/design.md` section 6.
- Drawings: `st-categories`, `st-category-edit`, `st-filter-bearings`, `st-filter-derailleurs`, `st-product` (Details · [Category]).

## Capabilities

### New Capabilities

### Modified Capabilities
- `stock`: categories in a tree, each with its own details.

## Impact

Migration 119; new `server/lib/categories.js`, `server/routes/product-categories.js`; `server/routes/products.js`, `suppliers.js`, `server/move/bring-across.js`, `server/routes/index.js`.
