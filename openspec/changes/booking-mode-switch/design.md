# Design: switching between a set time and the whole day

## Contract (existing)

`GET /api/workshop-settings`: `bookingMode` ('timed' | 'dropoff', today's), `nextBookingMode`, `nextBookingModeFrom` (or nulls), `dropoffWindowStart`, `dropoffWindowEnd`. `PUT` with `{ nextBookingMode, nextBookingModeFrom }` schedules (tomorrow or later, a mode not already in use), both null cancels; `{ dropoffWindowStart, dropoffWindowEnd }` ("09:00"-style, end after start). Owner only.

## Screen

- The two pills show today's mode (`role=radio`, group "Bikes are booked in for"). Choosing the other opens the dialog, with its date (`type=date`, earliest tomorrow), and "Change from [Thu 5 Nov]", greyed until a date is chosen; it saves the schedule, and a refusal shows in the dialog in the server's words.
- With a change coming: the status line ("Changing to the whole day from [day]. Bookings already made keep their set times." — for a set time, "…to a set time from [day]. Bookings already made keep their days.") and "Cancel the change", which clears it.
- "Drop-off window": two time choices (every half hour, 05:00 to 22:00), shown while the mode today or the coming one is the whole day; each change saves both.
