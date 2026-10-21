## MODIFIED Requirements

### Requirement: Staff move the bike with book in, collect and reopen
Staff SHALL be able to book an expected bike in, mark a bike in the shop as collected, and bring a collected bike back into the shop. Bringing a bike back SHALL leave the work as it was. Booking in SHALL be refused once the booking has ended (cancelled, declined or expired; see the ended booking requirement); collecting a bike and bringing one back SHALL NOT depend on the booking, because the bike really is there (Jack, 16 Oct, `docs/decisions/2026-10-15-job-page-fixes.md` item 5). A booking request still waiting (pending) can still be booked in.

#### Scenario: Booking in a bike on a cancelled booking
- **WHEN** staff book in the bike for a job whose booking was cancelled
- **THEN** it is refused with the code "illegal" and the bike is still expected

#### Scenario: Collecting a bike on a booking that ended
- **WHEN** a bike is in the shop on a declined booking and staff mark it collected
- **THEN** the bike is collected

#### Scenario: Booking in a booking request
- **WHEN** staff book in the bike for a booking request still waiting
- **THEN** the bike is in the shop

#### Scenario: Collecting a bike that was never booked in
- **WHEN** staff try to collect a bike that is still expected
- **THEN** it is refused, with a message starting "cannot collect a job that is expected"

#### Scenario: A collected bike comes back
- **WHEN** a finished, collected bike is brought back into the shop
- **THEN** the bike is in the shop and the work is still finished

### Requirement: Staff move the work with start, waiting for parts, parts arrived, hold, resume, finish and reopen
Staff SHALL be able to: start work not yet started; put work in progress waiting for parts; mark parts arrived (back in progress); put work on hold from not started, in progress or waiting for parts; resume work on hold (back in progress); finish work in progress; and reopen finished work (back in progress). The work moves SHALL NOT depend on where the bike is. Start, hold of work not yet started, and reopen SHALL be refused once the booking has ended (cancelled, declined or expired; see the ended booking requirement); the other work moves SHALL NOT depend on the booking.

#### Scenario: Starting work before the bike is in
- **WHEN** staff start work on a job whose bike is still expected
- **THEN** the work is in progress

#### Scenario: Starting work on a cancelled booking
- **WHEN** staff start work on a job whose booking was cancelled
- **THEN** it is refused with the code "illegal" and the work is still not started

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

## ADDED Requirements

### Requirement: A booking that has ended can't be booked in or started
Once a job's booking has been cancelled (by the customer or the shop), declined or has expired, book in, start, hold of work not yet started, and work reopen SHALL each be refused as a conflict with the code "illegal" and the words "This booking [was cancelled|was declined|expired], so the job can't be [booked in|started|put on hold|reopened]." The job and its version SHALL be left unchanged (issue #190 A; Jack, 16 Oct, `docs/decisions/2026-10-15-job-page-fixes.md` item 5).

#### Scenario: Starting work on a declined booking
- **WHEN** staff start work on a job whose booking was declined
- **THEN** it is refused with the code "illegal" and "This booking was declined, so the job can't be started."

#### Scenario: Booking in after the customer cancelled
- **WHEN** the customer cancels their booking and staff then book the bike in
- **THEN** it is refused with the code "illegal" and "This booking was cancelled, so the job can't be booked in."

#### Scenario: Putting an expired booking on hold
- **WHEN** staff put a job on hold whose booking expired
- **THEN** it is refused with the code "illegal", "This booking expired, so the job can't be put on hold.", and the work is still not started

#### Scenario: Holding work already under way on an ended booking
- **WHEN** a job's work is in progress and its booking has ended, and staff put it on hold
- **THEN** the work is on hold

#### Scenario: Reopening finished work on an ended booking
- **WHEN** the work on a job is finished and its booking has expired, and staff reopen the work
- **THEN** it is refused with the code "illegal" and the work is still finished

#### Scenario: An ended booking and an out-of-date screen
- **WHEN** staff start work on a job whose booking was cancelled, sending a version older than the job's
- **THEN** it is refused with the code "illegal", not "stale", and the job's version is unchanged
