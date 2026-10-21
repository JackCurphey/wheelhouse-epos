## MODIFIED Requirements

### Requirement: Staff move a booking with accept, decline, request reschedule, cancel and expire
Staff SHALL be able to: accept a pending booking or a reschedule request (it becomes scheduled); decline a pending booking (declined) or a reschedule request (back to scheduled); ask to reschedule a scheduled booking; cancel a pending, scheduled or reschedule-requested booking; and mark a pending booking expired. Declined, expired and cancelled SHALL be final: no action or save reopens them.

#### Scenario: Accepting a booking request
- **WHEN** staff accept a pending booking
- **THEN** it becomes scheduled and its version goes up by one

#### Scenario: Declining a reschedule request
- **WHEN** staff ask to reschedule a scheduled job and then decline that request
- **THEN** the booking is scheduled again

#### Scenario: A declined booking is final
- **WHEN** staff decline a pending booking and then try to accept it
- **THEN** the accept is refused

#### Scenario: A cancelled job is kept
- **WHEN** staff cancel a scheduled job
- **THEN** the booking is cancelled and the job can still be read

### Requirement: Staff move the bike with book in, collect and reopen
Staff SHALL be able to book an expected bike in, mark a bike in the shop as collected, and bring a collected bike back into the shop. Bringing a bike back SHALL leave the work as it was. Booking a bike in SHALL be refused once its booking was cancelled, declined or expired (issue #190 A); a pending request MAY still be booked in, and a bike already in the shop on an ended booking MAY still be collected, because it really is there (decision 5, `docs/decisions/2026-10-15-job-page-fixes.md`).

#### Scenario: Booking in a bike on a cancelled booking
- **WHEN** staff book in the bike for a job whose booking was cancelled
- **THEN** it is refused with "This booking was cancelled, so the job can't be booked in.", and the bike is still expected

#### Scenario: A bike in the shop on an ended booking
- **WHEN** a bike is in the shop and its booking is then cancelled, and staff mark it collected
- **THEN** the bike is collected

#### Scenario: Collecting a bike that was never booked in
- **WHEN** staff try to collect a bike that is still expected
- **THEN** it is refused, with a message starting "cannot collect a job that is expected"

#### Scenario: A collected bike comes back
- **WHEN** a finished, collected bike is brought back into the shop
- **THEN** the bike is in the shop and the work is still finished

### Requirement: Staff move the work with start, waiting for parts, parts arrived, hold, resume, finish and reopen
Staff SHALL be able to: start work not yet started; put work in progress waiting for parts; mark parts arrived (back in progress); put work on hold from not started, in progress or waiting for parts; resume work on hold (back in progress); finish work in progress; and reopen finished work (back in progress). The work moves SHALL NOT depend on where the bike is. Starting, holding and reopening SHALL be refused once the booking was cancelled, declined or expired (issue #190 A), with "This booking was [state], so the job can't be [started / put on hold / reopened]."

#### Scenario: Starting work before the bike is in
- **WHEN** staff start work on a scheduled job whose bike is still expected
- **THEN** the work is in progress

#### Scenario: Starting work on a cancelled booking
- **WHEN** staff start work on a job whose booking was cancelled
- **THEN** it is refused with "This booking was cancelled, so the job can't be started.", and the work is not started

#### Scenario: Reopening finished work on an ended booking
- **WHEN** a job's work is finished and its booking ended, and staff reopen the work
- **THEN** it is refused, and the work stays finished

#### Scenario: Waiting for parts
- **WHEN** staff start a job's work and then mark it waiting for parts
- **THEN** the work is waiting for parts

#### Scenario: Hold and resume
- **WHEN** staff start a job's work, put it on hold, and resume it
- **THEN** the work is on hold after the hold and in progress after the resume

#### Scenario: Resuming work that is not on hold
- **WHEN** staff try to resume work that has not started
- **THEN** it is refused, with a message starting "cannot resume a job that is not_started"

#### Scenario: Finishing work that never started
- **WHEN** staff try to finish work that has not started
- **THEN** it is refused, the message names "start" as the way on, and nothing changes
