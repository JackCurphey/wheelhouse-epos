# Design: offering another time

Three pull requests under one change: the server, then the staff screens, then the customer's page; archived with the last.

## State

`bookingRequest` gains `offered`:
- `pending` → `offer` → `offered`
- `offered` → `offer` → `offered` (offered again), `accept_offer` → `scheduled` (the customer), `cancel` → `cancelled` (either side), `decline` → `declined` (staff), `expire` → `expired`.

Offered counts as a live booking (`LIVE_BOOKING_STATES`): its time is held and counted in capacity, as a request's is. The derived legacy `status` reads `pending` for it.

## Storage (migration 046, additive)

- The `booking_state` CHECK re-made with `'offered'`; the generated `status` column re-made with `offered` → `pending` (and anything that indexed it re-made).
- `workshop_jobs.offered_from_date TEXT`, `offered_from_time TEXT`: the day and time the customer first asked for, kept for their page ("can't do Thursday 17 September at 11:30").
- `workshop_jobs.offer_message TEXT`: the shop's message.

The offer moves the job itself to the suggested day, time and mechanic, so its hold follows (answer 1: the suggested time kept free, the first let go). The auto-confirm contract's storage takes the next free number after this.

## Contract

### `POST /api/workshop-jobs/:id/offer` (staff)

- Body: `{ version, jobDate, startTime?, mechanicId, message? }`. Version required, as every job action.
- Only from `pending` or `offered`; otherwise 409 `illegal`.
- The slot passes the staff move checks (`checkJobSlot`, the job itself left out); a taken slot is 409 `capacity`.
- The first offer keeps where the customer asked in `offered_from_*`; offering again keeps it. Moves the job; sets `offer_message` (trimmed; up to 1,000 characters); `booking_state = 'offered'`; holds follow. Returns the job.

### Booking link (`GET …/booking-links/:code`)

- `stage: 'time_offered'` for an offered booking.
- `offer: { fromDate, fromTime, message }` while offered, else null. `jobDate`/`startTime` are the suggested time.
- `canAccept`: true while offered and not too late (`customerTooLate`). `canCancel` true for an offered booking; `canChange` false (Accept or cancel; decision 12).

### `POST …/booking-links/:code/accept-offer` (customer)

- Only while offered: otherwise 409 `illegal` ("There's no time offered to accept"); too late 409 `in_shop`.
- `accept_offer` → `scheduled`; clears `offer_*`; holds follow. Returns the link view (stage `confirmed`). A second press after accepting returns the same view.

### Elsewhere

- `POST …/cancel` works on an offered booking (customer-cancelled, so it shows in Waiting for you as now).
- `POST …/change` and `…/availability` refuse an offered booking (409 `illegal`, "This booking can't be changed online").
- Waiting for you doesn't list offered bookings (nothing for staff to answer). The legacy job PUT doesn't change an offered booking's state.

## Screens

- **Staff:** the request pop-up gets "Offer another time" (between Accept and Decline, as drawn). It closes the pop-up and puts the diary in pick mode with the drawn bar and Cancel (back to the request). A free time opens the offer pop-up: the time and mechanic, Choose another time, Message to [first name] (started as drawn), the note, Offer this time / Keep request. The diary draws an offered booking as "Time offered" (the request's colours), with no Accept or Decline; its job pop-up says "Time offered, waiting for [customer]".
- **Customer:** heading "Your booking request"; badge "The shop has suggested another time"; "[Shop] can't do [Thursday 17 September at 11:30]. They suggest:" and the time large; the message as a quote; Accept this time (primary), Cancel my request; the rows, with When as the time first asked for, "— not available" (as drawn).
