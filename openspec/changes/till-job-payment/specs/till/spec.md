## ADDED Requirements

### Requirement: The till pays a workshop job's order
Opened with a job (Jack, 18 Oct, `docs/decisions/2026-10-18-till-job-payment.md`), the till SHALL show the job's order lines locked, each marked "agreed on the job", with the customer and job, and "Bike collected when paid", on by default while the bike is in the shop. Take payment SHALL pay the whole order at the amount due, the order's and the customer's group discounts taken off, selling past zero stock with "Stock says [n] — sold anyway" (answer 3). Then, unless the pill is off, it SHALL record the bike as collected.

#### Scenario: Paying for a finished job
- **WHEN** staff open WH-1042 in the till and pay its £83.00 by card
- **THEN** the order is paid, the job stays finished, and the bike is recorded as collected

#### Scenario: The bike stays
- **WHEN** staff switch off "Bike collected when paid" and pay
- **THEN** the order is paid and the bike stays in the shop

### Requirement: The till says when a job can't be paid
An order already paid SHALL say "This job’s order is already paid." with nothing to take. Work not yet in progress or finished SHALL say "The work isn’t finished, so this job can’t be paid yet." with Take payment unavailable.

#### Scenario: Work not started
- **WHEN** the job's work hasn't started
- **THEN** the till says "The work isn’t finished, so this job can’t be paid yet." and Take payment can't be pressed

#### Scenario: A discount
- **WHEN** Maya Patel is in Blue Light (10%) and her order has £2.00 off
- **THEN** the till shows both discounts and asks the card machine for the amount due, not the lines' sum
