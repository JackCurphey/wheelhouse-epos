## ADDED Requirements

### Requirement: The customer's pages say what happens to the deposit

The cancel pop-up SHALL say the deposit will be refunded before the cut-off,
and after it that it isn't refundable, with the shop's number and the button
"Cancel and lose the deposit". The cancelled page SHALL say the deposit comes
back or was kept; the declined and expired pages SHALL say it comes back.
Past the cut-off the booking page SHALL NOT show "Free to cancel until".

#### Scenario: Cancelling late
- **WHEN** Maya cancels after Sunday 4 October, 11:30
- **THEN** the pop-up says "It's past Sunday 4 October, 11:30, so your £13.00 deposit isn't refundable. If something's gone wrong, call the shop on 01204 555 123 — they can still refund it." and its button reads Cancel and lose the deposit

#### Scenario: Declined
- **WHEN** the shop declines Maya's request
- **THEN** her page says "Nothing is booked. Your £13.00 deposit comes back to your card within 5 to 10 working days."
