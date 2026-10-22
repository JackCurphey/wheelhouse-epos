## MODIFIED Requirements

### Requirement: Staff move a booking with accept, decline, request reschedule, cancel and expire
Staff SHALL be able to: accept a pending booking or a reschedule request (it becomes scheduled); decline a pending booking (declined) or a reschedule request (back to scheduled); ask to reschedule a scheduled booking; cancel a pending, scheduled or reschedule-requested booking; and mark a pending booking expired. Declined, expired and cancelled are final: no action reopens them, and nor does saving the job, because a save can't carry a status (see the requirement on creating and saving with an old status).

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

#### Scenario: A save can't reopen a cancelled booking
- **WHEN** staff save a cancelled job with the status "scheduled"
- **THEN** it is refused and the booking stays cancelled
