# Spec Delta

## ADDED Requirements

### Requirement: A cancel that never arrived whole cancels nothing
A booking SHALL be cancelled only when the customer's request to cancel reached the server whole. If the connection is lost before it has, the booking SHALL stay as it was.

#### Scenario: The signal goes while Maya cancels
- **WHEN** Maya presses Cancel booking and confirms, and her phone loses its connection before the request has all arrived
- **THEN** her booking is not cancelled, and pressing Cancel booking again works as normal
