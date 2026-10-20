## ADDED Requirements

### Requirement: Staff can offer a different time or decline an offered booking
A booking whose offered time is waiting for the customer SHALL open, from its diary block, a pop-up showing the offered time, the message sent with it and that it waits for the customer, with "Offer a different time" and "Decline" and no Accept (Jack, 20 Oct; drawn as request-offered, request-offered-decline).

#### Scenario: Offer a different time
- **WHEN** staff choose Offer a different time and offer another free time
- **THEN** the new time replaces the first offer, and the offer still says the day the customer first asked for

#### Scenario: Decline
- **WHEN** staff decline it with a message
- **THEN** the booking is declined, the offered time is let go, and the customer's page shows the message
