# Proposal: merging two customers keeps a yes to reminders

## Why

Every online guest booking makes a new customer record, which staff later
merge into the real one (`2026-10-21-sign-up-joins-by-merge.md`). The
reminder tick saves its yes on whichever record the booking made. Merge
moves jobs, bikes and messages but not the customer's answers, so a guest's
yes was lost when staff tidied up.

Jack's answer 9 of 25 Oct (`docs/decisions/2026-10-25-morning-questions.md`):
"if either record said yes, the kept record says yes, with when and where it
was given." Jack's lane.

## What Changes

- **Merging keeps a yes.** If either record said yes to service reminders,
  the kept record says yes, and likewise for review requests. When and where
  the yes was given come from the record that said it; when both did, the
  kept record keeps its own.
- **Undo puts it back,** as it does the other fields: only what the merge
  changed, and only where nobody has changed it since.

## Capabilities

### Modified Capabilities

- `customers`: a merge keeps a yes to reminders.
