## ADDED Requirements

### Requirement: The booking page shows the deposit paid and when it's free to cancel until

A booking that took a deposit SHALL show "Deposit paid" with the amount and
"Free to cancel until" with the day and time in the shop's time, above "Your
repair", as drawn in `bookingLines`. A request waiting for the shop SHALL add
"If we can't fit you in, your deposit comes back in full." A booking with no
deposit SHALL show neither.

#### Scenario: A confirmed booking with a deposit
- **WHEN** Maya's booking took £13.00 and is free to cancel until 24 hours before Monday 11:30
- **THEN** her page shows Deposit paid £13.00 and Free to cancel until Sunday 4 October, 11:30

#### Scenario: A request with a deposit
- **WHEN** her request is waiting for the shop
- **THEN** the page adds "If we can't fit you in, your deposit comes back in full."
