## ADDED Requirements

### Requirement: Finishing the work records who signed it off
Finishing the work ("Mark ready for collection") SHALL ask "Who’s signing this off?" with the shop's mechanics as pills, the job's own mechanic picked, or nobody on a shared-queue job (Jack, 16 Oct, answers 1, 2, 6, 7). The server SHALL refuse to finish without an active mechanic, and SHALL record who signed off and when.

#### Scenario: Alex signs off WH-1042
- **WHEN** WH-1042, Alex Morgan's job, is marked ready and Alex Morgan stays picked
- **THEN** the work is finished and the job records Alex Morgan and the time

#### Scenario: A shared-queue job
- **WHEN** a job with no mechanic is marked ready
- **THEN** nobody is picked and "Sign off and mark ready" waits until someone is

#### Scenario: No one chosen
- **WHEN** finish is sent without a mechanic
- **THEN** the server refuses with "Choose who is signing this off" and the work stays in progress

### Requirement: Staff see who signed a job off
The finished job page SHALL show "Signed off by [name] · [day], [time]" (answer 3, staff side).

#### Scenario: The finished page
- **WHEN** WH-1042 was signed off by Alex Morgan on Thu 17 Sep at 15:30
- **THEN** its page shows "Signed off by Alex Morgan · Thu 17 Sep, 15:30"

### Requirement: Reopening the work clears the sign-off and keeps it in the history
Reopening the work SHALL clear the job's sign-off, so finishing again asks again; the earlier sign-off SHALL stay in the job's sign-off history (answer 4).

#### Scenario: Reopened
- **WHEN** a signed-off job's work is reopened
- **THEN** the job shows no sign-off, and the history still holds the earlier one, marked cleared
