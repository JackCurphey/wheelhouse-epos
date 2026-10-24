## ADDED Requirements

### Requirement: A booking takes the shop's deposit, held first and taken once the booking is saved

When the shop takes a deposit, a booking request SHALL need the deposit held
on a card first, worked out by the server from the stored prices, never
taken from the booking page. The booking SHALL be saved with the deposit and
when it is free to cancel until, and only then SHALL the money be taken; a
booking that can't be saved SHALL let the hold go. Sending the same request
again SHALL book once and take once.

#### Scenario: Paid and booked
- **WHEN** the shop takes 20% and a customer holds £13.00 on a £65.00 service and sends the booking
- **THEN** the booking is saved with a £13.00 deposit, the £13.00 is taken, and it is free to cancel until 24 hours before

#### Scenario: Not held
- **WHEN** the shop takes a deposit and a booking request comes without a held deposit
- **THEN** it is refused, saying the deposit is needed, and nothing is booked

#### Scenario: The slot went
- **WHEN** the deposit is held and the time is gone by the time the booking is sent
- **THEN** nothing is booked and the hold is let go, so nothing is taken

#### Scenario: Sent twice
- **WHEN** the connection drops after paying and the customer sends again
- **THEN** the booking already made is answered, and the deposit is taken once

#### Scenario: Declined card
- **WHEN** the card is declined
- **THEN** nothing is held, and the booking can't be sent until a card is accepted
