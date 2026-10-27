# Design: opening the shop with a float check

## The contract

Money is whole pence everywhere. All routes are staff routes, under the
request's row-level security.

**Migration 095** (`server/migrations/095_float_checks.sql`), safe to run twice:

- `shops.float_pence INTEGER NULL`, 0 to 10,000,000 (£100,000). Null is "not
  set". On the shop's row, like the receipt words (`receipt_footer`), until
  the settings store (WP-1.2).
- `float_checks`: `shop_id`, `day DATE` (the shop's own date), `login_id`
  (who), `expected_pence` (the float when checked), `counted_pence` (null
  for "looked right"), `reason` (up to 500 characters, '' for none),
  `checked_at`, `seen_by_login_id`, `seen_at`. `UNIQUE (shop_id, day)`;
  `counted_pence` is null exactly when it was a look. Row-level security as
  085 and 092.

**Routes**

- `GET /api/end-of-day-settings` → `{ floatPence: number | null }`.
- `PUT /api/end-of-day-settings` `{ floatPence }` → the same. Owner only.
  400 unless a whole number of pence from 0 to 10,000,000.
- `GET /api/float-check` → `{ day, floatPence, takesPayments, firstDay,
  check }`. `check` is today's `{ id, how: 'looked' | 'counted',
  expectedPence, countedPence, reason, checkedByName, checkedAt }` or null.
  `firstDay` is true while the shop has never had a float check.
- `POST /api/float-check` `{ countedPence: number | null, reason? }` → 201
  `{ check }`. Null `countedPence` is "Looks right". Refusals: 403
  `not_taking_payments`; 409 `no_float`; 400 `count_needed` (a look on the
  first day); 400 for a count that isn't whole pence from 0 to 10,000,000,
  or a reason over 500 characters or not text; 409 `already_checked` with
  `{ check }`, the one already made.
- `POST /api/float-check/:id/seen` → `{ ok: true }`. Owner only. 409
  `not_short` for a check that isn't short or is already seen; 404 for an id
  that isn't a number.
- `GET /api/needs-attention` gains `{ kind: 'float_short', checkId,
  shortPence, countedByName, checkedAt, reason }` for today's short float not
  yet seen.

## Decisions

1. **One float check per shop per day, the first person to open the till.**
   Until the PIN check-in (WP-1.7) and tills with names (step C), the till
   page asks `GET /api/float-check` when it opens; whoever is first there
   and takes payments is "first in". The day is the shop's own date
   (`shopToday` with the workshop's time zone), so tests on the pinned clock
   see 1 Sep 2026.
2. **No lock needed.** Nothing here reads a row and writes it back: the
   float is one `UPDATE` of one column (as `PUT /api/shop-details`); a check
   is one `INSERT … ON CONFLICT (shop_id, day) DO NOTHING`, so two at once
   keep one and the other is told; Seen is one `UPDATE … WHERE seen_at IS
   NULL AND counted_pence < expected_pence`. The settings-saves-dont-clash
   lock is for read-then-write saves, and none is added.
3. **The server decides what's short.** The till compares the count with
   the float it was shown, to choose its pop-up, but what's stored is the
   float at the moment of saving, and Today's line and Seen use the stored
   pair.
4. **"Takes payments"** is `login.is_owner` or the login's team member's
   `is_cashier`, the closest switch to "a role that takes payments" (UX
   walk-through 2 M1) until roles.
5. **Who checked is a login**, named from `logins.name` when read. No
   activity log entry yet (WP-1.2 isn't built); the float check row is the
   record.
6. **The first day** is "this shop has no float check yet". The move
   (journey 9) will set this more precisely when it is built.

## Screens (second pull request)

- The till page asks for today's float check and, when it's due, opens the
  float check pop-up over the till (the shared `Dialog`, no ✕, Escape does
  nothing), then the count with `NoteCoinCounter`, then the difference
  pop-up. "Float checked · …" shows as the till's short message.
- Settings › Front desk gains an End of day area with a Float fold, saved as
  the Receipts fold is.
- Today's Needs attention gains the short float line with Seen.
