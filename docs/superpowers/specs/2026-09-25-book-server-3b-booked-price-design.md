# Book server piece 3b: the booked price

**Date:** 2026-09-25. **Follows:** piece 3 (#67), whose spec line "price comes
from the service row" was not met because the job had nowhere to keep it.

## Intent

When a customer books a named service online, the booking records which
service it was and what that service cost at the moment of booking. A later
change to the shop's price list must not change what an existing booking says.

## Decisions (Jack, 25 Sep)

1. Store it on the booking (two columns), not as an automatic draft quote.
   A quote is something the shop sends for approval; creating one at booking
   would muddle that.
2. Guests keep needing a phone number for every channel. No change here.

## Approach

- Migration 026 adds to `workshop_jobs`:
  - `service_id INTEGER REFERENCES workshop_services(id)`, nullable.
  - `booked_price NUMERIC(10,2)`, nullable.
- `createWorkshopJob` takes an optional `serviceId`. The insert writes it, and
  copies the price in SQL (`(SELECT price FROM workshop_services WHERE id = ?)`)
  so the amount never passes through a JavaScript number (STATUS: money is
  handled in SQL, never JavaScript). The select runs under the shop's
  row-level security.
- The portal booking route passes the chosen service's id. "Not sure" passes
  nothing, so both columns stay empty.
- Staff-created jobs are unchanged (no service, no price).

## Out of scope

- Showing the price anywhere on screen (a UI change, asked for separately).
- Returning the price in the portal booking response. The shop's
  `show_prices_online` setting governs what customers see; this piece does not
  touch it.

## Plan (tests first)

1. `tests/migration-026.test.js`: both columns exist, nullable, with the right
   types; `service_id` refuses an id that is not a service.
2. `tests/portal-booking-request.test.js`: a named service stores its id and
   price; changing the service's price afterwards leaves the booking's price
   alone; "not sure" stores neither; the response carries no price.
3. Watch them fail, write `server/migrations/026_booked_price.sql` and the
   `createWorkshopJob` and route changes, watch them pass, then break the copy
   on purpose and watch the tests go red.
4. `npm test`, typecheck, lint, build.
