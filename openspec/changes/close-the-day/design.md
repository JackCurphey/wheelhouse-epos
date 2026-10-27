# Design: Close the day

## The contract

Money is whole pence everywhere. All routes are staff routes, under the
request's row-level security, and Owner only until roles (WP-1.1). "Today"
is the shop's own date (`shopToday` with the workshop's time zone), as the
float check.

**Migration 096** (`server/migrations/096_close_the_day.sql`), safe to run twice:

- `paid_outs`: `shop_id`, `day DATE`, `login_id` (who took it out),
  `amount_pence` 1 to 10,000,000, `reason` (what it was for, 1 to 100
  characters), `note` (up to 500, '' for none), `created_at`.
- `day_closes`: `shop_id`, `day DATE`, `login_id` (who closed), `closed_at`,
  `float_check_id` (this morning's check), `float_start_pence`,
  `cash_pence` (cash sales), `paid_outs_pence`, `expected_pence`,
  `counted_pence`, `reason` (up to 500), `float_pence` (the standard float),
  `banked_pence`, `takings_pence`, `card_pence`, `other_pence`,
  `online_pence`. `UNIQUE (shop_id, day)`. The figures are kept as they were
  at the close, so the report never changes afterwards.
- Row-level security on both, as 095.

**Routes**

- `GET /api/close-the-day` → `{ day, floatPence, floatStart, cashPence,
  paidOutsPence, expectedPence, paidOuts, entry, close }`.
  - `floatStart` is this morning's float check, `{ pence, how: 'looked' |
    'counted', expectedPence, byName, at }`, or null. `pence` is what was
    counted, or the float when it looked right.
  - `cashPence` is the day's cash sales from both sales records (the old
    record's `cash_amount`, the till record's `cash` payments) in the day's
    window: from the previous close's saved time, or the start of the
    shop's day when there is none, to the end of the shop's day (Jack's
    answer 6).
  - `expectedPence` is `floatStart.pence + cashPence − paidOutsPence`, or
    null without a float check.
  - `paidOuts` is `[{ id, amountPence, reason, note, byName, at }]`, oldest
    first: today's, and any from days after the previous close's day.
  - `entry` is `{ show, closesAt }`: `show` once it is an hour before today's
    closing time (`set-eod-close`'s drawn choice), or all day when the
    opening hours say the shop is shut today, and never once the day is
    closed; `closesAt` is "17:30", or null when shut today.
  - `close` is today's close (below), or null.
- `POST /api/paid-outs` `{ amountPence, reason, note? }` → 201 `{ paidOut }`.
  400 for an amount that isn't whole pence from 1p to £100,000, a reason
  that isn't 1 to 100 characters of text, or a note over 500; 409
  `day_closed` once today is closed, including after waiting for a close
  in progress.
- `POST /api/close-the-day` `{ countedPence, expectedPence?, reason? }` →
  201 `{ close }`. `expectedPence` is the figure the screen showed. Refusals:
  409 `no_float` (no float set); 409 `float_not_checked` (nobody checked
  the float this morning); 409 `expected_changed` with `{ expectedPence }`,
  the new figure, when it differs from the one sent; 400 for a count that
  isn't whole pence from 0 to 10,000,000, an expected figure that isn't
  whole pence, or a reason over 500 characters or not text; 409
  `already_closed` with `{ close }`, the one already made.
- `close` is `{ id, day, closedByName, closedAt, floatStart, cashPence,
  paidOutsPence, expectedPence, countedPence, differencePence, reason,
  floatPence, bankedPence, leftPence, topUpPence, takingsPence, cardPence,
  otherPence, onlinePence }`. `differencePence` is counted − expected
  (negative is short); `topUpPence` is what's put in to make the float up
  (float − counted, or 0); `leftPence` is counted − banked + topUp, the
  float either way.
- `POST /api/float-check` accepts `atClose: true` from the Owner: a look
  (`countedPence: null`) is then kept even on the shop's first day (Jack's
  answer 8).
- `GET /api/needs-attention` gains `{ kind: 'float_over', checkId, day,
  overPence, countedByName, checkedAt, reason }` for an over float not yet
  Seen whose previous day was closed. `POST /api/float-check/:id/seen`
  accepts an over float as well as a short one.

## Decisions

1. **What the drawer should hold** (walk-through 2 M2; cash-up 4): this
   morning's float (what was counted, or the float when it looked right),
   plus the day's cash sales, minus the cash taken out. There are no cash
   refunds to take off: the till has no refunds yet (WP-3.1).
2. **Banking:** leave the shop's float, bank the rest (decision 4). When the
   count is less than the float, nothing is banked and the page says "Put
   £[n] in to make the float up to £[float]" before finishing (Jack's answer
   5, 27 Oct).
3. **No close without this morning's float check**, so the expected figure
   always starts from a real one. The Close the day page asks for it first,
   with "Looks right" only, never a count (Jack's answer 8).
4. **One close a day, and nothing added after it.** The close and a
   paid-out each lock the shop's row (`SELECT … FOR NO KEY UPDATE`, the
   settings-saves-dont-clash pattern, a strength that doesn't hold up a sale
   being saved) before reading and writing, so a paid-out at the moment of
   closing is either in the close or refused, and two closes at once keep
   one. `UNIQUE (shop_id, day)` backs it up.
5. **The report's figures:** Takings is till money only (Jack's answer 7)
   and is Card + Cash + Other, so it always adds up. Card and Cash come from
   the old record's `card_amount` and `cash_amount` and the till record's
   `card` and `cash` payments; everything else paid at the till is "Gift
   cards, store credit, customer accounts, other". The old record's
   `Shopify` and `Deposit paid online` tenders are online money, on their
   own line.
6. **A day's window** (Jack's answer 6): from the previous close's saved
   time (or the start of the shop's day) to the end of the shop's day, so a
   sale after a close is the next day's. Closing after midnight isn't
   handled (review, 27 Oct; logged for Jack).
7. **The expected figure is checked at the close** (review, 27 Oct): the
   screen reloads the figures on "Done counting" and sends the expected
   figure it showed; a change since is refused with the new one, and the
   screen shows the new difference before the day can close.
8. **Over float on Today** (decision 8 H1): listed when the shop's previous
   day with a float check was closed. A shop's first day has no previous
   day, so an over float that day isn't listed. "Yesterday" is the last day
   the till opened, so a shop shut on Sundays looks back to Saturday.
9. **Who** is a login, named from `logins.name`, as the float check. No
   activity log yet (WP-1.2).

## Screens (second pull request)

- `/workshop/till/close` (`eod-count`): the page's steps as sections that
  fold, one opening the next (decision 6): Count the cash (the
  note-and-coin counter, blind; then counted, expected, how the till worked
  it out, the difference or "Spot on", and an optional reason), Paid-outs and
  banking (the day's paid-outs or "No cash taken out today.", Add a
  paid-out, Leave in the drawer, Bank, and "Put £[n] in…" for a short
  drawer), End-of-day report (Close the day and show the report). The float
  check pop-up shows first if it is due, with Looks right only.
- The paid-out pop-up (`eod-paidout`) and the report pop-up (`eod-z`, with
  the Online money line and Print, using the till's `printPaper`).
- On the till: "Close the day" when `entry.show`, for the Owner.
- On Today: the over float line, with Seen, as the short one.
