# Design

## 1. One function

`server/lib/stock.js`: `moveStock(moves, who, options)`, in the caller's transaction. Everything that changes `products.stock_qty` or writes `stock_movements` goes through it; `tests/stock-movements-one-place.test.js` reads the server's source and fails if anything else does.

- Locks in product id order, with `stock_qty + n` from a row it holds. `lockStock` is exported for callers that must read under the lock first (an adjustment's value at cost; a sale's up-front lock of all its products).
- Takes many moves in one call: a count's lines stay one statement each for the stock, the lines and the results, so locks are held as briefly as they were. Several lines on one product sum for the stock and each keep their line.
- `neverBelowZero` refuses the whole call before writing anything. Going up always goes.
- Products no longer held come back as `missing`, with no line: the till's sync raises `unknown_product` on those, as it does today.
- Returns what to tell Shopify after `COMMIT`.

## 2. Who

`login_id` stays the sign-in. New `employee_id` and `who_name` are the person, as `deliveries` keeps them: a shared computer stays signed in as the Owner, and a person can be deleted, so the name stays when the link goes. This settles "`login_id` names the sign-in rather than the checked-in person". History and Today read `COALESCE(who_name, login's name)`, so older lines keep the only name they recorded.

| Writer | The person |
|---|---|
| Adjust, add with stock, supplier import with stock, book in, apply and undo a count | `whoIsBooking(req)`: who's checked in, or the sign-in's person on an ordinary browser. On a till or workshop computer with nobody checked in: 409 `check_in_first`, nothing changes |
| The old till's sale, an order paid | The sale's own cashier, so the line and the sale agree; the sign-in stays in `login_id`. Never refused for this: the old till keeps working, and sales under the person checked in are step C's (WP-1.7 task 3.8) |
| The till's sync | The sale's employee |
| Shopify order, Shopify refund | Nobody: no person did it, and the line's type and cause say so |
| Citrus import | The sign-in that sent the file; on Fix, the person fixing the row |

Adding a product with no stock, or importing one with none, names nobody and isn't refused.

## 3. Shop

`site_id` is a till or workshop computer's own shop, otherwise the business's oldest, otherwise empty: a business can have no shop yet (`decided-while-building.md`, line 1244). **Giving every business a first shop moves to piece 3** with stock per shop, as the split plan first put it here: it changes what Till setup and every test that adds a first shop see, and belongs with the stock it's for. Old lines' shop is filled in then too. Links are `NOT VALID` so the migration doesn't read other businesses' rows with no shop set; new columns are empty, so no rewrite.

## 4. Lock limits

`STOCK_LOCK_WAIT` is 2 seconds, the import's and a product save's, set with `SET LOCAL lock_timeout` when `lockStock` starts. A count's Apply holding every product it changes was measured (task 4.4) against that.

- **Staff requests:** `55P03` (the limit) and `40P01` (a deadlock broken) reach the API's one catch in `server.js`, which answers 503 `{ code: 'busy' }`. Every writer already rolls back before rethrowing. Nothing is stored.
- **The till's sync:** `isTransient` gains `55P03`, so the till re-sends the batch; items already recorded come back as duplicates.
- **Shopify refund:** throws, is recorded as safe to retry, and Shopify retries (`shopify-refund-stock`).
- **Shopify order: waits 30 seconds, not 2.** Its claim commits before the sale, so any failure drops the order for good (the comment in `processShopifyOrderWebhook`). Failing after 2 seconds would turn a short wait into a lost order; it has no person waiting. Moving the claim into the sale's transaction, as the refund's is, is the real fix and is listed for later.
- **Citrus import:** keeps its own 500ms wait and its try-again (`wait: false`).

## 5. Cause

`type` says what kind, `note` and `reason` say why, and a link says which: `purchase_order_id`, `delivery_id`, `stock_take_id`, `till_sale_id`, `sale_id`, `shopify_refund_id`. New columns: `delivery_id`, `sale_id`, `shopify_refund_id`.

## 6. A supplier import's line

A product imported from a supplier's catalogue with stock now writes a line: `intake`, "Imported from [Supplier]'s catalogue". `decided-while-building.md` (28 Oct) noted it wrote none and left it for Jack; stock control decision 6 has every change in the history, and everything now going through one function gives it one. The figure is unchanged.

## 7. The old app's order route has no request key

**Belongs elsewhere.** `POST /api/purchase-orders/:id/receive` is called only by the old app's Receive delivery; the new screen uses `/api/deliveries/receive`, which has a key. `rs-receive` replaces it, so CLAUDE.md rule 5 allows removing that old screen, which is the fix, and the route with it. It's not done here since it's unrelated to who is on a line. Meanwhile its stock writes go through `moveStock` with who and a lock limit.

## 8. Query plans

No new `WHERE` uses the new columns, so no new index. The newest-first history read and the below-zero count were measured unchanged on a large table (task 4.4).
