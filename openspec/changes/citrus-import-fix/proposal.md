## Why

The first part of WP-2.4 (#598, #599, #600) brings products, stock, customers and bikes across and counts the rows that didn't fit, but nobody can do anything about those rows, and nobody can ask for help. Jack's answer 6 (4 Nov) is waiting on this piece: a row that shares a deleted customer's details must not become a customer unless a person at the shop chooses that.

## What Changes

- Look at the [n] on the summary opens `mv-fix`: the rows that need a look, grouped, each with Leave it out and Fix, then Done for now.
- Fix: a pop-up for that one row, asking for the row's own details, checked by the same rules as a row in a file. A row that still doesn't fit stays as it was and says why.
- Leave it out: the row is kept, out of the way, and counted as left out.
- `mv-sorted` once every row is fixed or left out.
- Ask us to help, top right of each card (`mv-help`, `mv-help-sent`): what looks wrong goes to the Wheelhouse team through an adapter with a pretend version.
- A row someone has chosen to bring across despite sharing a deleted customer's email or phone needs that person's tick on that row. Nothing does it in bulk. A deleted customer's account number is always left out.

## Out of scope

Next: run alongside, the stages as links, the weekly refresh (WP-8.1). Settings › Your data (a later piece, build plan line 726), so See them isn't shown yet. A real inbox for Ask us to help: that's a real account, Jack's to say. Sales and Workshop jobs rows. Sending a picture of the screen (not drawn, as a move's rows hold customers' details).

## Who and risk

WP-2.4, Jack's. Risky areas: migrations (113); money and stock (a fixed price list row makes stock); customers (a fixed row makes a customer, and the deletion path changes). `/review` before merging; the hand-run CI and the merge are done by whoever is running the build.

## Follows

- Drawings: `mv-fix`, `mv-sorted`, `mv-help`, `mv-help-sent` (`docs/design/user-journeys/generator/moving.mjs`); the Fix line on `mv-start` (`consolidate/j09.mjs`).
- Decisions: `docs/decisions/2026-09-30-moving-from-citrus-lime-review.md` 2, 9 (M3, L2); `docs/decisions/2026-10-03-ux-walkthrough-second-walk.md` 4 and 4d (what Fix asks is left for the build, logged for Jack); `docs/decisions/2026-10-08-not-drawn-pages.md` #30 and #43; `docs/decisions/2026-11-03-answers.md` all six.

## Capabilities

### New Capabilities

### Modified Capabilities
- `moving-from-citrus-lime`: rows that need a look can be fixed or left out; Ask us to help.

## Impact

`server/migrations/113_citrus_fix.sql`, `server/move/fix-row.js`, `server/move/help-inbox.js`, `server/move/bring-across.js`, `server/move/bring-customers.js`, `server/routes/move.js`, `server/routes/purchase-orders.js` (exports who-is-here), `src/screens/moving/`, tests.
