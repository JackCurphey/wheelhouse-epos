## ADDED Requirements

### Requirement: A supplier order line can be for a Cycle to Work order
A line on a supplier order SHALL be able to belong to a Cycle to Work order, and receiving SHALL show it "for [Customer] · Cycle to Work — put it aside".

#### Scenario: Booking the bike in holds its frame
- **WHEN** the bike is booked in with its frame number
- **THEN** that frame is held for the order, not for sale, and the order moves to "Ready to collect" when its certificate is in, with "Open the order"
