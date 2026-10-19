# Design: notice in hours or days

## Contract

- `GET /api/workshop-settings` gains `minNoticeDays`: an integer from 1 to 60, or `null` (notice is in hours, `minNoticeMinutes`).
- `PUT` accepts `minNoticeDays`: an integer 1–60, or `null` to go back to hours. Anything else: 400 "Notice in days must be a whole number from 1 to 60". `minNoticeMinutes` is unchanged and still saved separately.
- `earliestBookable(settings, moment)`: with `minNoticeDays` set, `{ date: shop's today + minNoticeDays, minutes: 0 }` (in the shop's time zone); otherwise as now. Availability and the booking check both use it, so both follow.

## Data (migration 044, additive)

`ALTER TABLE workshop_settings ADD COLUMN min_notice_days INTEGER;` (null for every shop to start: notice stays in hours).

## Screen

In the Online booking box, above the time kept free: "Notice", hint "How far ahead customers must book", a number box and two pills, hours / days (`role=radio` in a group "Notice in"). Hours shows `minNoticeMinutes ÷ 60` and saves whole hours 0–168 as minutes with `minNoticeDays: null`; days shows `minNoticeDays` and saves whole days 1–60. Choosing the other pill saves the box's number in that unit. The note matches the unit, as drawn. A value out of range is refused in the screen ("Enter 0 to 168 hours" / "Enter 1 to 60 days").
