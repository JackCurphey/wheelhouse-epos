## ADDED Requirements

### Requirement: The till asks who is signing off a job its payment finishes
When a job's work is still in progress, Take payment SHALL first ask "Who’s signing this off?", the same pop-up as Mark ready for collection, with the job's mechanic picked (Jack, 16 Oct, answer 5). Signing off SHALL open the payment, which records the sign-off; Cancel SHALL take nothing. Work already finished SHALL be paid without asking.

#### Scenario: Paying for work in progress
- **WHEN** WH-1042's work is in progress and staff press Take payment
- **THEN** the till asks who is signing it off, with Alex Morgan picked, before the payment opens

#### Scenario: Paying for finished work
- **WHEN** WH-1042 was already marked ready and signed off
- **THEN** Take payment opens the payment straight away
