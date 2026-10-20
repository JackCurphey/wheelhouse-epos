## ADDED Requirements

### Requirement: A booking waiting for the shop opens as a request
A booking the shop hasn't accepted SHALL show "Your booking request" with the "Waiting for the shop to confirm" badge, its rows, and Change the date and Cancel request while it can be changed or cancelled online (Jack, 1 Oct, decisions 10 and 12; 20 Oct).

#### Scenario: Moving a request
- **WHEN** Maya moves her request to Friday at 14:00
- **THEN** it moves straight away, still waiting for the shop to confirm

#### Scenario: Cancelling a request
- **WHEN** she presses Cancel request and confirms
- **THEN** her page says it is cancelled
