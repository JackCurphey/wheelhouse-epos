# Design: the drop-off line

## Contract

`GET /api/portal/:shopSlug/booking-links/:code` (and the views cancel, change and withdraw-change return) gain `dropOff`:
- `null` unless the stage is `confirmed` or `change_requested` (a request not yet accepted, or a bike already in, gets nothing).
- With a start time: `{ by: "HH:MM", booked: "HH:MM", leadMinutes }`, `by` = start time − `timed_lead_minutes`, not before 00:00 (`addMinutesToTime`), and `leadMinutes` the real difference.
- With no start time, when the shop books bikes in for the whole day on that date (`modeForDate`): `{ from, to }`, the shop's `dropoff_window_start`/`end`. A set-time shop's job with no time gets `null` (fresh review).

## Words (pending-rules.ts)

- Set time: "Drop your [bike] off by [by], [lead] before your booking at [booked]." The lead reads "half an hour" (30), "an hour" (60), "an hour and a half" (90), else "[n] minutes" or "[n] hours". A lead of 0: "Drop your [bike] off at your booking time, [booked]." [bike] is the make and model, else "bike".
- Whole day: "Drop your [bike] off between [from] and [to]."

## Settings

"Drop off before the booking", a minutes box with the hint "How long before their booked time customers bring the bike in", in the Online booking box above the time kept free, shown when `bookingMode` is `timed`; 0 to 240 whole minutes; saved when left, like the time kept free.
