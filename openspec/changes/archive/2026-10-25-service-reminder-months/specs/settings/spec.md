# Spec Delta

## ADDED Requirements

### Requirement: A service says when its reminder is due
The service box SHALL have "Remind customers it’s due after [n] months", with "Counted from when the bike is collected. Only customers who said yes get it. Leave empty for no reminder — for a puncture, say." (`ac-service-edit`). Months SHALL be a whole number from 1 to 60, or empty for no reminder; anything else SHALL be refused with "Remind after a whole number of months, from 1 to 60". A service with a reminder SHALL say " · reminder after [n] months" in the list (`ac-services`).

#### Scenario: Standard service every year
- **WHEN** the Owner sets Standard service to remind after [n] months
- **THEN** its row reads "60 min in the diary · reminder after [n] months"

#### Scenario: A puncture
- **WHEN** the Owner leaves the months empty
- **THEN** the service has no reminder
