## ADDED Requirements

### Requirement: A job has its service's checklist
A job SHALL have the checklist of the first of its services that has one: the online booking's services in order, then the services on its order. A job with no such service SHALL have none, and its page SHALL show no checklist bar.

#### Scenario: A full service gets its checklist
- **WHEN** Standard service uses the Full service checklist and a job is booked for it
- **THEN** the job page shows "Full service checklist" with "0 of 10 done"

### Requirement: Staff tick a job's checklist and note any item
The job page SHALL show the checklist bar with "[n] of [n] done · [n] note(s)" and open the checklist, where staff tick each item and add a note to any item (`job-mechanic`, `job-checklist`; Workshop day 21, 39, 58). Ticks and notes SHALL be refused once the work is finished, until it is reopened.

#### Scenario: Ticking and a note
- **WHEN** a mechanic ticks Frame & fork and writes "The rear pads are worn." on Brakes bled & adjusted
- **THEN** the bar reads "1 of 10 done · 1 note"

#### Scenario: Finished work is frozen
- **WHEN** the work is finished and someone ticks an item
- **THEN** it is refused until the work is reopened

### Requirement: A job keeps the checklist it began with
The first tick or note SHALL copy the checklist onto the job, so a later change in Settings leaves that job's checklist as it was.

#### Scenario: Settings change after the first tick
- **WHEN** a job's checklist has a tick, and the Owner then removes an item in Settings
- **THEN** the job still has all ten items

### Requirement: New job remembers its service
A job made with New job SHALL record the service chosen, as an online booking records its services, so its checklist can be found.

#### Scenario: A staff job with a service
- **WHEN** staff make a job for Standard service, which uses the Full service checklist
- **THEN** the job has the Full service checklist
