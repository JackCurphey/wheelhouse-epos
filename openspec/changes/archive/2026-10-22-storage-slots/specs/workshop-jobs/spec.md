## ADDED Requirements

### Requirement: A bike's slot is chosen at book-in and cleared at collection
When the shop's storage slots are on, booking a bike in SHALL offer "Where the bike is kept" with the shop's slots; choosing one SHALL be optional. While the bike is in the shop its slot SHALL be changeable; collecting it SHALL clear the slot. A job not yet booked in SHALL have no slot.

#### Scenario: Booked in on Hook 3
- **WHEN** staff book Maya Patel's bike in and choose Hook 3
- **THEN** the job page reads "Kept on Hook 3"

#### Scenario: Collected
- **WHEN** the bike on Hook 3 is collected
- **THEN** the job has no slot

#### Scenario: Not in the shop
- **WHEN** staff try to put a bike that isn't in the shop on a slot
- **THEN** it is refused

### Requirement: The workshop shows where each bike is kept
The job page SHALL show "Kept on [slot]" for a bike in the shop with a slot, the Overview's Custody column SHALL read "Kept on [slot]" for one, and a diary block SHALL show the slot where there's room. With slots off, none of these SHALL show.

#### Scenario: The Overview
- **WHEN** a bike is in the shop on Hook 3
- **THEN** its Custody reads "Kept on Hook 3"
