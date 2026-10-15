# Proposal: the booking pages' account and read routes move to server/routes/portal.js (WP-0.4)

## Why

The online booking pages (the portal) are the biggest area still in
`server.js`, at about 850 lines. They move in two parts to keep each pull
request reviewable. This is the first: the customer's account, and what the
booking pages read. Bookings and booking links follow.

## What Changes

- New `server/routes/portal.js`, Mark's file. It takes 10 routes under
  `/api/portal/:shopSlug/`: signup, login, logout and me; mechanics,
  services, terms and availability; and the customer's bikes (GET and POST).
- The customer cookie helpers (`setCustomerSessionCookie`,
  `clearCustomerSessionCookie`) and the sign-in limiters
  (`portalLoginLimiter`, `portalSignupLimiter`) move with them, as the split
  plan's §4.1 table puts an area's limiters in its own file.
- The guest-booking and booking-link limiters stay with bookings until the
  next move.
- Moved, not rewritten. The only changes are the 2-space indent inside
  `register(route)`, one comment that pointed at the staff cookie helpers
  "above" (now `server/routes/auth.js`), and the file header. The dispatcher's
  `/api/portal/` branch is unchanged. No behaviour changes (`skip_specs`).

## Lane, drawings and decisions

- **Lane:** Mark's. The portal is Mark's (split plan §3), and so is
  `server.js`.
- **Drawings:** none.
- **Decisions followed:** split plan §4.1 (a move, proven by the route-list
  test).

## Out of scope

- Bookings and booking links (`/bookings`, `/booking-links/...`): the next
  move.
- The three portal quote routes, which move with bookings.

## Impact

- `server/routes/portal.js` (new), `server/routes/index.js`,
  `server/server.js`, and the new test `tests/portal-routes-file.test.js`.
