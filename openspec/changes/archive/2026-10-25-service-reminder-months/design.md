# Design: when each service's reminder is due

## Decisions

1. **Months, from 1 to 60, or empty.** The drawing asks for "[n] months",
   and empty means no reminder. 60, five years, is a ceiling chosen here
   (logged); it catches a slip of the keyboard. Zero is refused rather than
   read as "none": empty already means none.
2. **The server keeps it on a change that leaves it out,** as
   `readServicePlacement` does for kind, so the old staff app and any other
   caller can't wipe it.
3. **The box sends it every time it saves:** the number, or null when the
   field is empty.
4. **The box's line about the wording waits** for the Service reminder
   message (logged).

## Contract

`POST` and `PUT /api/workshop-services` take `reminderMonths`: null, or a
whole number from 1 to 60. Anything else is refused with "Remind after a
whole number of months, from 1 to 60". `GET` returns `reminderMonths` on
each service.
