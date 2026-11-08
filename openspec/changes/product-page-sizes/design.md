# Design

## 1. Price and cost changes (migration 122; decisions 7 and 11; walk-through 3 M3)

`product_price_changes`: `id`, `shop_id` (the business's own rows, as 120's tables), `product_id` with `(product_id, shop_id)` referencing `products (id, shop_id)`, `field` (`price` or `cost`), `was_pence` and `now_pence` (whole pence, never below nothing), `login_id`, `who_name` (kept if the person is later removed, as a stock line's), `delivery_id` (the delivery, for Cost went up), `created_at`. Indexed `(shop_id, product_id, created_at DESC)`. Additive, safe to run twice.

`server/lib/price-changes.js` `recordPriceChanges(before, after, who, { deliveryId })` writes one row for each of price and cost that changed, inside the caller's transaction, after the row is written. Called by `PUT /api/products/:id`, by `PUT /api/product-groups/:id` for each size whose price or cost changed, and by Cost went up. Adding a product writes none: its first price is no change. Bulk price changes (`st-prices`) will call the same.

**Who sees them:** `GET /api/products/:id` and `GET /api/product-groups/:id` add them to `history` as `{ id: 'p[id]', type: 'price_change', field, was, now, who, at, delivery }` only for someone who `canSeeCosts`, merged newest first with the stock lines, the newest 200 of each. `st-product-staff` draws Jo's history without the price change line, and a cost change is a cost. The "Price changes" pill shows only when the history has one.

## 2. The product box (`product-box.tsx`; `rs-add-product`'s fields; decision 10)

One box adds a product and edits one. Fields, as `rs-add-product` draws them: Name and Supplier code; Cost, Price, Low-stock level; then Category, picked by searching (piece 9's picker), and "[Category] details", its details and those passed down, each a number box with its unit, a choice, or text. Not drawn but on a product: Barcode (with the code) and Supplier (with the name), so Edit can change everything the page shows.

- **Money** is typed in pounds and sent as whole pence (`pricePence`, `costPence`), checked on screen first: a price from £0.00 to £21,474,836.47, a cost blank or a number of pounds. A blank cost on Edit leaves the cost as it is (the server's rule).
- **Saving:** a product's save (`PUT /api/products/:id`, or `POST /api/products`), then its details (`PUT /api/products/:id/details`) when any were typed or changed. The details are saved after the category, so a changed category's details apply. The server's words show in the box; nothing closes until both are saved.
- **Edit** is the Owner's, as drawn (`STAFF ? ''`); the summary's Edit opens the box at Name, the Details box's Edit at the details.

## 3. A product with sizes' page (`sizes-page.tsx`; decision 4)

Route `/workshop/stock/sizes/:id`, from the list's row. `GET /api/product-groups/:id` gains `stockAtShops` (each shop's total of its sizes), `history` (its sizes' stock lines with each line's size and colour, the newest 200, and its price changes for the Owner) and `vatRateBp` when its sizes share one.

- **Left:** codes "[Category] · [n] sizes · [n] colours" and Edit (the Owner's: Name and Category, `PUT /api/product-groups/:id`); In stock at each shop and the low-stock level; Price (lowest to highest), and for the Owner Cost and Margin as the list's rules give them.
- **Right:** "Sizes and colours", a table with sizes across and colours down, each cell its stock, opening that size's own page; 0 muted, below zero warned. "+ Add a size or colour" (the Owner's) opens a box: Size, Colour, Barcode, Supplier code, Price (the first size's to start), Cost, starting stock, sent as one new size. Then the history, each line saying its size and colour.
- **Adjust stock** is on each size's own page, as the grid's note says ("Open one to see its history or adjust it"); the summary's Adjust stock and Send to another shop aren't on this page.

## 4. Adding a product (decision 11; `st-list`, `st-list-none`, `st-list-new`, `rs-add-product`)

- **Stock:** "+ Add a product" beside the search for the Owner, not on a phone (as drawn); "+ Add “[typed]” as a product" under nothing found, the name filled; "+ Add a product" on a new shop's empty list. Added, its page opens.
- **Receiving:** a scanned barcode Wheelhouse doesn't know, for the Owner, opens "Add this product", "Barcode [barcode] · not in Wheelhouse yet", the barcode filled, "Add and count 1": the product is added with no stock and goes on the delivery as 1, as a scan would. Staff are told as before; the left-for list is `rs-add-left`'s.

## 5. Cost went up? Change it (receiving, the 3 Oct later change, walk-through 3 M3)

`PUT /api/deliveries/booked-in/:id/lines/:lineId/cost` `{ costPence }`, the Owner's (`notProductEditor`), under the product's lock with the save's 2-second limit: the line's `unit_cost` and the product's cost become it, and a price change row names the delivery. A cost the same as the line's changes nothing. The delivery's page shows the Owner each line's cost with "Change cost", a small box: "Cost went up? Change it", New cost, a note that it changes the product's cost from now on, as `rs-invoice-cost`'s note says. Not drawn: the box follows `rs-invoice-cost`.

## 6. Not built, and noted

Bulk prices, frame numbers, sending stock, photos, Show on website and off sale on the new screens stay with their own work; the old app still does photos and off sale.
