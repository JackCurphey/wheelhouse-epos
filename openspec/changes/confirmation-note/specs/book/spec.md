## ADDED Requirements

### Requirement: The booking page shows the shop's additional note
Once a booking stands (confirmed, or a change to it waiting), the customer's booking page SHALL show the shop's additional note after the drop-off sentence (Jack, 19 Oct): "Drop your Trek Domane AL 3 off by 11:00, half an hour before your booking at 11:30. Please bring the lock key, and tell us about any accessories."

#### Scenario: A confirmed booking
- **WHEN** Maya's booking is confirmed and the shop's note is "Please bring the lock key, and tell us about any accessories."
- **THEN** her booking page shows the note after when to drop the bike off

#### Scenario: Not confirmed yet
- **WHEN** the booking is still waiting for the shop to accept it
- **THEN** the page doesn't show the note

#### Scenario: No note
- **WHEN** the shop has emptied its note
- **THEN** the booking page shows only when to drop the bike off
