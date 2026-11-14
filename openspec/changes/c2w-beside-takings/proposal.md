WP: none (Jack's answer to merge-c2w's Q1, the takings half, 14 Nov)

## Why

A Cycle to Work hand-over's provider share became its own figure at close of day in cycle-to-work pull request 10d ("Cycle to Work · Owed by providers, not in the drawer"), but it still counted inside the day's takings, a default Jack could overrule (`docs/decisions/decided-while-building/2026-11-jack.md`, 13 Nov, "Cycle to Work money at close of day and in Takings", item 2). Jack answered merge-c2w's Q1, the takings half, on 14 Nov: option 2. Cycle to Work money is shown beside the day's takings, like online money, not inside the total, on Takings and on the end-of-day report.

## What Changes

- A close's Takings is Card + Cash + Other again. The Cycle to Work figure stays as it is, its own figure beside the takings, as online money is.
- This holds wherever a close's takings are worked out: closing the day, closing a reopened day again, and a past day nobody closed ("[£] so far"). The Takings report's "Closed days' takings", its graph and its table add up the saved closes, so they follow.
- Screens: no change. The Takings report's "Cycle to Work" figure and the end-of-day report's "Cycle to Work" row are already where the drawings put them (`reports.mjs`, the Takings figures and `ZROWS`).
- Days already closed are not worked out again (a default, logged for Jack to overrule).
- Not changed: the accounts summary (`moneyBucket` in `server/accounts/summary.js` still files it under Gift cards; that half of Q1 is still Jack's), and the Sales report, whose takings are all money for sales and count Cycle to Work money as drawn.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `close-the-day`: Takings is till money only, with Cycle to Work money beside it.
- `reports`: Takings and cash-ups shows the Cycle to Work figure beside Closed days' takings.

## Impact

- `server/routes/close-the-day.js` (`takingsIn`): money, so a risky area.
- `tests/close-the-day.test.js`.
- Records: `docs/decisions/decided-while-building/2026-11-jack.md` and `openspec/changes/cycle-to-work/tasks.md`.
