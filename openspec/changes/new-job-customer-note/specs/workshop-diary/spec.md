## ADDED Requirements

### Requirement: New job keeps what the customer told us
New job SHALL take a "Note for the customer", what the customer tells us about the problem, keep it as the job's "From the customer", and print it on the job's receipt; staff notes SHALL stay in their own box (Jack, 20 Oct).

#### Scenario: A walk-in describes the problem
- **WHEN** staff type "Rear brake squeals and feels weak." in Note for the customer and save the job
- **THEN** the job page shows it under From the customer, and the job's receipt prints "From the customer: Rear brake squeals and feels weak." under the job and bike

#### Scenario: Nothing from the customer
- **WHEN** the box is left empty
- **THEN** the job has nothing from the customer and the receipt prints no such line
