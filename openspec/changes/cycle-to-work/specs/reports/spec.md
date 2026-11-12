## ADDED Requirements

### Requirement: The Cycle to Work report
"Cycle to Work: owed and paid" SHALL show tiles Owed now, Paid, Commission and Shortfalls closed, and "Cycle to Work by provider" with Provider, Bikes collected, Owed now, Paid, Commission and Late. Paid and commission SHALL be counted on the day each order is marked paid.

#### Scenario: Counted on the day marked paid
- **WHEN** an order collected in one month is marked paid in the next
- **THEN** its payment and commission count in the next month

### Requirement: Cycle to Work in the accounts mapping
The accounts mapping SHALL add "Cycle to Work (owed by providers)", "Cycle to Work commission" and "Cycle to Work shortfalls".

#### Scenario: The three rows
- **WHEN** the shop opens the accounts mapping
- **THEN** the three Cycle to Work rows are listed
