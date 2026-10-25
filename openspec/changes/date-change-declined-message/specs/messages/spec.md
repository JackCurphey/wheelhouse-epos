# Spec Delta

## MODIFIED Requirements

### Requirement: Staff answers send the booking messages
Accepting a booking request, offering another time, declining, accepting a date change, and declining a date change SHALL each queue their booking message (Booking confirmed, New time offered, Request declined, Date change answered in its "If the shop accepts" or "If the shop can't" wording) for the customer at once, by their chosen way, unless it is switched off (Jack, 20 Oct, booking messages answer 4; Mark, 25 Oct). One switch covers both wordings of Date change answered.

#### Scenario: Accepting a request
- **WHEN** staff accept a booking request
- **THEN** Booking confirmed is queued with the booked day and time, when to drop off and the shop's note

#### Scenario: Declining with a message
- **WHEN** staff decline with a message
- **THEN** Request declined is queued with the message in it

#### Scenario: Declining a date change
- **WHEN** staff decline a customer's request to change their date
- **THEN** the "If the shop can't" wording is queued with the day the customer asked for and the day the booking stays on
- **THEN** the booking keeps its day

#### Scenario: Date change answered is switched off
- **WHEN** Date change answered is off and staff accept or decline a date change
- **THEN** nothing is sent
