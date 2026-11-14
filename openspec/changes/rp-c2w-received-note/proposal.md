WP: none (Jack's answer to #770's second report question, 14 Nov)

## Why

The Cycle to Work report (`rp-c2w`) counts Paid and Commission on `paid_on`, the date the payment was received, entered when an order is marked paid. The drawing's note said "on the day each order is marked paid", which #770 left as an open question. Jack answered on 14 Nov: option 1, keep counting by the day the payment was received, and change the note to say so.

## What Changes

- The note on `rp-c2w` reads "Paid and commission are counted on the day the payment was received. They go to Xero with that day’s summary." It is changed in the drawing (`docs/design/user-journeys/generator/reports.mjs`) and on the report screen (`src/screens/reports/c2w-report.tsx`).
- The in-progress `cycle-to-work` change's reports spec and the code comments use the same wording.
- Jack's answer is recorded and marked settled in `docs/decisions/decided-while-building/2026-11-jack.md` and `docs/decisions/2026-11-12-cycle-to-work-defaults-taken.md`.
- No counting changes.

## Capabilities

### New Capabilities

None. A small piece: no spec change (`skip_specs`).

### Modified Capabilities

None.

## Touches

- `src/screens/reports/c2w-report.tsx`, `tests/screens/reports-c2w.test.js`, `docs/design/user-journeys/generator/reports.mjs`, comments in `server/lib/report-c2w.js`, `server/lib/report-changed-c2w.js` and `server/routes/reports.js`.
- Not a risky area; the server edits are comments only.
- The published claude.ai canvas of the drawings is not republished by this change.
