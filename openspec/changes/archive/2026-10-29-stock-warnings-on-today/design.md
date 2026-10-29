# Design: Today's stock warnings

## The contract

Money is whole pence. All routes are staff routes, under the request's
row-level security.

**Migration 102** (`server/migrations/102_stock_warnings.sql`), safe to run
twice, additive:

- `shops.stock_adjust_today_over_pence INTEGER NULL`, 0 to 10,000,000
  (£100,000), as the float. Null is "not set": no adjustment goes to Today.
- `stock_movements.value_pence BIGINT NULL` (0 or more): an adjustment's
  value at cost when it was made. Null for every other kind of line.
- `stock_movements.to_see BOOLEAN NOT NULL DEFAULT false`: the adjustment
  was worth more than the amount set when it was made.
- `stock_movements.seen_at TIMESTAMPTZ`, `seen_by_login_id INTEGER
  REFERENCES logins(id)`: who pressed Seen, and when.
- A partial index on the lines still to see. `stock_movements` keeps its
  row-level security (migration 001); `shops` is read by the session's own
  shop id, as the float is; no new table.

**Routes**

- `GET /api/stockroom-settings` → `{ adjustTodayOverPence: number | null }`.
  Anyone signed in.
- `PUT /api/stockroom-settings` `{ adjustTodayOverPence }` → the same; `null` clears it.
  Owner only (403 `owner_only`). 400 unless whole pence from 0 to
  10,000,000. Runs in a transaction that reads the shop's row `FOR UPDATE`
  first (the settings-saves-dont-clash pattern).
- `POST /api/products/:id/stock` (built) also records, for an adjustment,
  `value_pence = |change| × round(cost × 100)` and `to_see = value_pence >
  the amount set` (false while none is set), in the same transaction.
- `GET /api/needs-attention` (Owner only, built) gains, after the lines it
  has:
  - `{ kind: 'below_zero', count, takeId }` when any active product is below
    zero; `takeId` is a below-zero stock take still counting, or null.
  - `{ kind: 'stock_adjusted', movementId, productId, productName, change,
    valuePence, reason, note, byName, at }` for each adjustment to see,
    oldest first.
- `POST /api/stock-adjustments/:id/seen` → `{ ok: true }`. Owner only (403
  `owner_only`); 409 `not_to_see` when the line isn't waiting (already seen,
  or never over); 404 for an id that isn't a whole number. The check and the
  record are one statement, as the float's Seen.

## Decisions

1. **Worth is at cost** (`st-setting-adjust`: "At cost"): how many the
   adjustment moved, up or down, times the product's cost in pence when it
   was made. The value is kept on the line, so a later change of cost
   doesn't change what the line says.
2. **Up as well as down.** The decision says "an adjustment worth more
   than"; it doesn't say which way. A large Found is as worth a look as a
   large Damaged. The drawing shows the down case.
3. **Decided when it is made.** Whether a line goes to Today is settled
   when the adjustment is made, against the amount set then. Setting or
   changing the amount later neither floods Today with old adjustments nor
   takes lines off. "More than" is strict: worth exactly the amount stays off.
4. **Not set until the Owner sets it** (as the float): with no amount, no
   adjustment goes to Today. The fold says "Not set yet".
5. **The lock** (settings-saves-dont-clash): the save reads the shop's row
   `FOR UPDATE` in a transaction and writes it. It is one column, so this
   only keeps the save in the shape the other settings use.
6. **Owner only until roles**, for the setting, the lines and Seen (opening
   the shop decision 4; the pattern of the float's Seen).
7. **Count them** starts a below-zero stock take (`POST /api/stock-takes`
   `{ kind: 'below_zero' }`, built) and opens its counting page. When a
   below-zero count is already counting, Count them opens that one instead
   of starting a second.
8. **See them** opens Stock with Below zero picked (`/workshop/stock?show=below-zero`).
9. **Who** is the sign-in that made the adjustment, as the product's
   history shows it.
10. **A note** on an adjustment (Other's, or any) follows the reason in
    quotes, as the float's reason does on its line.
11. **A negative cost counts at its size** (`abs`), so the value is never
    below nothing and the adjustment never fails on 102's check (review,
    29 Oct).
12. **`PUT /api/stockroom-settings` takes `null`** to clear the amount; the
    fold's emptied box sends it. Seen answered 409 (pressed in another tab)
    is done on the screen. Count them reads Needs attention again before
    choosing between the count already counting and a new one (review).
