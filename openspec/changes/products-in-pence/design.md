# Design

## 1. Generated columns

```sql
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS price_pence BIGINT GENERATED ALWAYS AS (round(price * 100)::bigint) STORED,
  ADD COLUMN IF NOT EXISTS cost_pence  BIGINT GENERATED ALWAYS AS (round(cost * 100)::bigint) STORED;
```

- **Exact:** `price` is `NUMERIC(10,2)`, a true decimal, so `price * 100` is already a whole number; `round` only changes the type. Floating point never enters it.
- **Can't disagree:** the old till, old app, Citrus import and supplier import all still write pounds and the pence follows. Nothing has to remember to write both, which is the risk in the "same statement writes both" pattern of migration 073. Every test fixture and any unmerged branch writing `price` stays correct.
- **`BIGINT`, not `INTEGER`:** the column allows up to £99,999,999.99, which is 9,999,999,999 pence, past what an `INTEGER` holds. With `::int` a single absurd row would fail the migration, and so stop the server starting. `server/db.js` already reads `BIGINT` as a number.
- **Negative costs convert too:** the old product form can save one (`stock-warnings-on-today`, design 11), so the columns aren't checked to be 0 or more.
- **A count's stored cost widens with it:** `stock_take_results.cost_pence` was `INTEGER`, so a cost over £21,474,836.47 gave a server error at Apply (the independent review, 4 Nov). The migration makes it `BIGINT`, Apply's cast and the summary's follow.
- **Later:** when the old app has gone, `ALTER COLUMN price_pence DROP EXPRESSION` makes pence the stored figure and the pounds columns can go, with no rewrite.

## 2. The lock it takes

Adding a stored generated column rewrites the table under an exclusive lock. Measured on a scratch database, Postgres in compose, 1,000,000 made-up products in 10 businesses, 467 MB with indexes:

| Way | Time the table is locked |
|---|---|
| Generated columns, one `ALTER` | 3.7 s; 3.9 s for the whole migration, widening 1,000,000 count results as well |
| Plain columns then a backfill a business at a time | 12.1 s, and still needs something to keep them in step |

The migration runner holds one transaction per file, so a backfill's lock lasts as long as the backfill. A generated column is the shorter lock. Migrations run at server start, before the server listens, and the biggest single shop is expected to hold tens of thousands of products, a small fraction of this. The rewrite also isn't subject to row-level security, so no loop over shops is needed.

## 3. Saving in pence

`POST` and `PUT /api/products` take `pricePence` and `costPence` beside the old `price` and `cost`.

- A figure must be a whole number of pence sent as a JSON number: a cost from 0 to 9,999,999,999, a price from 0 to 2,147,483,647 (section 8). Anything else is refused with a plain sentence; a refused save stores nothing.
- `pricePence` beats `price` if both are sent. A `null` `pricePence` is refused: a price is never "not given" by accident.
- `costPence` follows the cost rules (spec, "A save never overwrites a cost it wasn't given"): absent, `null` or empty leaves it; someone who can't see costs has it ignored, not refused, as `cost` is.
- Pence are turned into a pounds string from their whole pounds and their remainder (`server/lib/pence.js`, `penceToPounds`), so nothing is rounded. Swept to £1,000.00 and at the limits.

## 4. A save's lock limit

`PUT /api/products/:id` holds a row lock from `SELECT … FOR UPDATE` to `COMMIT`. It takes `SET LOCAL lock_timeout = '2s'` first; if the row stays locked (a big stock take apply, a stuck session) it answers 503 `{ code: 'busy' }` and rolls back, as `server/routes/move.js` does. The reply is sent after `COMMIT`, as before. Only this route changes: `/stock` and the other stock writers get their limit in piece 2, in one place.

## 5. Reads

- `serializeProduct` adds `pricePence`, and `costPence` only for someone `canSeeCosts` lets see it; otherwise `null`, as `cost`. `price` and `cost` stay for the old app, the till screen and purchase orders.
- `till/snapshot.js` reads `price_pence` instead of `ROUND(price * 100)::int`, which would have stopped a till's snapshot on a price over £21,474,836.47.
- Stock take differences and an adjustment's value read `cost_pence`. The value keeps `abs()` for a negative cost.
- A delivery's lines send `pricePence` for labels.
- The screens' `money` takes pence and shows `(pence / 100).toFixed(2)`, exact at these sizes: swept to £1,000.00 and at the most a product can hold, in `tests/stock-margin.test.js`.
- `margin` works on pence. **It can differ from before by 1 point near a half point:** £12.00 with a £9.55 cost at 20% VAT is exactly 4.5%, which used to show 4% and now shows 5%, the right rounding. Everything else on screen is unchanged.
- The storefront, Shopify and old app keep their pounds.

## 6. The totals check

`check-money-totals.mjs`'s `CONVERTED` gains products. Its check compares pounds × 100 with pence for every row.

## 7. Query plans

No new `WHERE`, join or sort uses the new columns, so no new index and no row-level security trap. Checked on the large table: the list's and a product's plans are unchanged (task 3.3).

## 8. How big a price can be

A sale line can't carry a price over £21,474,836.47: `server/till/sync.js` refuses one and `till_sale_lines` holds `INTEGER` pence, step C's to change. Rather than widen those, a save refuses so large a price: simpler, and a price nobody could sell isn't a price. Every writer holds to it: `POST` and `PUT /api/products` in pence and pounds, the supplier import, and the Citrus import (the row needs a look). A product already over it stays, opens, and saves if its price isn't sent. The pounds' own limit stays on cost, which is never sold.

Known, not changed: two of the most expensive thing on one sale go past what a line can carry, and sync refuses that line, as it does today.
