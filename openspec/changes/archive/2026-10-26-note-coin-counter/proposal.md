# Proposal: the note-and-coin counter

## Why

Opening the shop (journey 10) and Close the day (journey 16) both count the
cash drawer the same way: a box for every note and coin, from £50 down to
1p, adding up to a total that can be typed over (cash-up decision 3,
`docs/decisions/2026-09-29-cash-up-review.md`; opening decision 2,
`docs/decisions/2026-09-30-opening-the-shop-review.md`). The build plan
names it building block 18, the note-and-coin counter, built in WP-3.3
Opening the shop (`docs/superpowers/plans/2026-10-03-release-2-build-plan.md`,
WP-3.3) and used again by WP-3.4 End-of-day cash-up. The split plan gives
WP-3.3 to Jack whole (`docs/superpowers/plans/2026-10-04-release-2-two-person-split.md`,
Stage 3).

This change builds the counter on its own, as a screen part with no server,
so the float check (`op-float-count`) and Close the day (`eod-count`) can
each place it when they are built. Taken by Jack.

**Risky area:** money (it adds up cash). It saves nothing and has no server,
no migration and no route; amounts are whole pence throughout. `/review`
runs before merging.

## What Changes

- **A note-and-coin counter** (new screen part, not a page of its own): the
  group "Count each note and coin" with twelve boxes, £50, £20, £10, £5, £2,
  £1, 50p, 20p, 10p, 5p, 2p and 1p; each box takes a whole number, and on a
  computer or tablet shows what that many is worth. Below them, "Cash
  counted", "Adds up from the boxes — or type the total". It tells the page
  it sits in the amount counted, in pence, or that nothing has been counted
  yet (so that page can keep "Done counting" off, audit H1).
- **Its sums** (new rules file): the twelve notes and coins in pence,
  adding a count up, reading a typed total such as "£208.70", and showing
  pence as pounds, all in whole numbers.

## Drawings and decisions

- Drawings: `eod-count` (`docs/design/user-journeys/generator/cashup.mjs:71-94`,
  `denomGrid` and `totalBox`), which holds block 18
  (`consolidate/j16.mjs:13`); `op-float-count`
  (`docs/design/user-journeys/generator/opening.mjs:53-62`), merged into
  `eod-count` as the same counter (`consolidate/j10.mjs:11`).
- Decisions: cash-up 2 (blind counting: the counter never shows what the till
  expects; the page around it does, or doesn't) and 3 (a box for every note
  and coin, and a total that can be typed over, which takes over from the
  boxes); opening the shop 2 ("Count it" opens the same count as cash-up)
  and its audit H1 ("Done counting" stays off until a box has a number).

## Out of scope

- The float check pop-ups (`op-float-check`, `op-float-short`) and their
  server change, Today's float lines, and Close the day: each places this
  counter when it is built.
- "The till expects" line, "Done counting" and "Back": these belong to the
  page or pop-up around the counter in the drawings, not to the counter.
- Saving a count anywhere.
