## MODIFIED Requirements
### Requirement: Staff move the work with start, waiting for parts, parts arrived, hold, resume, finish and reopen
Staff SHALL be able to: start work not yet started; put work in progress waiting for parts; mark parts arrived (back in progress); put work on hold from not started, in progress or waiting for parts; resume work on hold (back in progress); finish work in progress; and reopen finished work (back in progress). The work moves SHALL NOT depend on where the bike is. Starting, holding, resuming and reopening SHALL be refused once the booking was cancelled, declined or expired (issue #190 A), with "This booking [was cancelled / was declined / expired], so the job can't be [started / put on hold / resumed / reopened]."

#### Scenario: Starting work before the bike is in
- **WHEN** staff start work on a scheduled job whose bike is still expected
- **THEN** the work is in progress

#### Scenario: Starting work on a cancelled booking
- **WHEN** staff start work on a job whose booking was cancelled
- **THEN** it is refused with "This booking was cancelled, so the job can't be started.", and the work is not started

#### Scenario: Reopening finished work on an ended booking
- **WHEN** a job's work is finished and its booking ended, and staff reopen the work
- **THEN** it is refused, and the work stays finished

#### Scenario: Resuming held work on an ended booking
- **WHEN** a job's work is on hold and its booking ended, and staff resume the work
- **THEN** it is refused with "…so the job can't be resumed.", and the work stays on hold

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
