## ADDED Requirements

### Requirement: Header search finds Cycle to Work orders
Header search SHALL find Cycle to Work orders by customer name and quote number, in a "Cycle to Work orders" group with "Open the order".

#### Scenario: Found by quote number
- **WHEN** staff type a quote number
- **THEN** that order is listed under "Cycle to Work orders"
