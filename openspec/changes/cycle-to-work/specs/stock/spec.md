## ADDED Requirements

### Requirement: A bike held for Cycle to Work is not for sale
A frame held for a Cycle to Work order SHALL not count as available stock: the till search and the Stock page SHALL show it as "Held for [Customer] until [date] · Cycle to Work — not for sale", and the website SHALL show the bike as sold out when no other frame is free.

#### Scenario: The only frame is held
- **WHEN** the only frame of a bike is held for an order
- **THEN** the website shows the bike as sold out and the till won't sell that frame

#### Scenario: Releasing makes it sellable
- **WHEN** the hold is released
- **THEN** the frame counts as available again
