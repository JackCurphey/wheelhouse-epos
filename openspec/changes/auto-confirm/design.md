# Design: confirming online bookings automatically

The contract is written first; Mark's server half merges before Jack's
screens start (split plan §4.3, §4.4).

## Storage (the next free migration number, additive)

- `workshop_settings.confirm_bookings_automatically INTEGER NOT NULL DEFAULT 0` — off for every shop to start (decision 8).
- `workshop_jobs.online_unseen INTEGER NOT NULL DEFAULT 0` — 1 only on an online booking confirmed straight away, until staff open it.

## Contract

### `GET` / `PUT /api/workshop-settings`

- Both carry `confirmBookingsAutomatically` (boolean), as `showPricesOnline`. PUT is Owner only, as the rest of the route; omitted keeps what is stored.

### `GET /api/portal/:shopSlug/services`

- Gains `confirmsAutomatically` (boolean), so step 4 words its button ("Confirm booking" or "Send booking request").

### `POST /api/portal/:shopSlug/bookings`

- Every check stays as it is: a booking that doesn't fit is refused as today, so "fits the diary" needs no new rule.
- Setting off: unchanged (`booking_state = 'pending'`).
- Setting on: the job is saved with `booking_state = 'scheduled'`, where the booking-request machine's `accept` moves a pending job (`server/workshop/state-machines.js`), with any side effects accepting has, and `online_unseen = 1`. Read inside the booking lock, so a switch mid-booking can't half-apply.
- The reply's `privateLink` is unchanged; the booking link then reads `stage: 'confirmed'`, so the customer's page shows "Confirmed" with the drop-off line and the note.

### Staff

- `GET /api/workshop-jobs` and `GET /api/workshop-jobs/:id` carry `newOnline` (boolean, from `online_unseen`).
- `POST /api/workshop-jobs/:id/seen` clears it (204; any signed-in staff member; idempotent). The job page calls it when opened; a GET never changes data.
- Waiting for you is unchanged: it lists requests, and a booking confirmed straight away isn't one.

## Screens (Jack, after the server half merges)

- Settings: a `RowSwitch` "Confirm bookings automatically" after "Show prices on the booking page", with the drawn note, saved at once (the PricesSetting pattern); the Online booking summary's last words follow it, where a summary is built.
- Step 4: the button and the agreement line follow `confirmsAutomatically`.
- Diary: a block with `newOnline` shows the globe and "New, booked online" ("New online" in a narrow week column on a computer or tablet); its accessible name ends ", new, booked online". The job page posts `/seen` when it opens.
