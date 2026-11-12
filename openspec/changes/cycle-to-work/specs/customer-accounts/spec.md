## ADDED Requirements

### Requirement: The customer's account shows their Cycle to Work order
A signed-in customer's account SHALL show each Cycle to Work order as "[Bike] · [stage]" with "Quote [quote number] · put aside until [date]" and "What you pay at collection: £[£]", and never commission or staff names.

#### Scenario: Only their own orders
- **WHEN** a customer signs in
- **THEN** they see only their own Cycle to Work orders
