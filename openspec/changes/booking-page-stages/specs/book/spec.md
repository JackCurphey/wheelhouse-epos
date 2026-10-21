## ADDED Requirements

### Requirement: The booking page shows the bike's later stages to their drawings
Once the bike is in the shop, ready or collected, the booking page SHALL show "Your repair · [reference]" above a heading for that stage, the booking's rows and the shop. On the ready and collected pages it SHALL also show the tracker with Ready current, and on the ready page "To pay when you collect". None of these pages SHALL offer Copy link or the contact line.

#### Scenario: A bike in the workshop
- **WHEN** the customer opens the link while the bike is in the shop
- **THEN** the heading reads "Your bike is in the workshop", with no tracker and no contact line

#### Scenario: A bike ready to collect
- **WHEN** the work is finished
- **THEN** the heading reads "Your [bike] is ready", the tracker's steps are all ticked with Ready current, and the page says to pay at the counter by card or cash

#### Scenario: A collected bike
- **WHEN** the bike has been collected
- **THEN** the heading reads "Your [bike] has been collected" and a Collected card says the page keeps working for 30 days after collection

### Requirement: An expired request's page says so and offers another date
A booking request the shop never answered SHALL, once expired, say "Sorry, we couldn't get back to you in time", that the shop couldn't answer the request for its day and time in time, and that nothing is booked, with "Choose another date".

#### Scenario: The shop didn't answer in time
- **WHEN** the customer opens the link of an expired request
- **THEN** the page says it has expired and nothing is booked, and "Choose another date" opens the shop's booking start
