# Proposal: stock take

## Why

A shop checks its stock is right by counting it a section at a time, blind,
while the shop stays open (stock control decision 5,
`docs/decisions/2026-10-01-stock-control-review.md`). This is WP-2.2 Stock
take (`docs/superpowers/plans/2026-10-03-release-2-build-plan.md`), in slice
C, "stock you can trust". Taken by Jack, 28 Oct.

**Risky areas:** a migration (099), and stock. `/review` runs before each
pull request merges, and CI is run by hand on the branch (Jack, 28 Oct,
`docs/decisions/2026-10-28-ci-once-a-day.md`).

## What this change builds

Starting a count, joining it and counting blind; checking the differences,
with Recount and Count them as none; applying with Undo; Finished counts;
and Download the count.

What "allowed for" means for stock that moves during a count was not
settled by a decision. It was decided here for Jack to overrule (design 8,
`decided-while-building.md`): each product is measured at its last count.

Built on today's products: WP-1.5 (sizes and colours) is Mark's and isn't
built, so a product with sizes is counted as one product.

## What Changes

- **Server** (pull request 1): migration 099; start, join, count, finish;
  check, recount, count them as none, apply, undo, download; the counts in
  progress and finished.
- **Screens** (pull request 2, stacked): Stockroom › Stock take for the
  Owner and for Staff, with Finished counts; Start a count; the counting
  page, with recounts asked and the below-zero "still to find" list; Check
  the count; Count applied, with Undo and Download the count; "Counted"
  lines in a product's stock history.

## Drawings and decisions

- Drawings (`docs/design/user-journeys/generator/stock.mjs` lines 262–290):
  `tk-hub`, `tk-hub-staff`, `tk-start`, `tk-start-category`, `tk-count`,
  `tk-count-below`, `tk-diff`, `tk-applied`; the links in
  `mockup/links/j14.mjs` lines 60–66; the product history's "Counted · stock
  take of [Category]" line (`stock.mjs` line 170).
- Decisions: stock control 5 (counted a section at a time, blind; staff join
  on a phone; each scan adds one or a number is typed; sales carry on), 9
  (below zero: a count of just those products), 11 (areas used before; the
  below-zero "still to find" list; Staff can count); the 5 Oct later change
  ("a manager" is anyone with "Can order stock"); UX walk-through 3 H2 (every
  movement during the count is allowed for; held stock isn't expected),
  `docs/decisions/2026-10-02-ux-walkthrough.md`; day answers 11 (who, and
  when, always recorded).

## Out of scope

- Stock held for online orders and jobs, left out of Expected: nothing holds
  stock yet.
- Today's "products below zero" line with Count them (`st-today-below`),
  sending stock to another shop (`tr-send`, `tr-sites`, `tr-today-short`):
  they need Today's stock warnings and a second shop.
- Sizes and colours on a counted line (WP-1.5).
