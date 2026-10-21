# Proposal: the New online mark on stacks and in the month view

## Why
A booking confirmed straight away is marked "New, booked online" on its
diary block (Jack, 19 Oct, auto-confirm). The mark was left off a stack's
front card, a fanned-out stack and the month view "for a later piece"
(`docs/decisions/decided-while-building.md`, 21 Oct, auto-confirm screens,
item 3), so a new booking that shares its start time with another job, or
is looked at by month, isn't flagged.

## What changes
Not drawn; follows the closest built pattern, the No time chip's
"bike · mark", logged in decided-while-building:
- A stack shows the mark on its front card when any job in it is new, on
  its own line under the bike (beside the bike when the stack has room for
  one line only). Its name for screen readers says which job is new.
- A fanned-out stack's tile for a new job shows bike, job, then the mark.
- A month chip shows the globe after the bike; its name says "new, booked
  online". The day's list shows the mark after bike and job.

Screens only. Not one of the four risky areas.
