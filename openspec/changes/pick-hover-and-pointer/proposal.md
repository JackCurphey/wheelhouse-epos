# Proposal: New job's highlighted slot, and the pointing finger on everything clickable

## Why

Jack, 16 Oct, trying the workshop on the online test copy:
- Choosing a time for New job, nothing shows which slot a click would pick.
- Buttons in the new app keep the plain arrow cursor, while the sidebar's
  links show the pointing finger, so it isn't clear what can be clicked.

## What Changes

- **New job's highlighted slot**, as drawn (`new-job-pick`,
  `docs/design/user-journeys/generator/diary.mjs`, `pickHintSlot`): while
  choosing a time, the slot under the pointer shows as a solid block in the
  accent colour with its time and a soft amber glow; it goes when the
  pointer leaves the column. Mouse only; touch has no hover.
- **The pointing finger on everything clickable**: buttons, `role="button"`
  controls, selects, `summary` and labels for a field, unless disabled. One
  rule in `src/styles/theme.css`, so it covers every screen of the new app,
  not just the workshop. Jobs that can be dragged keep their open hand
  ("grab"), which already says they can be clicked and moved.

## Lane, drawings and decisions

- **Lane:** Jack's: `src/screens/diary/**` and the shared theme's base
  styles (screens). No server change.
- **Drawings:** `new-job-pick` (the highlighted slot, drawn on 27 Sep, item
  2, not built until now).
- **Decisions:** none changed. The cursor is Jack's request of 16 Oct.

## Out of scope

- The old app (`public/app.js`).
- Any other hover styling.

## Impact

- `src/screens/diary/diary-page.tsx`, `src/styles/theme.css`,
  `tests/screens/diary-new-job.test.js`, `tests/browser/diary-extras.spec.ts`.
