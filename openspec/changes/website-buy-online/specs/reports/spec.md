## ADDED Requirements

### Requirement: Online order refunds come off on the day they are made
A refund of an online order, whole or one item, SHALL be taken off sales and VAT on the day it is made, not on the day the order was paid, and SHALL be kept with its reason and who made it.

#### Scenario: Refunded the next week
- **WHEN** an order paid on one day is cancelled and refunded a week later
- **THEN** the order's sale counts on the day it was paid and the refund comes off on the day it was made
