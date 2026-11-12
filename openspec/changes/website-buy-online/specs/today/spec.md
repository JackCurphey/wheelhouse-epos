## ADDED Requirements

### Requirement: New online orders go to Needs attention
When orders are waiting in To get ready, Needs attention SHALL show "[n] new online orders" with "To get ready · oldest from [time]" and "Open Online orders". It SHALL show to the Owner until roles exist, as the other Needs attention lines do.

#### Scenario: Two to get ready
- **WHEN** two paid orders are in To get ready
- **THEN** Today shows "2 new online orders" with the oldest one's time and Open Online orders

#### Scenario: Nothing to get ready
- **WHEN** no order is in To get ready
- **THEN** there is no online orders line

### Requirement: An order not collected goes to Needs attention with Contacted and Open
An order that has reached its keep date SHALL show "Order [order number] · Maya Patel — not collected" with "Ready since [date] · kept until today · reminder sent [date] · 07700 900 142", Contacted and Open. Contacted SHALL record who and when and take the line off, as for bikes not collected.

#### Scenario: Not collected
- **WHEN** Maya's order reaches its keep date uncollected
- **THEN** Today shows it with Contacted and Open

#### Scenario: Contacted
- **WHEN** the Owner presses Contacted
- **THEN** the line goes and who pressed it and when are kept on the order
