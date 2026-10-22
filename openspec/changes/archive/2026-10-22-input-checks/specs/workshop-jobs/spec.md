## MODIFIED Requirements

### Requirement: A job links only to a real customer, that customer's bike and a working mechanic
A job MAY be linked to a customer, a bike and a mechanic, each optional. The customer SHALL be an active customer, the mechanic an active staff member who is a mechanic, sent as a whole number (never as text, a fraction, true or a number too big to be anyone's), and the bike an active bike belonging to the job's customer. When a job's customer changes and no bike is given, a bike that no longer belongs to the customer SHALL be dropped from the job rather than the change being refused.

#### Scenario: A customer that does not exist or is inactive
- **WHEN** staff create or edit a job with a customer who is not active
- **THEN** it is refused with "Customer not found or inactive"

#### Scenario: Someone else's bike
- **WHEN** staff link a job to a bike that belongs to a different customer
- **THEN** it is refused with "That bike doesn't belong to the selected customer"

#### Scenario: A bike that is not active
- **WHEN** staff link a job to a bike that does not exist or is inactive
- **THEN** it is refused with "Bike not found or inactive"

#### Scenario: A mechanic who is not a working mechanic
- **WHEN** staff give a mechanic who is inactive or not a mechanic
- **THEN** it is refused with "Mechanic not found or inactive"

#### Scenario: A mechanic that is not a whole number
- **WHEN** staff create or save a job with the mechanic sent as "abc", 1.5, true, a number written as text, or a number too big to be anyone
- **THEN** it is refused with "Mechanic not found or inactive", not a server error, and the job keeps its mechanic

#### Scenario: Changing the customer drops the old customer's bike
- **WHEN** staff change a job's customer without saying which bike
- **THEN** the job keeps no bike that belongs to someone else, and the change is not refused

### Requirement: Finishing the work records who signed it off
Finishing the work ("Mark ready for collection") SHALL ask "Who’s signing this off?" with the shop's mechanics as pills, the job's own mechanic picked, or nobody on a shared-queue job (Jack, 16 Oct, answers 1, 2, 6, 7). The server SHALL refuse to finish without an active mechanic, and SHALL record who signed off and when. A mechanic deleted or switched off while the job is being finished SHALL get the same refusal, never a server error, and nothing SHALL move.

#### Scenario: Alex signs off WH-1042
- **WHEN** WH-1042, Alex Morgan's job, is marked ready and Alex Morgan stays picked
- **THEN** the work is finished and the job records Alex Morgan and the time

#### Scenario: A shared-queue job
- **WHEN** a job with no mechanic is marked ready
- **THEN** nobody is picked and "Sign off and mark ready" waits until someone is

#### Scenario: No one chosen
- **WHEN** finish is sent without a mechanic
- **THEN** the server refuses with "Choose who is signing this off" and the work stays in progress

#### Scenario: The mechanic is deleted as the job is finished
- **WHEN** the Owner deletes or switches off the mechanic picked to sign off at the moment staff mark the job ready
- **THEN** the server refuses with "Choose who is signing this off", the work stays in progress and no sign-off is recorded

### Requirement: A shop chooses whether customers see who signed off
A shop setting, "Show who signed off to customers", SHALL start off (Jack, 16 Oct, answer 3), and SHALL be changed in Settings › Workshop › Mechanics. While it is off, customers SHALL NOT see who signed a job off. It SHALL be set only by a real true or false; anything else (the text "false", 1, null) SHALL be refused and leave it as it was.

#### Scenario: Off to start
- **WHEN** a new shop's workshop settings are read
- **THEN** "Show who signed off to customers" is off

#### Scenario: A sloppy value
- **WHEN** the setting is off and a request sends it as the text "false"
- **THEN** it is refused with "showSignOffToCustomers must be true or false" and the setting stays off
