## ADDED Requirements

### Requirement: Staff are told when a booking message couldn't reach the customer
When a staff answer's booking message has no way to reach the customer (no phone or email), the diary SHALL say so with the message's name, until closed; a message switched off in Settings SHALL say nothing (drawn as diary-no-message).

#### Scenario: No phone or email
- **WHEN** staff accept a request from a customer with no phone or email
- **THEN** the diary shows "“Booking confirmed” didn’t go: [customer] has no phone number or email on file." with Close
