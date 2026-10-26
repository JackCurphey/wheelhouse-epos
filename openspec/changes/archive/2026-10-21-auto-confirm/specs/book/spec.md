## ADDED Requirements

### Requirement: A booking is confirmed straight away when the shop confirms automatically
When the shop confirms online bookings automatically, a booking that fits the diary SHALL be confirmed when sent: step 4's button reads "Confirm booking", and the customer's booking page shows it confirmed at once (Jack, 1 Oct, decision 8; 19 Oct).

#### Scenario: Confirmed at once
- **WHEN** the shop confirms automatically and Maya books a time that fits
- **THEN** her booking page shows "Confirmed", with when to drop the bike off

#### Scenario: The shop answers each request
- **WHEN** the shop doesn't confirm automatically
- **THEN** step 4's button reads "Request booking" and the booking waits for the shop to accept it
