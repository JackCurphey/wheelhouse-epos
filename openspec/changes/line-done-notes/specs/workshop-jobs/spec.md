## ADDED Requirements

### Requirement: Each line of a job's work and parts has a Done tick and a staff note

Staff SHALL be able to tick each line of a job's work and parts as done, and
untick it, and give it a note. The note SHALL be for staff only: it SHALL NOT
appear on anything the customer sees (Jack, 24 Oct). A line added from an
approved quote SHALL start with the quote line's reason as its note. Anyone
signed in MAY tick or write a note, and the latest change SHALL win. Neither
SHALL change once the work is finished or the order is paid; they SHALL be
kept when the job's lines are saved again.

#### Scenario: Ticking a line done
- **WHEN** Alex ticks "Shimano brake pads" on Maya's job
- **THEN** the line shows ticked when the job is opened again

#### Scenario: A note on a line
- **WHEN** Alex writes "Rear pads worn — replacing" on the pads line
- **THEN** the note shows on the line for staff, and nowhere the customer sees

#### Scenario: Changing a quantity keeps them
- **WHEN** a part's quantity changes after another line was ticked and given a note
- **THEN** the tick and note are still there

#### Scenario: From an approved quote
- **WHEN** Maya approves a quote line whose reason is "Rear pads worn"
- **THEN** the line joins her job's work with "Rear pads worn" as its note

#### Scenario: Finished work
- **WHEN** someone ticks a line after the work is marked ready
- **THEN** it is refused: "This work is finished, so its work and parts can’t change. Reopen the work first."
