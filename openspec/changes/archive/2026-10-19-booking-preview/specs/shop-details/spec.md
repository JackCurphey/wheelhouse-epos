## ADDED Requirements

### Requirement: The owner can preview what the customer sees
Settings › Workshop › Online booking SHALL have a Preview button that shows the booking-confirmed page for an example booking, using the shop's current settings: the drop-off time, the additional note and whether prices show (Jack, 19 Oct).

#### Scenario: The shop's own note
- **WHEN** the owner has saved the note "Park round the back and ring the bell." and presses Preview
- **THEN** the pop-up shows the example booking's drop-off time followed by "Park round the back and ring the bell."

#### Scenario: Prices off
- **WHEN** prices are not shown on the booking page
- **THEN** the preview's Service row shows "Standard service" with no price
