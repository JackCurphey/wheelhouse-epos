## ADDED Requirements

### Requirement: The customer's quote says when a reminder was sent
Once the reminder has gone, the customer's quote SHALL say so beside when it was sent: "Sent Thu 17 Sep, 10:15 · we sent a reminder at 10:15" (dq-quote-reminded).

#### Scenario: After the reminder
- **WHEN** Maya opens her quote after the reminder went at 10:15
- **THEN** the sent line ends "· we sent a reminder at 10:15"
