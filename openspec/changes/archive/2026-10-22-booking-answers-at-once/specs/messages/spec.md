## MODIFIED Requirements

### Requirement: Staff can undo a message for a minute
Quote to approve and Bike ready SHALL wait a minute before they go, and Undo in that minute SHALL stop them (drop-off and quote decision 5; UX walk-through H2). The booking answers (Booking confirmed, New time offered, Request declined, Date change answered, Booking cancelled) SHALL go at once, with no Undo: undoing the message wouldn't undo the answer (Jack, 22 Oct).

#### Scenario: Undo
- **WHEN** staff send a quote and press Undo within the minute
- **THEN** Quote to approve isn't sent

#### Scenario: A booking answer
- **WHEN** staff accept a booking request
- **THEN** Booking confirmed is queued to go at once, with no Undo
