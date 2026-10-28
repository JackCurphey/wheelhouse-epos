# Design: stock take

## Decisions

1. **Migration 099** (renumbered from 098, which `098_first_pin.sql` took)
   adds five tables, each kept to its shop by row-level security, each row
   of a take able to point only at its own shop's take:
   - `stock_takes`: what is counted (`kind`: `whole_shop`, `category`,
     `area` or `below_zero`; `target`, the category or area's name, set for
     those two kinds only, up to 60 characters), the products below zero when
     a below-zero count started (`product_ids`), `status` (`counting` or
     `applied`), who started it and when, who applied it and when.
   - `stock_take_counters`: who joined, and when they said they'd finished
     their part (null while counting).
   - `stock_take_counts`: one line per count, product and person, with the
     number counted (0 to 100,000; 0 is "counted as none") and when that
     person first and last counted it. Times are the database's `now()`, the
     clock `stock_movements.created_at` uses.
   - `stock_take_recounts`: a line sent back to the counters, by whom, when.
   - `stock_take_results`: once applied, each counted product's expected,
     counted and difference, its cost then, and the history line written.
   It also adds `stock_movements.stock_take_id`. It is safe to run twice and
   onto the shared development database, which ran the first draft as 098:
   tables and columns are added only when missing, and the draft's checks
   are dropped and made again.
2. **Starting, checking and applying a count is for the Owner** until roles
   bring "Can order stock" (the 5 Oct later change to decision 5; the
   deliveries-orders pattern, `ownerOnly`). A category must be one the
   shop's products use; an area is any name; a below-zero count records the
   products below zero at that moment and is refused when there are none.
3. **Anyone signed in can join and count** (decision 11: Staff "can adjust,
   count and send"). Joining is recorded when the counting page opens.
4. **Counting is one statement, so two at once both count.** A scan adds
   one, a typed number sets the person's count:
   `INSERT … ON CONFLICT (stock_take_id, product_id, login_id) DO UPDATE SET
   qty = stock_take_counts.qty + EXCLUDED.qty` (or `= EXCLUDED.qty` when
   typed). Two people counting the same product each have their own line.
   Typing 0 takes the person's line off. Counting never touches `products`
   or `stock_movements`. The take is read `FOR SHARE`, so applying waits for
   a count in flight, and a count after applying is refused (409).
5. **Blind**: nothing a counter can read carries a product's stock figure.
6. **The count's products:** a category count takes only products in that
   category, a below-zero count only the products on its list; anything else
   is refused with a message ("[Product] isn’t in [Category]").
7. **Counting again after "I've finished my part"** puts the person back to
   counting (their finished time is cleared).
8. **What is allowed for** (decided here for Jack to overrule, 28 Oct;
   `decided-while-building.md`). Expected is measured for each product at
   the moment of its last count: whatever was sold, booked in, used, sent or
   adjusted after that is allowed for, and whatever moved before it is
   already in what was counted. So `expected = stock now − what moved after
   the product's last count`, `difference = counted − expected`, and
   applying adds the difference to stock as it is then. The other way
   (measured from when the count started) would leave stock one too low for
   every unit sold between the count starting and the shelf being scanned.
   This way can't place a sale that falls between two people's counts of
   the same product; nor a sale whose transaction began before a count and
   finished after it (its time is when it began).
9. **Applying** locks the take (`FOR UPDATE`), then its counted products in
   id order (`FOR NO KEY UPDATE`, the order sales and the till take them
   in, so they queue rather than deadlock), works out the differences with
   everything locked, and for each product that differs runs `UPDATE
   products SET stock_qty = stock_qty + difference` and writes a `count`
   line in `stock_movements` (who applied it as `login_id`; the note "Stock
   take of [Area] · counted [n], expected [n] · counted by [Name]"), all in
   one transaction. A sale waiting on a product's lock then applies its own
   relative change on top, so neither is lost. A line asked to be recounted
   and not counted again is left as it is. Shopify is told after the reply.
10. **Undo** locks the same way, takes each difference off with a
    `count_undone` line ("Undid the stock take of [Area]"), removes the
    results and puts the count back to counting, to be checked again.
11. **Recount** removes the line's counts, adds it to every counter's page as
    "Recount asked by [Name]" and puts every counter back to counting.
12. **Count them as none** counts as 0, by the Owner, each product the count
    covers that nobody counted: the whole shop's active products, the
    category's, or the below-zero list. An area count covers only what was
    scanned, so it has none (decision 5: "only what's scanned in this area
    is compared").
13. **Money** is at cost, in whole pence (`ROUND(cost * 100)`), never shown
    to Staff: Finished counts and checking are for the Owner.

## Contract

- `GET /api/stock-takes` → `{ canStart, areasUsed: string[], inProgress:
  [{ …take, counting: string[], finished: string[], itemsCounted,
  everyoneFinished }], finished?: [{ …take, productsChanged, valuePence }] }`
  (`finished` for the Owner only). A take is `{ id, kind, target, label,
  status, startedAt, startedBy, appliedAt, appliedBy }`.
- `POST /api/stock-takes` `{ kind, target? }` → 201 the take; 400; 403 `owner_only`.
- `GET /api/stock-takes/:id` → `{ …take, mine: [{ productId, name, sku, qty }],
  myItems, othersCounting: string[], recountAsked: [{ productId, name, sku,
  askedBy }], stillToFind: [{ productId, name, sku }] | null }`; 404.
- `POST /api/stock-takes/:id/join` and `/finish` → 200 `{ ok }`; 409 applied.
- `POST /api/stock-takes/:id/counts` `{ productId, add: 1 }` or `{
  productId, qty }` → 200 `{ productId, name, sku, qty }`; 400; 404; 409.
- `GET /api/stock-takes/:id/check` (Owner) → `{ …take, productsCounted,
  productsMatching, productsDiffering, valuePence, rows: [{ productId, name,
  sku, expected, counted, difference, costPence, valuePence, byCounter: [{
  name, qty }], allowedFor: [{ kind, change }] }], recountAsked, notCounted:
  { products, expected, list } | null }`; rows differ only, largest value first.
- `POST /api/stock-takes/:id/recount` `{ productId }`, `/none`, `/apply`,
  `/undo` (Owner) → 200; 400; 403; 404; 409. `apply` returns `{ …take,
  productsChanged, valuePence }`; `undo` the take.
- `GET /api/stock-takes/:id/download` (Owner) → `text/csv`, "Product,
  Supplier code, Expected, Counted, Difference, At cost".
