# Spec Delta

## ADDED Requirements

### Requirement: The ready page asks about service reminders
While the bike is ready to collect, the in-shop "To pay when you collect" card SHALL end with the tick "Remind me when my bike is due its next service" and "And ask me for a review after I collect. One message each, the way you chose when you booked. Stop any time.", unticked; ticking it SHALL save a yes from collection at once.

#### Scenario: Ticking at collection
- **WHEN** Maya, booked in by staff, ticks it on her ready page
- **THEN** she has said yes to service reminders and review requests, from collection

### Requirement: A customer who said yes sees so on the ready page
A customer who already said yes SHALL see "You’ll get a reminder when the next service is due. Change" instead of the tick; Change SHALL show the tick, ticked, and unticking it SHALL turn reminders off.

#### Scenario: Changing their mind
- **WHEN** Maya presses Change and unticks it
- **THEN** her service reminders are off

#### Scenario: Said yes when booking
- **WHEN** Maya said yes when booking
- **THEN** her ready page says "You’ll get a reminder when the next service is due."
