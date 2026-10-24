# Spec Delta

## ADDED Requirements

### Requirement: The details step asks about service reminders
The booking's details step SHALL show the tick "Remind me when my bike is due its next service", with "And ask me for a review after I collect. One message each, the way you chose above. Stop any time.", unticked to start (`ac-book-remind`; account and reminders decisions 2 and 8).

#### Scenario: Unticked to start
- **WHEN** Maya reaches the details step
- **THEN** the reminder tick is there, unticked

### Requirement: A booking saves the customer's yes to reminders
A booking sent with the reminder tick ticked SHALL record, on its customer, a yes to service reminders and to review requests, with when it was given and that it came from a booking. A booking sent without it SHALL leave the customer's answers as they were.

#### Scenario: Ticked
- **WHEN** Maya ticks it and books
- **THEN** her customer record says yes to service reminders and review requests, given now, from a booking

#### Scenario: Not ticked
- **WHEN** a customer who said yes before books again without ticking
- **THEN** their yes stays
