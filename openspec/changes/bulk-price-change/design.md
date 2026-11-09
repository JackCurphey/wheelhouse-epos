# Design

## 1. A bulk change (migration 124; decisions 7 and 11)

`price_change_batches`: `id`, `shop_id` (the business's own, row-level security as 122's table), `login_id`, `who_name` (kept if the person is later removed), `created_at`, `undone_at` (null until Undo). `product_price_changes` gains `batch_id`, referencing it, null for a change made any other way. Additive and safe to run twice.

`recordPriceChanges(before, after, who, { deliveryId, batchId })` writes the batch on each line. A product's history reads the lines as before, so a bulk change shows as "Price changed · £28.00 → £[price]".

## 2. Working prices out (`server/lib/bulk-prices.js`)

One function, `newPrices(products, rule)`, used by the preview and the change. `rule`: `{ how: 'each' | 'percent' | 'margin', value, ending: 'leave' | '99' | '00', prices }`.

- **A new price for each** (`each`): `prices` maps a product's id to its new price in whole pence. A product missing from it keeps its price. No ending applies: the price is what was typed.
- **Up or down by a percentage** (`percent`): `value` from −99 to +1000, up to two decimal places. New = now × (100 + value) ÷ 100, to the nearest penny.
- **A target margin** (`margin`): `value` from 0 up to (not including) 100, up to two decimal places, the margin as the list works it out (on the price before VAT, with the product's own rate). New = cost ÷ (1 − value ÷ 100) × (1 + VAT rate), to the nearest penny. A product with no cost recorded (none, or 0, as the list counts it) keeps its price and says "No cost recorded".
- **Prices end in** (percentage and margin only): `99` takes the nearest price ending in .99 (£30.80 → £30.99; £30.40 → £29.99; halfway goes up); `00` the nearest whole pound (halfway goes up). A price of £0.00 stays £0.00; anything above it never rounds to £0.00 (it becomes £0.99 or £1.00).
- Every new price is whole pence from £0.00 to £21,474,836.47 (the most a sale can carry); a rule that would go past it is refused, naming the product.

Each product comes back as `{ id, name, sku, size, colour, nowPence, newPence, costPence, vatRateBp, belowCost, noCost }`. `belowCost`: the new price before VAT is under the cost.

## 3. The routes (`server/routes/bulk-prices.js`)

All three the Owner's, the one there (`notProductEditor`, as editing a product), refusing anyone else with "Only the shop’s owner can add or change products".

- `POST /api/stock/prices/preview` `{ productIds, groupIds, how, value, ending, prices }` → `{ products }`. `groupIds` are products with sizes, ticked as one row: each brings every size it has. Ids from another business, or off sale, are left out (row-level security; the list shows on-sale products). At most 2,000 products.
- `POST /api/stock/prices` with the same body → `{ batchId, changed }`. In one transaction: lock the products (`FOR UPDATE`, ordered by id, with the 2-second limit a product's save has, answering "Wheelhouse is busy" past it), work the prices out again from the locked rows, write each that changes, record each change with the batch and who (`whoIsBooking`), commit, then push each changed product to Shopify as a save does. A rule that changes nothing is refused: "None of these prices would change".
- `POST /api/stock/prices/:id/undo` → `{ undone, leftAlone }`. In one transaction: lock the batch and its products; for each price line of the batch whose product's price is still what the batch made it, put the old price back and record that as a change (no batch); a price changed since is left alone and counted. The batch is marked undone; a second Undo is refused: "These prices have already been put back". Anyone who can change prices can undo, at any time; the screen offers it straight after.

## 4. Ticking on Stock (`stock-page.tsx`; `st-list-ticked`)

- A tick box at the start of each row, labelled "Tick [name]", 44 by 44; on a computer the header has "Tick all [n] shown", ticking (or unticking) every row shown. Ticks are kept by row (a product, a size found by a search, or a product with sizes) and stay through searches, filters and categories.
- With one or more ticked, a bar under the count: "[n] ticked", Untick all, and Change prices.
- Tick boxes and the bar show to whoever can change prices, the Owner, by the rule Edit on a product's page follows: the Owner's sign-in, and the server sending costs (`canSeeCosts`), so Jo checked in at the Owner's till sees none. Change prices is the bar's only button until Print labels and Send to another shop are built.

## 5. Change prices (`change-prices.tsx`; `st-prices`, `st-prices-done`)

A dialog, "Change prices", with "[n] products" under its title (or "[n] products from [Supplier]" when all of them share a supplier, as drawn).

- **How**: three pills, A new price for each, Up or down by a percentage (picked to start, as drawn), A target margin. "Change by [+n] %" or "Target margin [n] %". "Prices end in": Leave as they are, .99, .00 (`.99` picked to start, as drawn); not shown for A new price for each.
- **The table** (computer and tablet): Product (name, its code or size and colour under it), Now, New, Margin "[before] → [after]" (— with no cost). New is a box to type in for A new price for each. "Below cost" beside a new price under its cost. On a phone each product is a list item: its name, "Now £x → New £y", "Below cost", then "Margin a → b".
- The preview is asked for when the dialog opens and each time the rule settles (300 ms after typing, as the search box). A rule the server refuses shows its words under the controls.
- The note as drawn: "Nothing changes until you press Change. You can undo it straight after; each change goes into the product’s history."
- **Change [n] prices**, [n] the products whose price would change; with none it is greyed and says "Nothing would change". Pressed: the dialog closes, the ticks clear, the list reloads, and a message under the count says "Prices changed · [n] products" with Undo. Undo: "Prices put back · [n] products", and "· [n] changed since, left as they are" when some were.
