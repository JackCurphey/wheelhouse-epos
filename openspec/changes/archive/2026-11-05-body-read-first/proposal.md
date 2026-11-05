## Why

The review after `dropped-request-releases` proved that a case that change left open is worse than it noted. Ten clients with no sign-in can each send the headers and part of a body to `POST /api/portal/:shopSlug/bookings` and go quiet. Each holds a database connection while the server waits for the rest, there are only 10, and every shop then gets errors: about 5 minutes directly, about 30 seconds through Caddy (the hosted copy's path). Sending one byte every 3 seconds also gets past the gateway's limit.

A second finding: paying for an order (`POST /api/sale-documents/:id/convert`) started its transaction and locked the order before reading the body, so one stalled payment kept a second one waiting.

## What Changes

- A request's body is read before it takes a database connection, on every route. The dispatcher does this once it knows the route; the routes go on using `readJsonBody` and `readRawBody`, which use what was read and still apply each route's own limit.
- Staff and tills are checked first, so an unknown caller is turned away without sending a body.
- The whole body has a deadline, however slowly its bytes arrive: 30 seconds, or 4 minutes on the seven upload routes. Past it, the client gets 408 and the connection closes.
- Callers not known to be staff or a till have limits on reads at once and on bytes held, per address and for the whole server. Over them, the client gets 429 and the connection closes.
- Sending a Citrus Lime file still checks who is sending, and takes the shop's one place, before the file is read.
- Paying for an order reads its body before the transaction and the lock.

## Out of scope

- Slow answers: a client that won't read its response holds no database connection, since the response is sent with the connection free or about to be.
- A client stalled while sending its headers: no route has run, so nothing is held, and Node's limit of 60 seconds ends it.
- Caddy's and the gateway's own settings. Nothing in them changes.

## Who and risk

From a review of main, no work package; Jack's. Risky areas: `server/server.js`, public routes (`/api/portal/*`), and money (`/api/sale-documents/:id/convert`). `/review` before merging; the hand-run CI and the merge are done by whoever is running the build.

## Follows

No drawing: nothing on any screen changes. Follows `openspec/changes/archive/2026-11-05-dropped-request-releases`. The limits and deadlines are logged in `docs/decisions/decided-while-building.md`. No decision is touched.
