# Proposal: Waiting for you as a panel

## Why

Jack, 16 Oct, on the online test copy: the "Waiting for you" column looks
like it is floating on the background. The diary layout review (#238)
recommends the same: box it in so it reads as its own area.

## What Changes

- On a computer or tablet, "Waiting for you" sits in a panel: the light
  panel colour, a thin border and rounded corners, with its heading inside
  and the count as a small badge (Jack: "1"). The phone's Waiting sheet is
  unchanged.
- Screen readers still hear "Waiting for you (2)".

## Lane, drawings and decisions

- **Lane:** Jack's: `src/screens/diary/diary-page.tsx`. No server change.
- **Drawings:** changes `diary`'s Waiting column (`diary.mjs` `waitingColumn`,
  ~line 551), drawn without a box; updated when the diary's drawings next
  change.
- **Decisions:** none reopened (decisions 7 and 14 are kept);
  `docs/decisions/2026-10-16-workshop-test-copy-changes.md` item 6.

## Out of scope

- Moving Week/Day and the review's other recommendations (#238), each for
  Jack to decide.

## Impact

- `src/screens/diary/diary-page.tsx`, `tests/screens/diary-page.test.js`,
  `tests/browser/diary-extras.spec.ts`.
