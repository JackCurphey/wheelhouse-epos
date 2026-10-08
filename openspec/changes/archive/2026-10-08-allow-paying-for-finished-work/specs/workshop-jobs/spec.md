## MODIFIED Requirements

### Requirement: Paying for a job's order finishes the work only when finishing is allowed
When a job's linked order is paid at the till, the job's work SHALL be finished as part of the same act. If the work is already finished, the payment SHALL go through and the job SHALL be left as it is. If the work cannot be finished from its current state, the payment SHALL be refused before any sale is made, with the code "illegal" and the same "cannot finish a job that is [state]; from here you can [moves]" message.

#### Scenario: Paying for work in progress
- **WHEN** a job's work is in progress and its order is paid
- **THEN** the sale is made and the job's work is finished

#### Scenario: Paying for work that never started
- **WHEN** a job's work has not started and its order is paid
- **THEN** the payment is refused with a message containing "cannot finish a job that is not_started", and no sale is made

#### Scenario: Paying for work on hold
- **WHEN** a job's work is on hold and its order is paid
- **THEN** the payment is refused with a message naming "resume"; after staff resume the work, the same payment goes through

#### Scenario: Paying for work already finished
- **WHEN** a job's work is already finished ("Mark ready for collection") and its order is paid
- **THEN** the sale is made, the job's work stays finished, and the job is not changed again

#### Scenario: The job moves while the payment is going through
- **WHEN** the work could be finished when the payment was checked, but someone moved the job before it was finished
- **THEN** the sale stands, the job is not moved, and the reply carries a warning saying why
