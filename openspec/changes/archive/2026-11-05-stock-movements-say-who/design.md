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

`STOCK_LOCK_WAIT` is 2 seconds, the import's and a product save's, set with `SET LOCAL lock_timeout` when `lockStock` starts, so it ends with the transaction and never stays on a connection another request reuses. Jack kept the 2 seconds (`docs/decisions/2026-11-04-answers.md`, answer 6).

Applying a count holds every product it counted. Measured through the real Apply route on a scratch database, with a sale of one of those products being tried throughout:

| Products changed | Before | Now | A sale meanwhile |
|---|---|---|---|
| 5,000 | 0.8 s | 0.6 s | waits, and sells |
| 10,000 | 1.9 s | 1.2 s | waits, and sells |
| 20,000 | 5.3 s | 2.2 s | told once to try again, then sells |
| 50,000 | 19.4 s | 5.7 s | told twice to try again, for about 4 s, then sells |

Each product now finds its own rows rather than searching every row, which also blocked the server for every shop, and Apply locks once. Of the 5.7 s, reading and working out takes about 0.2 s and changing stock 0.5 s; writing 50,000 history lines takes 2.4 s and 50,000 results 2.0 s, each row checking its links. Going further would mean writing those before taking the locks and checking again under them: not done, as it needs a second path for when something moved between.

- **Staff requests:** `55P03` (the limit) and `40P01` (a deadlock broken) reach the API's one catch in `server.js`, which answers 503 `{ code: 'busy' }`. Every writer already rolls back before rethrowing. Nothing is stored.
- **The till's sync:** `isTransient` gains `55P03`, so the till re-sends the batch; items already recorded come back as duplicates.
- **Shopify refund:** throws, is recorded as safe to retry, and Shopify retries (`shopify-refund-stock`).
- **Shopify order: the same 2 seconds, retried by Shopify.** Its claim is now in the sale's transaction, as a refund's is, so any failure takes the claim with it, is recorded as safe to retry, answers 500, and Shopify's retry counts the order once. A duplicate waits on the claim and finds it taken. It sells past stock (Jack, 5 Nov, answer 7), so an item at nothing goes below zero and shows on Today. A refusal that would be the same next time stays claimed with its reason and is logged as a fault: a product taken off sale, a quantity or price it can't read, or a discount that stops the payment adding up. Lines matching nothing here are logged. Nothing here needs a longer wait now: an earlier version waited 30 seconds and then lost the order. Its deferred push is registered before its own COMMIT, so the webhook runs in `runRequestWithPushSlotCleanup`, which settles it if that COMMIT fails.
- **Citrus import:** keeps its own 500ms wait and its try-again (`wait: false`). A product row with stock costs an update and a line beyond what it did before: the row was made just now so isn't locked, and the shop is read once a batch. 20,000 rows with stock take 60 s, against about 44 s before this piece, with batches still within their limits.

## 5. Cause

`type` says what kind, `note` and `reason` say why, and a link says which: `purchase_order_id`, `delivery_id`, `stock_take_id`, `till_sale_id`, `sale_id`, `shopify_refund_id`. New columns: `delivery_id`, `sale_id`, `shopify_refund_id`.

## 6. A supplier import's line

A product imported from a supplier's catalogue with stock now writes a line: `intake`, "Imported from [Supplier]'s catalogue". `decided-while-building.md` (28 Oct) noted it wrote none and left it for Jack; stock control decision 6 has every change in the history, and everything now going through one function gives it one. The figure is unchanged.

## 7. The old app's order route has no request key

**Belongs elsewhere.** `POST /api/purchase-orders/:id/receive` is called only by the old app's Receive delivery; the new screen uses `/api/deliveries/receive`, which has a key. `rs-receive` replaces it, so CLAUDE.md rule 5 allows removing that old screen, which is the fix, and the route with it. It's not done here since it's unrelated to who is on a line. Meanwhile its stock writes go through `moveStock` with who and a lock limit.

## 8. Query plans

No new `WHERE` uses the new columns, so no new index. The newest-first history read and the below-zero count were measured unchanged on a large table (task 4.4).

## 9. Removing a shop or a person

The new links mean each sale, delivery or person deleted checks the lines. `removeShop` clears results and lines first, and `employee_id`, `sale_id` and `delivery_id` have partial indexes: without them each deleted sale still reads every line just deleted, as those stay until the database tidies up. With 5,000 sales and 300,000 lines, removing the shop takes 4190 ms (104.7 s when reviewed, 18.5 s before this piece), and removing one person 9 ms (1.1 s when reviewed). `site_id` has no index: a business has few shops, and nothing deletes one outside `removeShop`.

## 10. What the screens say when busy

503 `busy` is the server saying nothing was stored and trying again can work. `serverSaid` (`src/lib/api/client.ts`) lets those words through where a 5xx otherwise reads "couldn't": Adjust, Apply, Undo and Book in. At the till (`pay-dialog.tsx`), on a card or split payment the card may already have been taken, and pressing Card approved again records the same sale without touching the machine, so it reads "Wheelhouse is busy just now, so this sale isn't recorded yet. Try again in a moment: if the card machine took the payment, don't take it again." On cash it stops at "Try again in a moment." It never says to reverse a payment, as other refusals do.

Converting an order already paid answers `code: 'already_converted'` with its `saleId`, so the till can say the sale was recorded and not to take it again, where any other refusal says none was.

## 11. Known, no code

- The old app shows "Check in with your PIN first" on pages with no PIN entry. Check-in on the new screens covers it, and the old app is a placeholder.
- A Citrus Lime upload at an empty till asks for no PIN: it changes no stock until a batch brings it across under the sign-in, as the table in section 2 says.
- Many orders behind one held product can use up the pool, as on main.
- An order that can never succeed (a price of 1e40, no `line_items`) gets 500 on every delivery until Shopify gives up. Low risk.
