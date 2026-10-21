## MODIFIED Requirements

### Requirement: Paying for a job records its sign-off, and never refuses over it
Paying a job's order that finishes its work SHALL record the sign-off sent with the payment (answer 5). A sign-off that is no longer valid SHALL NOT refuse the payment: the work finishes unsigned and the reply warns. A payment that doesn't answer the sign-off question at all SHALL be refused with `use_till`, and nothing sold: only the old app sends none, and it never takes a job's payment (Jack, 21 Oct, `docs/decisions/2026-10-21-old-app-placeholder.md`).

#### Scenario: Signed at the till
- **WHEN** WH-1042, in progress, is paid with Alex Morgan signing off
- **THEN** the sale is made, the work is finished, and the job records Alex Morgan

#### Scenario: The mechanic was made inactive meanwhile
- **WHEN** the payment names a mechanic who is no longer active
- **THEN** the sale stands, the work is finished unsigned, and the reply warns "Paid and finished, but not signed off"

#### Scenario: No answer to the sign-off question
- **WHEN** a job's order is paid with no answer to who signed it off, its work in progress or finished
- **THEN** it is refused with `use_till`, nothing is sold, and the job is as it was
