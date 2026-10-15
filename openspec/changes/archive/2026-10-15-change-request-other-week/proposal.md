# Proposal: a change request into another week shows the time asked for

## Why

Issue #192: "A change request into another week shows no dashed outline, and
its card goes to the booking's current day (decision 19 says highlight the
requested time)." The outline is drawn only from jobs whose own day is on
screen, so a request into another week has nowhere to show.

## What Changes

- Choosing a change request's card, when the time asked for is in a
  different week from the booking, moves the diary to the week asked for
  (Jack, 15 Oct, `docs/decisions/2026-10-15-change-request-other-week.md`).
  A request inside the booking's own week behaves as today.
- The dashed "Requested [time]" outline is drawn from the waiting list too,
  so it shows in a week where the booking itself isn't.
- The chosen request's outline is marked, as its block is, following
  decision 19's "highlights the time the customer wants".
- Same on a phone.

## Lane, drawings and decisions

- **Lane:** Jack's: `src/screens/diary/diary-page.tsx` (split plan §3). No
  server change: `GET /api/workshop-waiting` already gives the time asked for.
- **Drawings:** `change-selected` (`docs/design/user-journeys/generator/diary.mjs`,
  `REQUEST_OUTLINE`, "Requested 14:00"), drawn for a request in the same week.
- **Decisions:** decision 19; Jack's answer of 15 Oct.
- **Decided here** (Jack's section of `decided-while-building.md`): a
  screen reader hears the customer's name in a week without the booking,
  since the waiting list carries no bike; the chosen outline takes the
  chosen block's highlight.

## Out of scope

- Accepting by dropping onto the outline in another week (the job isn't on
  screen to drag).
- The rest of #192.

## Impact

- `src/screens/diary/diary-page.tsx`, `tests/screens/diary-page.test.js`,
  `tests/screens/diary-phone.test.js`, `workshop-diary`'s change request and
  Waiting column requirements.
