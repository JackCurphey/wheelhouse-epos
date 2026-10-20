# Design: Change the date

Two halves, one change (split plan §4.3): the server route merges first, the screens follow; archived with the screens.

## Contract

### `GET /api/portal/:slug/booking-links/:code/availability?start=YYYY-MM-DD&end=YYYY-MM-DD`

- The link code is the key, as the rest of the booking page (`resolveBookingLink`: 404, 410, 429, and the same rate limit).
- 400 unless `start` and `end` are real dates, `end >= start`, at most `MAX_RANGE_DAYS` apart.
- 409 when the customer can't change the booking online (`customerActionRefusal(job, 'change', today)`: `in_shop` or `illegal`, the change route's words), or when it has no mechanic (`illegal`, "This booking can't be changed online").
- 200: `{ mechanicId, minutes, days: [...] }`.
  - `mechanicId`: the booking's mechanic, to send back with `POST …/change`.
  - `minutes`: the booking's length, as the change route works it out (planned minutes, else its times, else 60).
  - Each day: `{ date, mode, closed }` plus, for a timed day, `startTimes` (the mechanic's start times that fit, none sooner than the shop's notice), or for a drop-off day, `bookable` and `dropoffWindow: { start, end }`. `closed` is true when the mechanic isn't working that day.
  - Capacity leaves this booking (and any change it asked for) out (`loadCapacity(start, end, { ignoreJobId })`), so its own slot is free to choose again.

### Existing (piece 12)

- `POST …/change` `{ jobDate, mechanicId, startTime? }` → the link view; a confirmed booking becomes `change_requested` with `requested`. `POST …/withdraw-change` → back to confirmed. The link view's `canChange`, `requested` (`{ jobDate, startTime, mechanicId }`) and `changeDeclined` are typed on the client.

## Screens

- **Buttons** on the confirmed page: "Change the date" (when `canChange`), then "Cancel booking" (when `canCancel`).
- **Choose a new date** (under the card, in place of the buttons): h2 "Choose a new date"; a strip of 10 days from today, "Later weeks ›" (and "‹ Earlier weeks" once moved on); each day a radio: weekday, date, and "Your booking", "Closed", "Full" or "[n] times"; closed and full days can't be chosen. A timed day lists its times as radios under "[Day] — choose a time" (which names the group); Ask for this date stays off until a free day, and a time still on its list, is chosen, and while it's the booking's own day and time; a drop-off day says "Drop off between [start] and [end]". Note: "Your booking stays on [weekday] until the shop confirms the new time." Keep [weekday] closes it; Ask for this date posts the change and the page shows the waiting state. A refusal shows the server's words.
- **Change waiting** (`change_requested`): purple "New date waiting for the shop"; "You asked to move to [Fri 25 Sep, 14:00]. Your booking stays on [Thursday 17 September] until the shop confirms the new time."; the rows; "Cancel my date change" (withdraw) and Cancel booking.
- **Declined** (`changeDeclined` on a confirmed booking): a warning notice "The shop couldn't do the new date you asked for. Your booking is still [Thursday 17 September, 11:30]." (the declined date isn't kept, so it isn't named).
