# Proposal: the booking pages' bookings, booking links and quotes move to server/routes/portal.js (WP-0.4)

## Why

The second half of the online booking pages' move (the first is #210).
After this, only one portal route is left in `server.js`.

## What Changes

- 10 more routes move to `server/routes/portal.js`:
  - `GET` and `POST /api/portal/:shopSlug/bookings`;
  - the private booking link: view, see its quote, cancel, change, and
    withdraw a change;
  - the three portal quote routes: see a quote, decide a line, approve.
- Their helpers move with them:
  - the customer-action rules (`customerCanAct`, `customerActionRefusal`
    and friends), from the old "Workshop jobs" section, which only these
    routes use;
  - the booking helpers (`checkCustomerTime`, `bookingNotes`,
    `replayBookingRequest` and others);
  - the booking-link helpers;
  - the guest-booking and booking-link limiters.
- **One route stays** in `server.js`:
  `POST /booking-links/:code/quote/answer`. It needs `answerAndAddToOrder`,
  which is Jack's quote code and still in `server.js`, and a route file must
  never import `server.js`. Until Jack's quote move takes it, `portal.js`
  exports `resolveBookingLink` for it (`server.js` may import a route file,
  as it already does `JOB_STATUSES`).
- Moved, not rewritten. The only changes are the 2-space indent inside
  `register(route)`, `export` on `resolveBookingLink` with a comment
  saying why, and the import lists. No behaviour changes (`skip_specs`).

## Lane, drawings and decisions

- **Lane:** Mark's. The portal and its quote routes are Mark's (#180,
  15 Oct), and so is `server.js`. The customer-action rules are Jack's
  decisions (27 Sep, piece 12), moved unchanged.
- **Drawings:** none.
- **Decisions followed:** split plan §4.1.

## Out of scope

- The booking link's quote answer, which waits for Jack's quote move.

## Impact

- `server/routes/portal.js`, `server/server.js`, and
  `tests/portal-routes-file.test.js`. Built on #210.
