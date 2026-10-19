## ADDED Requirements

### Requirement: A booking confirmed straight away is marked New, booked online
A booking confirmed automatically SHALL sit in the diary as a normal booking, marked "New, booked online" until someone opens it; it SHALL NOT be listed in Waiting for you (Jack, 19 Oct, answer 1).

#### Scenario: Seen once opened
- **WHEN** a booking arrives confirmed and Jo opens the job
- **THEN** the diary no longer marks it as new
