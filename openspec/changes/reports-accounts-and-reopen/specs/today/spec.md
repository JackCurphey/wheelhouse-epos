# Spec Delta

## ADDED Requirements

### Requirement: A day that didn't go to the accounts software goes to Needs attention
A closed day that couldn't be sent SHALL be a line in Needs attention for the Owner: "[Wednesday 16 September] didn't go to [Xero]", with "[Bolton] · closed at [time] · [Category] has no Xero account chosen" and "Choose an account for [Category]", which opens that choice. It SHALL go once the day is sent.

#### Scenario: Wednesday didn't go
- **WHEN** Wednesday was closed with Accessories sales and Accessories has no account
- **THEN** Today shows "Wednesday 16 September didn't go to Xero" with "Choose an account for Accessories"

#### Scenario: it clears
- **WHEN** Jack chooses the account and Wednesday goes across
- **THEN** the line is gone

### Requirement: A reopened day goes to Needs attention with Close it
A reopened day SHALL be a line in Needs attention, with Close it opening Close the day for that day, until it is closed again.

#### Scenario: Wednesday reopened
- **WHEN** Wednesday is reopened
- **THEN** Today lists it as reopened, with Close it
