## ADDED Requirements

### Requirement: A job's online deposit comes off at the till

When a job's deposit was paid online and hasn't been refunded, kept or given
back, paying the job's order at the till SHALL take the deposit off what's
due. The till SHALL show a "Deposit paid" line and take only what's left,
and the sale SHALL record the deposit as its own payment, "Deposit paid
online", for the amount the server holds.

#### Scenario: Collecting with a deposit paid
- **WHEN** Maya's £65.00 job had a £13.00 deposit paid online, and Jo takes payment
- **THEN** the till shows Deposit paid −£13.00 and asks for £52.00, and the sale records £13.00 Deposit paid online and £52.00 by card

#### Scenario: A refunded deposit
- **WHEN** the deposit was refunded before Maya collects
- **THEN** nothing comes off, and the till asks for £65.00
