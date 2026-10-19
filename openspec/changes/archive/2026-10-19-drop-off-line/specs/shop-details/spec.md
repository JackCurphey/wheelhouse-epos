## ADDED Requirements

### Requirement: The shop sets how long before a booking bikes come in
Settings › Workshop › Online booking SHALL hold "Drop off before the booking", in minutes, while bikes are booked in for a set time (Jack, 19 Oct). It SHALL save when the box is left.

#### Scenario: An hour before
- **WHEN** the owner sets Drop off before the booking to 60
- **THEN** a customer booked at 11:30 is told to drop off by 10:30, an hour before
