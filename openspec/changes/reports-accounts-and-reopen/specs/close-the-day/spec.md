# Spec Delta

## ADDED Requirements

### Requirement: A closed day can be reopened, and closed again
The Owner SHALL be able to reopen the latest closed day with a reason. The first close SHALL be kept as it was saved, a reopened day SHALL not count as closed anywhere, and the sales it counted SHALL stay with it. Closing it again SHALL make a new close for that day from a new count, work its figures out from the sales it counted, clear the reopening and keep the first close as history. A day SHALL be reopened only while it is the latest closed day.

#### Scenario: reopened and closed again
- **WHEN** Wednesday is reopened, then closed again with a count £5.00 higher
- **THEN** Wednesday has one close, with the new count, its first close is kept with who reopened it and why, and its takings are the same sales' takings

#### Scenario: a sale saved after the first close
- **WHEN** a sale made on Wednesday was saved after Wednesday's first close and Wednesday is reopened and closed again
- **THEN** that sale counts in the next close, not in Wednesday's

#### Scenario: not the latest
- **WHEN** Thursday is closed and Jack tries to reopen Wednesday
- **THEN** he is told only the latest closed day can be reopened and nothing changes

### Requirement: A close sends its day to accounts software
When a close is saved, or a reopened day is closed again, and the shop is connected, the close SHALL cause that day's summary to be sent, or replaced, as the accounts software requirements say. A day that can't be sent SHALL still be closed.

#### Scenario: a failed send doesn't undo a close
- **WHEN** a day is closed and its send fails
- **THEN** the day is closed as normal and shows as Not sent
