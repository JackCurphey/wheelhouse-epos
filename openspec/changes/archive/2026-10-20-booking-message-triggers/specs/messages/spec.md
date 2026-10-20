## ADDED Requirements

### Requirement: Staff answers send the booking messages
Accepting a booking request, offering another time, declining, and accepting a date change SHALL each queue its booking message (Booking confirmed, New time offered, Request declined, Date change answered) for the customer at once, by their chosen way, unless it is switched off (Jack, 20 Oct, booking messages answer 4).

#### Scenario: Accepting a request
- **WHEN** staff accept a booking request
- **THEN** Booking confirmed is queued with the booked day and time, when to drop off and the shop's note

#### Scenario: Declining with a message
- **WHEN** staff decline with a message
- **THEN** Request declined is queued with the message in it

### Requirement: A pretend message leaves the customer's link working
While sending is pretend, a message SHALL show "[link]" in place of a link and SHALL NOT issue a new booking link, so the link the customer already has keeps working.

#### Scenario: Bike ready while pretend
- **WHEN** a job is marked ready while sending is pretend
- **THEN** Bike ready reads "See what we did: [link]." and the customer's existing link still opens their page
