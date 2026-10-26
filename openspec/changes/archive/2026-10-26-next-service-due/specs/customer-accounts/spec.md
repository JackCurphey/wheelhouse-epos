## ADDED Requirements

### Requirement: The account shows when each bike's next service is due

While a customer's service reminders are on, each of their bikes with a service reminder waiting SHALL show "Next service due [date]", the day the reminder is due to go, in the shop's own time zone. With reminders off, or no reminder waiting, no date SHALL show.

#### Scenario: a reminder waiting
- **WHEN** Maya's Trek has a service reminder waiting for Wed 17 Mar 2027, and her reminders are on
- **THEN** the bike shows "Next service due Wed 17 Mar 2027"

#### Scenario: reminders off
- **WHEN** Maya has switched service reminders off
- **THEN** no next service date shows
