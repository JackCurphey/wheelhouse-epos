## ADDED Requirements

### Requirement: New job warns when the work won't fit
Once work is chosen on New job, the form SHALL compare the work's length with the chosen mechanic's free time from the chosen start, to the end of that free stretch, on that day (decision 23). When the work is longer, the form SHALL show "Only [n] minutes free at [time] — this job needs [m]. Choose another time, or save anyway and the diary will show the overlap.", or "No free time at [time] — this job needs [m]. …" when the start is in busy time, with a "Find the next free [m] minutes" button. Save job SHALL stay available. The button SHALL move the job to the start of the same mechanic's first free stretch long enough for the work, later that day or on one of the next 60 days, and the warning SHALL go (Jack, 15 Oct); when there is none it SHALL say "[mechanic] has no free [m] minutes in the next 60 days." The Shared queue SHALL get no warning.

#### Scenario: Work longer than the gap
- **WHEN** staff choose a 90-minute Standard service at 10:00 on Tue 6 Oct for Jo Taylor, who is free 09:00–10:30 and from 12:00
- **THEN** the form shows "Only 30 minutes free at 10:00 — this job needs 90. Choose another time, or save anyway and the diary will show the overlap." and Save job is still offered

#### Scenario: Work that fits
- **WHEN** staff choose a 30-minute Brake adjust at the same time
- **THEN** there is no warning

#### Scenario: Finding the next free time the same day
- **WHEN** staff press "Find the next free 90 minutes"
- **THEN** the job moves to Tue 6 Oct 12:00–13:30 with Jo Taylor and the warning goes

#### Scenario: Finding the next free time on a later day
- **WHEN** Jo has no 90-minute gap left on Tue 6 Oct and is free all of Wed 7 Oct, and staff press "Find the next free 90 minutes"
- **THEN** the job moves to Wed 7 Oct 09:00–10:30 with Jo Taylor

#### Scenario: Saving anyway
- **WHEN** staff save with the warning showing
- **THEN** the job is saved at the time chosen

#### Scenario: The Shared queue
- **WHEN** the mechanic is the Shared queue
- **THEN** there is no warning
