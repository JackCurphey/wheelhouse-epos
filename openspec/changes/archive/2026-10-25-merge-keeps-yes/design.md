# Design: merging two customers keeps a yes

## Decisions

1. **The four answer columns go into the merge's record of before and
   after:** `service_reminders`, `review_requests`, `reminders_said_yes_at`
   and `reminders_said_yes_via`. They sit alongside the fields staff
   choose, but not as a choice: the rule is Jack's (answer 9). Undo's
   existing "only what the merge changed, and only where nobody changed it
   since" covers them with no new code.
2. **When and where** come from the record whose yes to service reminders
   it is (the kept one first, when both), else from the one whose yes to
   review requests it is, so every yes says when and where (077's check).
3. **A kept record that stopped** (no now, though it said yes before) still
   becomes yes if the other record says yes, as the answer reads. Logged:
   a stop doesn't record when it happened, so there is no telling which
   came later.
4. **Undo puts the four back together or not at all** (self-review): if
   the customer has changed any of them since the merge, all stay. A partial
   put-back could leave a yes with no date, which 077's check refuses.

