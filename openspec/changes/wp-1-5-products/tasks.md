# The pieces, in order

Each is its own OpenSpec change and pull request of 250 to 600 changed lines, reported and reviewed before the next starts.

- [x] 1. `products-in-pence`: price and cost in whole pence beside the pounds; proven exact on awkward values; saved in pence; Stock and labels read pence. *Keeps:* "prices shown, not edited until products move to pence" (the server half). Migration 114.
- [x] 2. `stock-movements-say-who`: `moveStock`, the one place stock changes; every writer through it (sales, till sync, adjust, stock take and its Undo, receiving, Shopify refund, import, add a product, catalogue import); who, why, shop and cause on each line. Lock limits and id order in one place. Two pull requests. *Settled here:* `login_id` naming the sign-in. *Elsewhere:* the old order route's request key (remove that old screen, rule 5).
- [x] 3. `stock-per-shop`: A first site for every business, older stock lines' shop, `product_stock`, existing stock to the oldest site, the till and workshop computer's own site; a product's page gets stock at each shop (`tr-sites`' line, not the send). *Keeps:* the import's "one stock figure until WP-1.4".
- [x] 4. `category-tree`: tree and details, built from existing text; Settings › Stockroom › Categories' server.
- [x] 5. `sizes-and-colours`: groups, size and colour, its own barcode, the grouped list and the search. Each size stays its own product behind the scenes, joined in a group (Jack, 4 Nov, answer 5). *Keeps:* stock take "sizes and colours on a line".
- [x] 6. `product-editing`: add and edit a product's server: pence, category, its details and sizes, request keys, cost rules; a product's answers; search and filter by measurement with checked query plans. *Keeps:* "a product's cost isn't edited until WP-1.5". Raises the restock list's supplier question.
- [ ] 7. `citrus-import-sizes`: re-read a file's Matrix Lookup Code and link the per-code products into groups, moving no stock. *Keeps:* "the file can be read again then". Depends on what a real file's size and colour columns turn out to be: only made-up files have been read so far. **Waits** (Jack, 6 Nov, `docs/decisions/2026-11-04-answers.md` answer 11): until he has seen a real export with the Matrix Dimension columns; the product screens (pieces 8 to 10) come first, and Citrus Lime products stay one product per size until then.
- [x] 8. `categories-screens` (WP-2.1): `st-categories`, `st-category-edit`. *Keeps:* "left out until WP-1.5". Built (`openspec/changes/categories-screens`).
- [ ] 9. `stock-list-categories-sizes` (WP-2.1): the Category pill, detail columns and filters (`st-filter-bearings`, `st-search-measure`), "[n] sizes · [n] colours", `st-search-size`.
- [ ] 10. `product-page-sizes` (WP-2.1): `st-product-sizes`, Edit, `rs-add-product` redrawn with details; "Cost went up? Change it" on a delivery.

Long pieces may split again where they pass 600 lines. Change prices in bulk, transfers and the restock list stay with their own work packages; they start from this.
