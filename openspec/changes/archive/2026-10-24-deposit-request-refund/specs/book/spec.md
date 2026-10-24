## ADDED Requirements

### Requirement: A request the shop hasn't confirmed gets its deposit back when cancelled

A request waiting for the shop, or a time the shop offered that the customer
hasn't accepted, SHALL get its deposit back when the customer cancels it,
whenever that is; only a confirmed booking keeps it after the cut-off. A
request the shop confirms after its cut-off SHALL be free to cancel for 1 hour
from then, never past the booking's start.

#### Scenario: A request cancelled after the cut-off
- **WHEN** Maya's request for tomorrow, not yet confirmed, is cancelled after its cut-off
- **THEN** her £13.00 is refunded, and the cancel pop-up said it would be

#### Scenario: Confirmed after the cut-off
- **WHEN** the shop confirms Maya's request after its cut-off has passed
- **THEN** she can cancel free for 1 hour from then, never past the booking's start
