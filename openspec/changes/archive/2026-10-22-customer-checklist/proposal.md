# Proposal: the checklist on the customer's booking page

## Why
The ready and collected booking pages are drawn with the job's "Full service
checklist" (cp-summary's checks(); Workshop day 21: a ticked item with no
note reads "All working well"; audit M1, Jack 30 Sep: a note reads "What the
mechanic found:" and a line counts the checks done; UX walk-through 1 L5:
the checks not done are named). It waited for a checklist to be kept
(decided-while-building, 21 Oct); the job checklist was built on 22 Oct
(#382, #383). The booking-page-stages contract listed the field.

## What changes
- The booking link carries `checklist: { name, items: [{ name, done, note }] }`
  once the work is finished, or null (while it's under way, or no checklist).
- The ready and collected pages show it after "What we did": the checks done,
  each "All working well" or what the mechanic found, then "[n] of [n] checks
  done." and "Not done: …".

## Risky areas
A public route (`/api/portal/*`): the booking link view. Reviewed.
