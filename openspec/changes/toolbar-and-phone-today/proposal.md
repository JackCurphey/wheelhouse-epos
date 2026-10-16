# Proposal: Week/Day with the dates; a Today button on the phone

## Why

The diary layout review (#238), answered by Jack on 16 Oct
(`docs/decisions/2026-10-16-workshop-test-copy-changes.md`, items 7 and 10):
- Week/Day and the dates are one control but sat across a wide gap.
- On a phone there is no quick way back to today from another week.

## What Changes

- **Toolbar:** Week/Day sits next to the dates at the left; the people chips
  and New job stay at the right. Decision 60's order is kept; only the
  centring changes. The drawing (`diary.mjs` `diaryToolbar` and the
  mechanic's toolbar) is updated to match.
- **Phone:** a "Today" button beside the week arrows, shown only when today
  isn't the day on screen; one tap goes back to today.

## Lane, drawings and decisions

- **Lane:** Jack's: `src/screens/diary/diary-page.tsx` and the drawings.
- **Drawings:** `diary`, `diary-day`, `diary-mechanic` toolbars change as
  above; the phone's Today button shows only off today, so the drawn phone
  boards (on today) don't show it.
- **Decisions:** decision 60 kept; Jack's answers of 16 Oct.

## Out of scope

- The 12px label floor and the upright tablet (their own pull requests).

## Impact

- `src/screens/diary/diary-page.tsx`, `docs/design/user-journeys/generator/diary.mjs`,
  `tests/screens/diary-phone.test.js`, `tests/browser/diary-extras.spec.ts`.
