# Spec Delta

## ADDED Requirements

### Requirement: A request to delete an account goes to Needs attention
Each open request to delete a customer's account SHALL show in Needs attention, for the Owner, as "[name] asked us to delete their account", with "From their account on the website, [date asked] · answer by [date]" under it and Open, which goes to Privacy requests (`ac-today`; coverage walk 12 L1). It SHALL go once the request is done or cancelled.

#### Scenario: Maya asks
- **WHEN** Maya asked from her account to delete it and the request is open
- **THEN** the Owner's Today shows "Maya Patel asked us to delete their account" with when she asked and when it must be answered by, and Open goes to Privacy requests

#### Scenario: cancelled
- **WHEN** Maya cancels her request
- **THEN** the line is gone from Today

#### Scenario: staff
- **WHEN** a member of staff who isn't the Owner opens Today
- **THEN** there is no deletion line
