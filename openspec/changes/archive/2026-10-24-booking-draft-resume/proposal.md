# Proposal: "You didn't finish booking" brings a booking back later

## Why

Jack, 1 Oct, book a repair decision 9 (`docs/decisions/2026-10-01-book-a-repair-review.md:91-97`):
"Nothing the customer typed is ever lost … coming back later shows 'You
didn't finish booking — carry on where you left off', or start again."
Drawn as `bk-resume` (`book.mjs:253`): the step the customer stopped at,
with the banner "You didn't finish booking. Carry on where you left off —
everything you typed is still here.", "Carry on" and "Start again" (mockup
links: Carry on stays, Start again goes to the first step). Today the draft
lives only in the tab's sessionStorage, so it's lost when the tab closes.
Jack's lane.

## What Changes

- **Kept for later.** Besides the tab's copy, the booking in progress is
  kept on the device (localStorage, `wh-book-draft-later:<shopSlug>`) with
  when it was saved and the step it was on, for 7 days.
- **Coming back.** In a new tab or visit with no copy in the tab, a kept
  draft is brought back, and the customer lands on the step they left with
  the drawn banner. A refresh in the same tab shows no banner, as now.
- **The buttons.** Carry on closes the banner. Start again clears the draft
  everywhere and goes to the first step.
- **Cleared.** Sending the booking clears both copies, as it clears the
  tab's copy now. A kept draft over 7 days old is thrown away.
- Photos aren't kept, as now: the problem step already says they need adding
  again.

## Capabilities

### Modified Capabilities

- `book`: an unfinished booking comes back on a later visit.

## Impact

`src/screens/book/draft.tsx`, `src/screens/book/frame.tsx`, the first book
screen (`service.tsx`), tests. No server change.
