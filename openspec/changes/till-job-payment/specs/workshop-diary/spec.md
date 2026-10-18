## ADDED Requirements

### Requirement: The job menu opens the job's order in the till
"Job actions" SHALL offer "Open in the till", opening the till with the job's order (Jack, 18 Oct). It SHALL be greyed with its reason underneath: "Not booked yet" on a booking request, "Already paid" once the order is paid, "No order on this job" without one.

#### Scenario: A booked job
- **WHEN** staff choose "Open in the till" on a booked job with an unpaid order
- **THEN** the till opens with that job

#### Scenario: A booking request
- **WHEN** staff open a booking request's menu
- **THEN** "Open in the till" is greyed, reading "Not booked yet"
