# Proposal: stock take, the counting half

## Why

A shop checks its stock is right by counting it a section at a time, blind,
while the shop stays open (stock control decision 5,
`docs/decisions/2026-10-01-stock-control-review.md`). This is WP-2.2 Stock
take (`docs/superpowers/plans/2026-10-03-release-2-build-plan.md`), in slice
C, "stock you can trust". Taken by Jack, 28 Oct.

**Risky areas:** a migration (098), and stock. `/review` runs before each
pull request merges, and CI is run by hand on the branch (Jack, 28 Oct,
`docs/decisions/2026-10-28-ci-once-a-day.md`).

## What this change builds, and what waits

This change builds **starting a count, joining it, and counting** — the
part that never changes anyone's stock. It records every count with who
counted and when, so the second half can work out the differences whatever
rule Jack picks for it.

**Checking the count and applying it wait for Jack's answer** on what
applying does with stock that moved after the count started (see the
question in `design.md`). The drawings say anything sold, booked in, used,
sent or adjusted during the count "is allowed for", but not how, and the two
ways give different stock figures.

Built on today's products: WP-1.5 (sizes and colours) is Mark's and isn't
built, so a product with sizes is counted as one product.

## What Changes

- **Server:** migration 098 (stock takes, who is counting, and each
  person's count of each product); start a count (the Owner, until "Can
  order stock"); join it; scan or type a count; "I've finished my part";
  the counts in progress, with areas used before.
- **Screens** (second pull request, stacked): Stockroom › Stock take for the
  Owner and for Staff; Start a count; the counting page, with the below-zero
  count's "still to find" list.

## Drawings and decisions

- Drawings (`docs/design/user-journeys/generator/stock.mjs` lines 262–290):
  `tk-hub`, `tk-hub-staff`, `tk-start`, `tk-start-category`, `tk-count`,
  `tk-count-below`; the links in `mockup/links/j14.mjs` lines 60–66.
- Decisions: stock control 5 (counted a section at a time, blind; staff join
  on a phone; each scan adds one or a number is typed; sales carry on), 9
  (below zero: a count of just those products), 11 (areas used before; the
  below-zero "still to find" list; Staff can count); the 5 Oct later change
  ("a manager" is anyone with "Can order stock"); UX walk-through 3 H2 (every
  movement during the count is allowed for; held stock isn't expected),
  `docs/decisions/2026-10-02-ux-walkthrough.md`; day answers 11 (who, and
  when, always recorded).

## Out of scope

- `tk-diff` and `tk-applied`: checking the differences, Recount, Count them
  as none, applying with Undo, Download the count, and the hub's Finished
  counts — they wait for Jack's answer.
- Stock held for online orders and jobs, left out of Expected: nothing holds
  stock yet.
- Today's "products below zero" line with Count them (`st-today-below`),
  sending stock to another shop (`tr-send`, `tr-sites`, `tr-today-short`):
  they need Today's stock warnings and a second shop.
- Sizes and colours on a counted line (WP-1.5).
