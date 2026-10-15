# Proposal: a job with no time opens, and a second tap opens a Waiting card

## Why

Two of the known problems in issue #192 that the drawings and decisions
already settle (Jack, 15 Oct: fix them now rather than at stage 4):

- A job with no time sits in the Week view's No time row as plain text that
  can't be opened. The drawing makes each chip open the job, as a block does
  (`diary.mjs` `unschedRow` and `NO_TIME_ROW`, both linking to the job).
- On a tablet, a second tap on a "Waiting for you" card does nothing. Decision
  14 (`docs/decisions/2026-09-27-workshop-day-review.md`) says "On a tablet or
  phone the first tap highlights and a second tap opens", and the drawing's
  hint reads "Tap the card again to open it."

## What Changes

- The Day view gets the same No time row, with that day's untimed jobs (Jack,
  15 Oct: "1", asked because no drawing shows untimed jobs in the Day view).

- A No time chip, in the Week view and on a phone, opens the job page on a
  click, a tap or Enter, as a block does. It still can't be dragged.
- On a computer or tablet, a touch tap on the chosen Waiting card opens it. A
  mouse click on it still only chooses it (a double-click opens, as now).
- `workshop-diary` changes in its two requirements; nothing on the server.

## Lane, drawings and decisions

- **Lane:** Jack's: `src/screens/diary/**`. No server change.
- **Drawings:** as drawn, apart from the Day view's No time row, which Jack
  chose on 15 Oct; the Day view drawing gains it in the next drawings update.
- **Decisions followed:** Workshop day decision 14; the drawings' No time row.

## Out of scope, for Jack to decide

- Date or time fields on "Enter a time instead": no decision or drawing has
  them.

## Impact

- `src/screens/diary/diary-page.tsx`, its screen tests, and
  `openspec/specs/workshop-diary/spec.md` (two requirements).
