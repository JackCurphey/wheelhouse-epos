## ADDED Requirements

### Requirement: A workshop job is paid only at the till
A payment for a workshop job's order that doesn't answer who signed the work off SHALL be refused, with nothing sold. The old app's "Load into sale" and "Convert to sale" on a job's order SHALL open the till for that job instead.

#### Scenario: The old app tries to take a job's payment
- **WHEN** staff press Convert to sale, or Load into sale, on a workshop job's order in the old app
- **THEN** the till opens for that job, where it asks who is signing it off

#### Scenario: A payment with no sign-off answer
- **WHEN** a job's order is paid with no answer to the sign-off question
- **THEN** it is refused with `use_till`, nothing is sold, and the job is as it was
