## ADDED Requirements

### Requirement: The confirmed booking page follows its drawing
A confirmed booking's page SHALL show "Your repair · [reference]" above a heading naming the bike and the work, then a card with the "Booking confirmed" badge, when to drop the bike off and the shop's note, the Service, Bike, When and Your repair rows, and the shop's name (drawn as bk-page; Jack, 19 Oct).

#### Scenario: Maya's confirmed booking
- **WHEN** Maya's Standard service on her Trek Domane AL 3 is confirmed
- **THEN** her page is headed "Trek Domane AL 3 · Standard service", under "Your repair · WH-1042", with the badge "Booking confirmed"

#### Scenario: Another stage
- **WHEN** the booking is still waiting for the shop
- **THEN** the page is headed "Awaiting shop confirmation", as before
