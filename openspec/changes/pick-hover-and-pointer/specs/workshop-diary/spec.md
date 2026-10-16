## ADDED Requirements

### Requirement: Choosing a time for New job highlights the slot under the pointer
While New job is choosing a time, the slot under the mouse pointer SHALL show as a solid block in the accent colour with its start time, snapped as a click would be, and SHALL go when the pointer leaves the column (drawn as new-job-pick; Jack, 16 Oct). It SHALL NOT show outside choosing a time.

#### Scenario: Pointing at Tuesday 10:00
- **WHEN** staff press New job and move the pointer over Tuesday at 10:00
- **THEN** a highlighted slot reading "10:00" shows there, and goes when the pointer leaves Tuesday

#### Scenario: Not choosing a time
- **WHEN** staff move the pointer over the diary without pressing New job
- **THEN** no slot is highlighted

### Requirement: Everything clickable shows the pointing finger
Every button, control acting as a button, select, and label for a field in the new app SHALL show the pointing-finger cursor, as links do, unless it is disabled (Jack, 16 Oct). A job that can be dragged SHALL keep its open-hand cursor.

#### Scenario: A toolbar button
- **WHEN** the pointer is over "Next week" or "New job"
- **THEN** it shows the pointing finger

#### Scenario: A job that can be moved
- **WHEN** the pointer is over a job that can be dragged
- **THEN** it shows the open hand
