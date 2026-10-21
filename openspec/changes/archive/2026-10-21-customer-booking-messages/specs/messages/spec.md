## ADDED Requirements

### Requirement: The customer's side sends Request received and Booking cancelled
A booking request that waits for the shop SHALL send Request received. Cancelling a booking, from the customer's page or by the shop, SHALL send Booking cancelled. Each SHALL go the customer's way at once, carry the link the customer already has, and be left out when switched off in Settings › Messages.

#### Scenario: A request sent
- **WHEN** Maya sends a booking request the shop answers itself
- **THEN** she gets Request received, and her booking link keeps working

#### Scenario: Cancelled from the booking page
- **WHEN** Maya cancels her booking from its page
- **THEN** she gets Booking cancelled: "There's nothing to pay or refund. Book another time: [link]."
