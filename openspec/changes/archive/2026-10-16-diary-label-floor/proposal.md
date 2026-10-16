# Proposal: every diary label is at least 12 pixels

## Why

The diary layout review (#238, item 6): several labels on the diary were 9 to
11 pixels, the commonest thing that fails people with weaker eyesight. Jack,
16 Oct: bring every diary label up to at least 12 pixels, on every screen,
checked on screen first (`docs/decisions/2026-10-16-workshop-test-copy-changes.md`,
item 8). He saw before and after screenshots and approved.

## What Changes

- Every label in the diary screens (`src/screens/diary/`) is at least 12px:
  job and stack blocks, the hours, the day headings, "No time", a request's
  outline, the people chips' initials, Waiting card labels, the summary and
  pop-up labels.
- A block too short for two 12px lines (a half-hour job) shows the bike
  only, as the drawing does (walk 1 M3); the job stays in its description
  and summary. Before, the second line was cut in half.
- Job titles truncate a little sooner in narrow columns.

## Lane, drawings and decisions

- **Lane:** Jack's: `src/screens/diary/**`.
- **Drawings:** the job blocks catch up with the drawing (block text 12px,
  never smaller); the day headings and other small labels go past it.
- **Decisions:** Jack's answer of 16 Oct.

## Impact

- `src/screens/diary/diary-page.tsx`, `job-extras.tsx`, `request-dialog.tsx`;
  `tests/design-diary-label-floor.test.js`, `tests/screens/diary-page.test.js`.
