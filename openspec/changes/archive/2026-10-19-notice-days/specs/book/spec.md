## ADDED Requirements

### Requirement: Notice can be in whole days
When a shop sets its notice in days, customers SHALL be able to book from the start of the day that many days ahead, whatever the time now (Jack, 19 Oct). Notice in hours SHALL stay counted from now.

#### Scenario: 3pm, one day's notice
- **WHEN** it's 15:00 and the shop's notice is 1 day
- **THEN** a customer can book any time tomorrow, from opening

#### Scenario: 3pm, 24 hours' notice
- **WHEN** it's 15:00 and the shop's notice is 24 hours
- **THEN** the earliest a customer can book is 15:00 tomorrow
