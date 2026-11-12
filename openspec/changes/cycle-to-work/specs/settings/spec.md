## ADDED Requirements

### Requirement: The Cycle to Work settings room
Settings › Front desk SHALL have Cycle to Work, with "Holding and ordering bikes, deposits, and the scheme providers you work with." and the folds Holding bikes and quotes, Bikes not in stock, How to apply, Deposits, Scheme providers and On Today.

#### Scenario: Saving the How to apply words
- **WHEN** the shop saves its How to apply words
- **THEN** they print on every quote and in the "Your bike is put aside" email

### Requirement: The deposit choice waits for till deposits
"Straight away, with a deposit" SHALL not be offered until the till can take a deposit against an order.

#### Scenario: Before till deposits exist
- **WHEN** the shop opens Bikes not in stock
- **THEN** it can choose "Once the certificate arrives" or "Once the customer has applied" only
