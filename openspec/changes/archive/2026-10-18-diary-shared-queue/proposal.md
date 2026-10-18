# Proposal: a Shared queue button in the diary

## Why

The retired old diary had an "Unassigned" pill that showed only the jobs no
mechanic had yet. Jack, 18 Oct, kept it as a feature of the new diary, as a
"Shared queue" button (`docs/decisions/2026-10-18-old-diary-features.md`
answer 5, and its tablet and phone section).

## What Changes

- **Desktop and tablet:** a "Shared queue" button after the mechanics.
  Picked, the week shows only the jobs with no mechanic, and the Day view is
  one column of them, named "Shared queue". Its place in the address is
  `?who=shared`.
- **Phone:** "Shared queue" is the last line of the "whose jobs" list.
- **Toolbar spacing** follows the desktop drawing from 1280px, so four people
  buttons fit one row: 4px between the toolbar's groups, 4px between the
  people buttons, and 8px before New job. Tablets keep their drawn spacing;
  below 1280px the toolbar is two rows, as it already was at 1024px. With
  three or more mechanics it is two rows at 1280px too.

## Lane, drawings and decisions

- **Lane:** Jack's: `src/screens/diary/diary-page.tsx`. Screens only; no
  server change, because the jobs already say when they have no mechanic.
- **Drawings:** `diary-shared-queue` (desktop), `diary-shared-queue-tablet`
  and `diary-shared-queue-phone`, from `oldDiaryFeatureDrawings()` in
  `docs/design/user-journeys/generator/diary.mjs`.
- **Decisions:** `docs/decisions/2026-10-18-old-diary-features.md` (answer 5,
  and the tablet and phone section).

## Out of scope

- The other four pieces in that decision (month view, stretching, Change
  details, the menu's actions): each is its own change.
- New job's default mechanic while Shared queue is picked: unchanged.

## Impact

- `src/screens/diary/diary-page.tsx`
- `tests/screens/diary-page.test.js`, `tests/screens/diary-phone.test.js`
- `tests/browser/diary-extras.spec.ts`
