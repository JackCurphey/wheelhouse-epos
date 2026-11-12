## ADDED Requirements

### Requirement: The customer page shows Cycle to Work orders
A customer's page SHALL list each of their Cycle to Work orders as "Cycle to Work · [Bike] · [stage]" with "Quote [quote number] · [Provider] · held until [date]", opening the order.

#### Scenario: A collected order
- **WHEN** the customer's bike was collected
- **THEN** the row shows the order at "Collected"
