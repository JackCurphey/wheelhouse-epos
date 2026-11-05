# WP-1.5: the choices that run through every piece

## 1. What is already built, and who reads it

`products` holds a price and cost in pounds and one `stock_qty`. Every sold, ordered, received, counted and used line points at `products.id`: `sale_items`, `till_sale_lines`, `sale_document_items`, `purchase_order_items`, `delivery_lines`, `delivery_problems`, `stock_take_counts`, `stock_movements`, workshop parts, Shopify's `shopify_variant_id`. The old till (`public/app.js`, `server/lib/sales.js`) and the new till's snapshot and sync read that same row. Step C isn't built, so all of this has to keep working unchanged.

## 2. Pence (piece 1)

`price_pence` and `cost_pence` are columns the database works out from the pounds, so the two can never disagree, whichever old or new code wrote the row. A later change drops the pounds when the old app has gone. Detail in `products-in-pence`.

## 3. Sizes and colours: each size and colour stays a row in `products` (piece 5)

**Jack's decision, 4 Nov** (`docs/decisions/2026-11-04-answers.md`, answer 5: option 1).

- New table `product_groups`: the one product people see (name, category, photo, description). New columns on `products`: `group_id`, `size`, `colour`.
- Each size and colour is a `products` row, with its own barcode (rule 3), code, price, cost and stock. A product with no sizes has no group, exactly as today.
- On screen it is one product (decision 4): one row on the stock list with its total and "[n] sizes · [n] colours", a grid on its page. The Stock list and search group by `group_id`; scanning a barcode or searching "jersey M" lands on that row.

Why: every line table in section 1 keeps working without a new column, the old till sells a size by scanning it with no change, and the Citrus import's per-code products need only linking, not moving. The other way, a new `product_variants` table with a `variant_id` on every line table, touches about ten tables and the old till, and gives every product a pretend "default" variant.

The trade-off: the old app's Inventory and the old till's search list each size as its own line until they are retired, and `products` then means "something you can sell".

Decision 4 chose "one product, with a grid" over "each size as its own product". This keeps that on every new screen; the row-per-size is underneath, and Jack accepted the old stock list and old till search showing each size separately until they're retired.

## 4. Stock per shop (pieces 2 and 3)

- Rule 3 and the WP-1.4 spec: stock counts and movements belong to a site. WP-1.4 isn't built: a new business has no site (`decided-while-building.md`, line 1244), and only tills and workshop computers know theirs. These pieces build the narrow part stock needs: `stock_movements.site_id` (piece 2); every business gets a first site, and older lines their shop (piece 3). The shop switcher and the session's chosen site stay with WP-1.4 and WP-5.2.
- New table `product_stock (shop_id, site_id, product_id, qty)`, one row per product per site. `products.stock_qty` stays, as the total the old till and every old read use. Nothing writes either figure except one function, `moveStock`, so they can't drift. A test fails if `stock_qty` is written anywhere else.
- Which site a change is for: a till or workshop computer's own; otherwise the business's oldest site until the session has a chosen one. Existing stock goes to the oldest site (WP-1.4 spec §4, proposed there).

## 5. Every movement: who, why, shop and cause (piece 2)

`stock_movements` already has `login_id`, `reason`, `note` and some links (`purchase_order_id`, `stock_take_id`, `till_sale_id`). It gains `employee_id` (the person checked in), `site_id`, and links for what's missing (`sale_id`, a delivery, a job). Who: `currentCheckin(req)`; on a till or workshop computer with nobody checked in, the new stock routes refuse, as the take-a-payment routes do. Old lines keep what they have and show no name they never recorded.

`moveStock` takes locks in product id order, in the caller's transaction, with `stock_qty + n`, and a lock limit: a stuck row answers 503 busy, rather than holding a connection (the import's pattern).

## 6. Categories and their details (pieces 4 and 6)

- `product_categories` (tree by `parent_id`), `category_details` (name, kind: number with a unit, a choice from a list, or text; choices or unit), `product_details` (a product's answers). Inherited details are read up the tree.
- `products.category_id` beside the text `category`, which stays for old readers and is written from the path ("Drivetrain › Derailleurs", as the Citrus import already writes it). The migration builds the tree from existing text, a shop at a time.
- Search by measurement ("bearing 30 mm") must use an index under row-level security: a plain numeric column compared with `=`, as migration 113's key columns, with query plans checked on a large made-up table.

## 7. Things settled by this split, for later pieces to hold to

- **Screens are WP-2.1's in the build plan** ("Screens: none of its own" under WP-1.5), but the "until WP-1.5" promises in `decided-while-building.md` are kept by them, so they are in the order below.
- **Restock list:** the five details in the 27 Oct answer 2 are Jack's and stay open. Only "matching a product's supplier name to a supplier" touches this data; piece 6 raises it.
- **Costs:** `canSeeCosts` guards every new field that holds a cost.
- **Purchase order and supplier catalogue pounds** (`unit_cost`, catalogue `price`) aren't part of this: the sales-in-pence design leaves them with purchase orders, later.
