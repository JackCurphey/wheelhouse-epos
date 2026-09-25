# Book screens piece (a): the booked price reaches the customer

**Date:** 2026-09-25. **Follows:** piece 3b (#68), which saved `booked_price`
on the job but deliberately returned it nowhere. **Parent:** plan 4a
(`docs/superpowers/plans/2026-09-20-phase-4a-book.md`), "Decided 25 Sep" item 2.

## Intent

After booking, the customer can see the price they booked at: on the
`pending` screen (from the booking POST's reply) and on the private link page
(from the link read-back). The shop's "show prices online" setting governs it,
exactly as it governs the service list.

## Decisions (Jack, 25 Sep)

1. **B1:** `pending` shows the booked price (atlas screen 06 changes to match
   in piece (d)).
2. **Follow the shop's setting:** with `show_prices_online` off, no price is
   returned after booking either. Chosen over "always show" (would reveal
   prices a shop chose to hide) and a separate setting (an extra option and
   migration for no clear need).
3. **A1 (recorded here, not built here):** no automatic acceptance in
   Release 1; every booking waits for the shop, so `pending` is the only
   outcome.
4. **Four pieces:** (a) this change; (b) the customer shell at `/book`;
   (c) the new form controls, each approved by Jack; (d) the six screens.
   Each gets its own spec and pull request.

## Approach

- One new field, `bookedPrice`, in two replies:
  - `POST /api/portal/:shopSlug/bookings`, the 201 body (next to
    `privateLink`). Added in the route, **not** in `serializePortalBooking`,
    so the customer's bookings list does not change.
  - `GET /api/portal/:shopSlug/booking-links/:code`.
- Value: the job's `booked_price` as the database layer returns it (the same
  form as a service's `price` on `/services`), or `null` when any of these
  hold:
  - the shop's `show_prices_online` is not 1;
  - the booking is "not sure" (no service, so no price);
  - the booking predates migration 026.
- The setting is read when the reply is built, so switching it later changes
  what an existing link shows.
- No arithmetic on the amount anywhere; it is passed through as stored.
- The link route's comment ("no price") is updated to say the price follows
  the shop setting.

## Out of scope

- Any screen or wording (piece (d)).
- The customer's bookings list, staff routes, `/services`.

## Tests (first, each watched failing)

- New file `tests/portal-booked-price.test.js` (keeps
  `tests/portal-booking-link.test.js` under its 30-lookup limit). Signed-in
  bookings, so the guest limit of five an hour is not hit. Cases, each checked
  on both the POST reply and the link read-back:
  1. setting on, named service: `bookedPrice` equals the service price;
  2. setting off, named service: `bookedPrice` is `null`;
  3. setting on, "not sure": `bookedPrice` is `null`.
- `tests/portal-booking-link.test.js`: the exact-shape check gains
  `bookedPrice`; the forbidden-key check allows exactly `bookedPrice` and
  still refuses any other key matching price, name, phone, email or notes.
- Break step: return `booked_price` regardless of the setting, and confirm
  case 2 fails; then drop the field and confirm case 1 fails. Restore.

## Done when

`npm test` passes with the compose Postgres up, the break steps have been
seen to fail, and a pull request is open for Jack.
