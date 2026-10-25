# Proposal: when each service's reminder is due

## Why

Account and reminders decision 2 (Jack, 1 Oct): "The shop sets a reminder
gap on each service in Settings (Standard service after [n] months; none for
a puncture)." The service box is drawn with it (`ac-service-edit`,
`account.mjs:213-214`):
- "Remind customers it’s due after [n] months";
- "Counted from when the bike is collected. Only customers who said yes get
  it. Leave empty for no reminder — for a puncture, say."

The list row says " · reminder after [n] months" (`ac-services`,
`setup.mjs:313`).

This is the second piece of service reminders, after the yes at booking
(#483) and the Services room (#484). The reminder itself, its wording and
"Stop these" come next.

## What Changes

- **Migration 078:** `workshop_services.reminder_months`, a whole number
  from 1 to 60, or empty for no reminder.
- **The service routes:** they read and write `reminderMonths`. Left out on
  a change, it keeps what is saved, as the other fields do. Anything other
  than empty or a whole number from 1 to 60 is refused.
- **The service box** gains the drawn field and its note.
- **The row** says " · reminder after [n] months" when one is set.

## Capabilities

### Modified Capabilities

- `settings`: a service says when its reminder is due.

## Out of scope

- **Sending the reminder,** its wording in Settings › Messages, and "Stop
  these". The box's drawn line "The wording is in Settings › Messages ›
  Service reminder." waits for that message, so it doesn't point at
  nothing.
