# Held work can't be resumed on an ended booking

## Why
#351 refuses start, hold and reopen on a cancelled, declined or expired booking (issue #190 A). Jack's answer 1 on 22 Oct (`docs/decisions/2026-10-22-marks-overnight-questions.md`): "block both", and the one gap left for Mark to close: work put on hold before the booking ended can still be resumed, which starts it again. The server keeps no record of whether held work ever started, so it can't tell "held after starting" from "held before starting".

## What changes
- **Resume is refused** on an ended booking, as start is: "This booking [was cancelled / was declined / expired], so the job can't be resumed." The work stays on hold.
- **Words:** an expired booking says "This booking expired", as the screens already do (`src/screens/diary/refusal-words.ts`), not "was expired".
- Hold stays refused on every ended booking, as built in #351. The cost: work under way when staff cancel can be finished or marked waiting for parts, but not held. Held work on an ended booking stays held; the bike can still be collected.

## Decided here, for Jack to overrule
Keeping hold refused on all ended bookings (not only on work that hasn't started) is Mark's call, because without a record of whether work started, allowing hold on started work would trap it on hold with no way to resume. A "started at" column would allow the finer rule; it is a schema change, not made here.

## Impact
`server/workshop/transitions.js`; `tests/workshop-ended-booking-actions.test.js`; `openspec/specs/workshop-jobs/spec.md` through this change's delta. No change to `server/routes/workshop.js`.
