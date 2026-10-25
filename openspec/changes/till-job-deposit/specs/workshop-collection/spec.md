## ADDED Requirements

### Requirement: A message's "What's left to pay" takes every deposit off

In Bike ready and Bike still waiting, "[What’s left to pay]" and "[Amount to
pay]" SHALL be what the till will charge when the message goes: the job's
order, less any deposit paid online that counts and every deposit taken at
the till and not refunded.

#### Scenario: Bike ready after a deposit at the till
- **WHEN** Maya's £111.00 job had £27.75 taken at the till and the work is marked ready
- **THEN** Bike ready says "£83.25 to pay on collection"

#### Scenario: Bike still waiting after the deposit is refunded
- **WHEN** the deposit is refunded before "Bike still waiting" goes
- **THEN** it says "£111.00 to pay on collection"
