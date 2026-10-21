## MODIFIED Requirements

### Requirement: Staff can read one job and list jobs by date
Staff SHALL be able to read one job, with its reference, its booking, bike and work states, its version, notes, the customer's own words, its planned length, its linked order and its days. Staff SHALL be able to list jobs, optionally for a date range; a job SHALL be in the range when any of its days is. A job that does not exist SHALL be refused with "Job not found". A job's planned length SHALL be the minutes given when it was made (by staff, or an online booking's services' total), else the length of its times; it SHALL be empty when a job has neither.

#### Scenario: A job in the range
- **WHEN** staff list jobs for the Monday a job is on
- **THEN** the list includes that job

#### Scenario: A job outside the range
- **WHEN** staff list jobs for 1 to 2 October and the job is on another day
- **THEN** the list does not include it

#### Scenario: A job that is not there
- **WHEN** staff read a job that does not exist
- **THEN** it is refused as not found with "Job not found"

#### Scenario: A request with no set time keeps its planned length
- **WHEN** staff read a job with 90 planned minutes and no times
- **THEN** the job says 90 planned minutes, so the diary offers it as 90 minutes, not an hour

#### Scenario: A timed job's planned length is its times
- **WHEN** staff read a job they made from 14:00 to 15:30
- **THEN** its planned length is 90 minutes

#### Scenario: A job with no times and no length given has none
- **WHEN** staff read a job they made with neither times nor a planned length
- **THEN** its planned length is empty
