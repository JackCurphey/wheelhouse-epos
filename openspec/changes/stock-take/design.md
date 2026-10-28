# Design: stock take, the counting half

## Decisions

1. **Migration 098** adds three tables, each kept to its shop by row-level
   security, each made only when missing so it is safe to run twice:
   - `stock_takes`: what is counted (`kind`: `whole_shop`, `category`,
     `area` or `below_zero`; `target`, the category or area's name, set for
     those two kinds only, up to 60 characters), the products below zero when
     a below-zero count started (`product_ids`), `status` (`counting` only,
     until the second half adds applying), who started it and when.
   - `stock_take_counters`: who joined, and when they said they'd finished
     their part (null while counting).
   - `stock_take_counts`: one line per count, product and person, with the
     number counted (1 to 100,000) and when that person first and last
     counted it. Times are the database's `now()`, the same clock
     `stock_movements.created_at` uses, so the second half can compare a
     count with the stock that moved around it.
2. **Starting a count is for the Owner** until roles bring "Can order
   stock" (the 5 Oct later change to decision 5; the deliveries-orders
   pattern, `ownerOnly`). A category must be one the shop's products use; an
   area is any name; a below-zero count records the products below zero at
   that moment and is refused when there are none.
3. **Anyone signed in can join and count** (decision 11: Staff "can adjust,
   count and send"). Joining is recorded when the counting page opens.
4. **Counting is one statement, so two at once both count.** A scan adds
   one, a typed number sets the person's count:
   `INSERT … ON CONFLICT (stock_take_id, product_id, login_id) DO UPDATE SET
   qty = stock_take_counts.qty + EXCLUDED.qty` (or `= EXCLUDED.qty` when
   typed). Two people counting the same product each have their own line
   (the drawing's "Jo Taylor [n] + Alex Morgan [n]"). Typing 0 takes the
   person's line off. Counting never touches `products` or
   `stock_movements`, so it can't wait on, or hold up, the till.
5. **Blind**: nothing a counter can read carries a product's stock figure.
6. **The count's products:** a category count takes only products in that
   category, a below-zero count only the products on its list; anything else
   is refused with a message ("[Product] isn’t in [Category]"), so a counter
   knows at once. Whole shop and area counts take any product.
7. **Counting again after "I've finished my part"** puts the person back to
   counting (their finished time is cleared).

## Waits for Jack: what applying does with stock that moved during the count

The drawings and decision 5 say anything sold, booked in, used, sent or
adjusted during the count is "allowed for". The two ways to allow for it
give different stock:

1. **From when the count started.** Expected = stock when the count started;
   applying adds the difference to stock as it is then. Right when a pad is
   sold after it was scanned; one too few when it was sold between the count
   starting and the shelf being scanned.
2. **From when each product was counted.** Expected = stock at the moment
   that product was scanned; anything after that is added on top. Right in
   both cases above for one counter; when two people count the same product
   at different times, a sale between their scans can't be placed.

Either can be built on what this change records. Applying, locking products
in product-id order (as sales do) with each change and its
`stock_movements` line in one transaction, is the second half's design.

## Contract

- `GET /api/stock-takes` → `{ canStart, areasUsed: string[], inProgress:
  [{ id, kind, target, label, startedAt, startedBy, counting: string[],
  finished: string[], itemsCounted, everyoneFinished }] }`, newest first.
- `POST /api/stock-takes` `{ kind, target? }` → 201 the count; 400 `{ error }`;
  403 `owner_only`.
- `GET /api/stock-takes/:id` → `{ id, kind, target, label, startedAt,
  startedBy, mine: [{ productId, name, sku, qty }], myItems, othersCounting:
  string[], stillToFind: [{ productId, name, sku }] | null }`; 404.
- `POST /api/stock-takes/:id/join` → 200 `{ ok }`.
- `POST /api/stock-takes/:id/counts` `{ productId, add: 1 }` or `{
  productId, qty }` → 200 `{ productId, name, sku, qty }` (qty 0 when taken
  off); 400; 404.
- `POST /api/stock-takes/:id/finish` → 200 `{ ok }`.
