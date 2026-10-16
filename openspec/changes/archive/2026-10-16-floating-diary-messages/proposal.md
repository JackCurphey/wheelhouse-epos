# Proposal: the diary's passing messages float, so nothing on the page moves

## Why

Jack, 16 Oct, on the online test copy: pressing New job shows "Choose a time
for the new job." above the grid and pushes the whole diary down. He asked
that nothing that appears (a pop-up, a drop-down, a message) shifts the rest
of the page.

## What Changes

- New job's "choose a time" bar, and a refused move's "Couldn't move …"
  message, float at the bottom of the screen over the diary, on every size
  (Jack: "1"). The pattern is the till's drawn "Paid by link" message.
- The "Couldn't move …" message gains a close button ("Close the message"),
  since floating it means it would otherwise sit over the diary until the
  next move.
- Recorded as a rule for every screen: nothing that appears pushes the page
  (`docs/decisions/2026-10-16-workshop-test-copy-changes.md`).

## Lane, drawings and decisions

- **Lane:** Jack's: `src/screens/diary/diary-page.tsx`. No server change.
- **Drawings:** this changes `new-job-pick`, which draws the bar above the
  grid ("a slim instruction bar sits above the grid", `diary.mjs` ~2245); the
  drawing is updated when the diary's drawings next change.
- **Decisions:** none reopened; Jack's answer of 16 Oct.

## Out of scope

- The other screens: they follow the rule as they're built or touched.
- The drawing itself.

## Impact

- `src/screens/diary/diary-page.tsx`; tests in `tests/screens/diary-move.test.js`,
  `tests/screens/diary-new-job.test.js`, `tests/browser/diary-extras.spec.ts`;
  `workshop-diary`'s New job and refused-move requirements.
