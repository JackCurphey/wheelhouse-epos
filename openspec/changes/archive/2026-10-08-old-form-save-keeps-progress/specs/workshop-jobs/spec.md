## MODIFIED Requirements

### Requirement: The old app can still set a job's status on create and save
Creating or saving a job MAY carry an old status, which SHALL be set directly without the move rules: pending → pending booking, work not started; scheduled → scheduled, not started; waiting_parts → scheduled, waiting for parts; on_hold → scheduled, on hold; complete → scheduled, finished. A save whose status matches the status the job already reads SHALL change none of the job's states. A save SHALL leave the bike alone; a create with waiting_parts or on_hold SHALL put it in the shop.

#### Scenario: A cancelled booking saved as scheduled
- **WHEN** staff save a cancelled job with the old status "scheduled"
- **THEN** the booking is scheduled again

#### Scenario: Saving work in progress from the old form
- **WHEN** a job's work is in progress and staff save it from the old form, which sends the status "scheduled" it already reads
- **THEN** the work stays in progress and the other changes are saved

#### Scenario: Changing the status from the old form
- **WHEN** a job's work is in progress and staff save it with the status "on_hold"
- **THEN** the work is on hold

#### Scenario: An unknown status
- **WHEN** a create or save sends a status that is not one of the five
- **THEN** it is refused with "status must be one of: pending, scheduled, waiting_parts, on_hold, complete"
