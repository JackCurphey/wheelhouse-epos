# Proposal: stretching a job in the diary

## Why

The retired old diary let staff make a job longer or shorter by dragging its
edge (CAL-05, `docs/decisions/2026-08-31-feature-catalogue.md`). Jack, 18 Oct,
kept it for the new diary (`docs/decisions/2026-10-18-old-diary-features.md`
answer 2, plus its tablet and phone section and its correction).

## What Changes

- **With a mouse**, a job's bottom edge stretches it. A grip shows on hover,
  and while dragging, the times and length show beside the job ("11:30–13:30
  · 2 hours"), or inside it in the last column. It moves in 15-minute steps,
  can't be shorter than 15 minutes or run past closing time, and saves when
  you let go.
- **On a tablet or phone**, holding a job opens its menu, and "Change length"
  shows a finger-sized grip (44px) on that job's bottom edge. A tap anywhere
  else leaves the length as it was. A tap on a job still opens it.
- **From the keyboard**, the menu (the Menu key, or Shift+F10) has "Change
  length" too. Up and down change the length in 15-minute steps, Enter saves
  and Escape leaves it, each step read out.
- Saving uses the move's own change (the same date and start time, the new
  end time, the version the diary saw), so a refusal reads as a move's does:
  "Couldn't change [bike]’s length: [why]".

## Lane, drawings and decisions

- **Lane:** Jack's: `src/screens/diary/diary-page.tsx`, `job-extras.tsx`,
  `rules.ts`. Screens only; the server already takes a new end time.
- **Drawings:** `diary-stretch`, `diary-stretch-tablet`, `diary-stretch-phone`
  (`oldDiaryFeatureDrawings()` in `docs/design/user-journeys/generator/diary.mjs`).
- **Decisions:** `docs/decisions/2026-10-18-old-diary-features.md` (answer 2,
  the tablet and phone section, and its correction); gaps in
  `decided-while-building.md`, 18 Oct.

## Out of scope

- Stretching a job's top edge (Jack chose the bottom edge only).
- The other old-diary pieces (month view, Change details, the menu's till
  actions), each its own change.

## Impact

- `src/screens/diary/diary-page.tsx`, `job-extras.tsx`, `rules.ts`
- `tests/screens/diary-stretch.test.js`, `tests/screens/diary-rules.test.js`,
  `tests/browser/diary-stretch.spec.ts`
