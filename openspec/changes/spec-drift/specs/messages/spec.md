## RENAMED Requirements

- FROM: `### Requirement: Staff can undo a message for a minute`
- TO: `### Requirement: Staff can undo Bike ready and a quote for a minute`

## MODIFIED Requirements

### Requirement: Staff can undo Bike ready and a quote for a minute
Bike ready, queued when staff mark a job ready, SHALL wait a minute before it goes, and Undo in that minute SHALL stop it (UX walk-through H2; the drawn bar "“Bike ready” goes to Maya by text in 1 minute"). Sending a quote SHALL give staff a minute to Undo before the quote is sent, and Undo in that minute SHALL stop Quote to approve (drop-off and quote decision 5). Other messages staff trigger, the booking answers' messages and the old app's one-off text, SHALL go at once with no Undo (as built with the booking message triggers, 20 Oct, and the messages engine; no Undo is drawn for them).

#### Scenario: Undo
- **WHEN** staff send a quote and press Undo within the minute
- **THEN** Quote to approve isn't sent

#### Scenario: Undoing Bike ready
- **WHEN** staff mark a job ready and press Undo within the minute
- **THEN** Bike ready is stopped and nothing is recorded as sent

#### Scenario: A booking answer has no Undo
- **WHEN** staff accept a booking request
- **THEN** Booking confirmed is queued to go at once, with no minute to Undo
