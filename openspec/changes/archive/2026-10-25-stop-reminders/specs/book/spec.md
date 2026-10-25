# Spec Delta

## ADDED Requirements

### Requirement: A customer stops service reminders with a press, no sign-in
A service reminder's "Stop these" link SHALL open a page that asks "Stop service reminders?" with one button; reminders SHALL stop only when it is pressed. The page SHALL then say "Service reminders stopped" and "We won’t send you service reminders any more. Job updates about a bike that’s with us still come as usual.", with "Turn them back on" (`ac-stopped`). Turning them back on SHALL say "Service reminders are on again" (`ac-stopped-on`) and record a yes from the stop page.

#### Scenario: Opening the link
- **WHEN** Maya's phone opens the link to check it
- **THEN** nothing stops until she presses the button

#### Scenario: Stopping
- **WHEN** Maya presses "Stop service reminders"
- **THEN** her service reminders stop, and the page says so

#### Scenario: A link that doesn't work
- **WHEN** someone opens a stop link with a made-up code
- **THEN** the page says "This link doesn’t work" and shows nothing about anyone
