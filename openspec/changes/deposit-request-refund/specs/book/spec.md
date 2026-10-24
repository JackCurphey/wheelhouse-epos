## ADDED Requirements

### Requirement: A request the shop hasn't confirmed gets its deposit back when cancelled

A request waiting for the shop, or a time the shop offered that the customer
hasn't accepted, SHALL get its deposit back when the customer cancels it,
whenever that is; only a confirmed booking keeps it after the cut-off.

#### Scenario: A request cancelled after the cut-off
- **WHEN** Maya's request for tomorrow, not yet confirmed, is cancelled after its cut-off
- **THEN** her £13.00 is refunded, and the cancel pop-up said it would be
