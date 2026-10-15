# Proposal: the workshop settings routes move to their own file (WP-0.4)

## Why

Jack asked on #180 who owns the 15 workshop settings routes. Mark took them
(15 Oct): Settings is Mark's area (split plan §4.1), and `capacity.js` is his
(§3.1). Moving them out of `server.js` is one of WP-0.4's remaining moves.
It also brings in `server/lib/uploads.js`, which Mark promised on #180, so
Jack's attachments move can use it.

## What Changes

- New `server/routes/workshop-settings.js`, Mark's file, with all 15
  routes, registered after the workshop's own:
  - `/api/workshop-settings` (GET, PUT);
  - `/api/workshop-unavailability` (GET, POST, PUT, DELETE);
  - `/api/workshop-capacity` (GET);
  - `/api/workshop-service-categories` (GET, POST, PUT, DELETE);
  - `/api/workshop-services` (GET, POST, PUT, DELETE).

  Their helpers come with them. A change to what the diary or New job
  receives needs Jack's approval (#180).
- New `server/lib/uploads.js`, with `UPLOADS_DIR` and `MAX_SERIAL`. Both
  are used by more than one area, and `server.js` imports them.
- `resolveWorkingDays` moves to `server/capacity.js`, because the
  employees routes and the settings routes both use it.
- `shopDayWindow` stays in `server.js`, because sales and the dashboard use
  it.
- Moved, not rewritten. Every removed line is in its new home unchanged,
  apart from the 2-space indent inside `register(route)`, `export`
  added to the shared names, and `UPLOADS_DIR` gaining a `'..'` because it
  is one folder deeper. `server.js` re-exports `serializeWorkshopService`
  for its test. No behaviour changes (`skip_specs`).

## Lane, drawings and decisions

- **Lane:** Mark's (`server/routes/workshop-settings.js`,
  `server/lib/uploads.js`, `server/capacity.js` and `server.js`; split
  plan §3 and §3.1). Nothing in Jack's files changes.
- **Drawings:** none. The screen-trace check still finds every route's
  screen design (46 workshop routes).
- **Decisions followed:** split plan §4.1 (a move, proven by the
  route-list test), and Mark's answers to Jack's questions 1 and 2 on #180.

## Out of scope

- Moving Jack's attachment routes onto `server/lib/uploads.js`. That's
  Jack's move, now unblocked.
- The image upload, booking and portal routes. Those are later moves.

## Impact

- `server/routes/workshop-settings.js` and `server/lib/uploads.js` (new),
  `server/routes/index.js`, `server/capacity.js`, `server/server.js`, and
  the new test `tests/workshop-settings-routes-file.test.js`.
