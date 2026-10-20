## ADDED Requirements

### Requirement: Staff choose the mechanic as they accept a booking request
The booking request pop-up SHALL show pills for the shop's mechanics and the shared queue, with the request's own mechanic picked, and Accept SHALL book the request for the mechanic picked when that mechanic is free at the booked time (Workshop day decision 62; drawn on request-new).

#### Scenario: Another mechanic
- **WHEN** staff pick another mechanic and accept
- **THEN** the booking is confirmed for that mechanic, with its held time moved to them

#### Scenario: A busy mechanic
- **WHEN** the mechanic picked is already booked at that time
- **THEN** the accept is refused and the request waits as it was
