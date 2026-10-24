# Proposal: the booking link's quote answer moves to server/routes/portal.js (WP-0.4, the last route)

## Why

WP-0.4 splits the server into files. Every route has moved into `server/routes/`
except one: `POST /api/portal/:shopSlug/booking-links/:code/quote/answer`. It
stayed in `server.js` until `answerAndAddToOrder` left it. That has happened
(`server/workshop/jobs.js`, exported, `move-staff-quote-routes`), so nothing
keeps the route there now. Jack took WP-0.4 and WP-0.5 over from Mark on 24 Oct
("take over WP-0.4 and WP-0.5 from Mark"), under the working agreement, where
either person can pick up anything.

## What Changes

- The route moves into `register()` in `server/routes/portal.js`, after the
  portal quote routes. `portal.js` imports `answerAndAddToOrder` from
  `../workshop/jobs.js`.
- `resolveBookingLink` stops being exported, because only `portal.js` uses it
  now.
- `server.js` drops the imports it no longer uses: `sendQuoteResult`,
  `answerAndAddToOrder`, `resolveBookingLink` and `readJsonBody`.
- It is moved, not rewritten: the handler is the same code, apart from its
  indentation inside `register()`.
- No behaviour changes, so there's no spec change (`skip_specs`).

## Drawings and decisions

- **Drawings:** none; nothing on any screen changes.
- **Decisions followed:** split plan §4.1 (a move, not a rewrite, proven by the
  route list and the existing tests passing unchanged).

## Impact

`server/server.js`, `server/routes/portal.js`, `tests/portal-routes-file.test.js`
and the route-list snapshot (same routes, new order). **Risky areas:**
`server/server.js` and a public route (`/api/portal/*`), so `/review` runs.
