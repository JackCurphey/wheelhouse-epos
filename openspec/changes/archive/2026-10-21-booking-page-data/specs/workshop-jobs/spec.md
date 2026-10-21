## ADDED Requirements

### Requirement: The custody moves record when the bike came in and went
Booking a bike in SHALL record when, and collecting it SHALL record when. Bringing a collected bike back SHALL clear its collection time.

#### Scenario: Collected, then brought back
- **WHEN** a bike is collected and then brought back into the shop
- **THEN** its collection time is cleared, and its booking link keeps working
