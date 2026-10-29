# Proposal: Today's stock warnings

## Why

Stock control decision 6 lets anyone adjust stock, with a reason, as long as
who did it is recorded (confirmed by Jack's day answer 11,
`docs/decisions/2026-10-26-day-answers.md`). The safety net Jack chose with
it is that "an adjustment worth more than an amount the owner sets (Settings
› Stockroom) shows on the manager's Today with 'Seen'". Day answer 11 says
that warning waits until Today's stock warnings are built. Decision 9 adds
the other stock line on Today: "[n] products below zero" with "Count them",
which starts a stock take of just those products. The stock take is built
(`openspec/changes/archive/2026-10-28-stock-take`), and its task 4.2 left
this line for "Today's stock warnings". This change builds both.

Slice C (stock), the leftovers of WP-2.1 and WP-2.2. Taken by Jack (29 Oct).

**Risky areas:** a migration (102), and stock and money (an adjustment's
value at cost, in whole pence). `/review` runs before the pull request
merges, and CI is run by hand on the branch (the 28 Oct merge rule,
`docs/decisions/2026-10-28-ci-once-a-day.md`).

## What Changes

- **Settings › Stockroom › Stock adjustments** (`st-setting-adjust`): "Show
  on Today when an adjustment is worth more than [£ amount]", at cost. Not
  set until the Owner sets it; the Owner only, until roles.
- **Adjusting stock** records the adjustment's value at cost (how many ×
  the product's cost, in whole pence) and, when that is more than the amount
  set, marks it for Today.
- **Today's Needs attention** (`st-today-adjust`): "Stock adjusted:
  [Product] −[n] · £[value]", "[Reason] · by [Name] at [time]", and Seen,
  which records who and when and takes the line off.
- **Today's Needs attention** (`st-today-below`): "[n] products below zero",
  "Sold more than Wheelhouse thought were here · Count them starts a count
  straight away", See them (Stock with Below zero picked) and Count them
  (starts a below-zero stock take and opens its counting page). The line goes
  when nothing is below zero.

## Drawings and decisions

- Drawings: `st-today-adjust`, `st-today-below` (`today()` in
  `docs/design/user-journeys/generator/opening.mjs:170-174`, defined in
  `stock.mjs:317-319`); `st-setting-adjust` (`stock.mjs:221`, the fold in
  `settings-frame.mjs:259-264`); `tk-start-below` and `tk-count-below` (built).
- Decisions: stock control 6, 9 and 11 (`docs/decisions/2026-10-01-stock-control-review.md`:
  "'Count them' on Today starts the count at once"); day answer 11;
  opening the shop decision 4 (the money side of Today is for owners and
  managers); owner-only settings (`docs/decisions/2026-10-19-owner-only-settings.md`).

## Out of scope

- A Manager role: "the manager's Today" is the Owner's until roles (WP-1.1),
  as the rest of Needs attention is.
- Settings › Stockroom › Categories (decision 10) and the transfer line on
  Today (`tr-today-short`, decision 8).
- The activity log (WP-1.2): the adjustment and Seen record who and when.
