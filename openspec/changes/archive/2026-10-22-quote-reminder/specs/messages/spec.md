## ADDED Requirements

### Requirement: A quote with no answer gets one reminder
When a quote is sent, the customer SHALL get one "Quote reminder" after the shop's hours (24 to start) if they haven't answered; answering, the shop withdrawing it, or a newer quote SHALL stop it (Jack, 1 Oct and 22 Oct). A quote never expires by itself.

#### Scenario: No answer after 24 hours
- **WHEN** Maya's quote was sent and she hasn't answered 24 hours later
- **THEN** she is sent the Quote reminder, once

#### Scenario: Answered first
- **WHEN** Maya answers before the 24 hours are up
- **THEN** no reminder goes
