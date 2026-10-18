## ADDED Requirements

### Requirement: Paying for a job records its sign-off, and never refuses over it
Paying a job's order that finishes its work SHALL record the sign-off sent with the payment (answer 5). A sign-off that is no longer valid SHALL NOT refuse the payment: the work finishes unsigned and the reply warns. A payment sent with no sign-off finishes the work unsigned, as before.

#### Scenario: Signed at the till
- **WHEN** WH-1042, in progress, is paid with Alex Morgan signing off
- **THEN** the sale is made, the work is finished, and the job records Alex Morgan

#### Scenario: The mechanic was made inactive meanwhile
- **WHEN** the payment names a mechanic who is no longer active
- **THEN** the sale stands, the work is finished unsigned, and the reply warns "Paid and finished, but not signed off"
