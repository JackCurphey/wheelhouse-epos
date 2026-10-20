## ADDED Requirements

### Requirement: An order's workshop job opens in the diary
The diary SHALL open a job's page when its address names the job (`job`), and SHALL open New job filled in from an order when its address names the order (`order`), linking the saved job to that order. Each SHALL be read once and dropped from the address.

#### Scenario: Viewing an order's job
- **WHEN** staff press "View / edit workshop job" on an order
- **THEN** the diary opens on the job's day with the job's page open

#### Scenario: Putting an order in the diary
- **WHEN** staff tick "Show in workshop diary" on an order and save the New job that opens
- **THEN** New job had the order's title, customer and note, and the saved job is linked to the order

#### Scenario: The link is refused
- **WHEN** the order refuses the link after the job is saved
- **THEN** the form closes and the diary says the job is saved but not linked, with the reason
