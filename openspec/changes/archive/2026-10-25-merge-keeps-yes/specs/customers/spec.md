# Spec Delta

## ADDED Requirements

### Requirement: Merging two customers keeps a yes to reminders
When staff merge two customers, if either said yes to service reminders, or to review requests, the kept customer SHALL say yes to it, with when and where the yes was given. Undoing the merge SHALL put the kept customer's answers back, where nobody has changed them since.

#### Scenario: A guest's yes
- **WHEN** Maya ticked "Remind me…" as a guest, and staff merge that record into her main one
- **THEN** her main record says yes, from that booking

#### Scenario: Undo
- **WHEN** staff undo that merge
- **THEN** her main record's answers are as they were
