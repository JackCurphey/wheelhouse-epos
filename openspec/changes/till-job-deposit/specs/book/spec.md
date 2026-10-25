## ADDED Requirements

### Requirement: The booking page's "to pay" takes every deposit off

Before the job is paid, the booking page's "To pay when you collect" SHALL be
what the till will charge: the job's order, less any deposit paid online that
counts and every deposit taken at the till and not refunded. With "Show
prices on the booking page" off, the figure SHALL stay hidden, as now.

#### Scenario: A deposit taken at the till
- **WHEN** Maya's £111.00 job had £27.75 taken at the till and her bike is ready
- **THEN** her booking page says "To pay when you collect £83.25"

#### Scenario: The deposit refunded
- **WHEN** the £27.75 deposit is refunded on the job before she collects
- **THEN** her booking page says "To pay when you collect £111.00"
