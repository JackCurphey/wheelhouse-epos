# Proposal: Close the day

## Why

At the end of each day the owner counts the cash drawer against what it
should hold, records any cash taken out, bags the rest for the bank, and
saves the day's report (journey 16, `docs/decisions/2026-09-29-cash-up-review.md`).
This is WP-3.4 End-of-day cash-up (`docs/superpowers/plans/2026-10-03-release-2-build-plan.md`),
slice B of the replan Jack accepted on 26 Oct (`docs/decisions/2026-10-26-day-answers.md`,
section 1), straight after the float check (WP-3.3, archived as
`openspec/changes/archive/2026-10-27-opening-float-check`). Jack chose it on
27 Oct. Taken by Jack.

**Risky areas:** a migration (096), and money (the cash count, cash taken
out, the banking and the day's takings, whole pence throughout). `/review`
runs before each pull request merges.

## What it is built on, and what it isn't

The drawings close one named till, with six steps. Several steps stand on
things the new app doesn't have yet, so this change builds the three steps
that have real figures behind them, as the float check did, and says where
it differs:

- **Built:** count the cash (blind), paid-outs and banking, and the
  end-of-day report; "Close the day" on the till after closing time; an over
  float on Today once yesterday was closed.
- **One close per shop per day, no till name**, as the float check: tills
  get names with Mark's step C.
- **Who closes:** the Owner, until roles (WP-1.1) give managers and "Can
  close the day" (opening the shop decision 4; roles answer 6 of 5 Oct).
- **Step 1, "the till has sent its sales"**, waits for step C: the till
  today saves each sale as it is taken, so there is no queue to wait on.
- **Step 2, "Needs attention"** (flagged sales, the basket, parked sales)
  waits for the till's Park and for step C's flagged sales.
- **Step 5, the card check**, waits for a card machine connected to the
  till (journey 11 decision 6). There is none, so there is no machine total
  to match. Asked of Jack, not invented.

## What Changes

- **Server (pull request 1, `jack/close-the-day`):** migration 096 (cash
  taken out, and one close a shop a day with its figures); the day's
  figures, paid-outs and the close; Today's over float.
- **Screens (pull request 2, `jack/close-the-day-screens`, stacked):** the
  Close the day page, its paid-out and report pop-ups, the button on the
  till, and the over float line on Today.

## Drawings and decisions

- Drawings (`docs/design/user-journeys/generator/cashup.mjs`): `eod-entry`
  (`:215`), `eod-count` (`:200`), `eod-count-result` (`:202`),
  `eod-count-exact` (`:203`), `eod-banking` (`:207`), `eod-banking-none`
  (`:205`), `eod-paidout` (`:206`, the pop-up `:181`), `eod-finish`
  (`:209`), `eod-z` (`:210`, the report `:153`); the plan
  `consolidate/j16.mjs`. Today: `op-today-short` and `op-today-seen`
  (`opening.mjs`), for the over float line's pattern.
- Decisions: cash-up 2 (blind count; drawings assume blind), 3 (the
  counter), 4 (leave the standard float, bank the rest), 5 (Close the day in
  the till bar for owners and managers after a time the shop sets), 6 (each
  step opens the next; "Spot on" with no reason box; a night with no
  paid-outs; each till closes on its own; the report shows the date and who
  closed it); opening the shop 8 H1 (an over float goes to Needs attention
  only when yesterday was closed); walk-through 2 M2 (the expected figure
  shown after counting, starting from this morning's float); walk-through 11
  H2 (Takings, and online money is not in a till's takings); `set-eod-close`
  (`setup.mjs:154`, "1 hour before" chosen on the drawing).

## Out of scope

- Steps 1, 2 and 5 (above); `eod-waiting`, `eod-waiting-banked`,
  `eod-attention`, `eod-check`, `eod-card`.
- `eod-count-shown` and the blind-count setting, and the `set-eod-close`
  setting: until Settings › End of day has them, the count is blind and
  Close the day appears an hour before closing, as drawn.
- A day nobody closed: `op-float-check-unclosed`, `op-today-unclosed`,
  `op-close-yesterday`, `op-today-two`, `op-today-banked`. They change the
  next morning's float check, so they are their own piece.
- Reopening a closed day and the list of closed days (Reports, WP-5.3).
- Report rows with nothing behind them yet: Cycle to Work (WP-7.1), Refunds
  and Voids (the till's refunds, WP-3.1), Discounts given and VAT (the new
  till records neither yet), and the online money figure with its "see
  Reports" link (the report still says online money isn't in the till's
  takings).
- "Email it" on the report (who it goes to isn't settled), and opening the
  cash drawer (there is no drawer connection).
