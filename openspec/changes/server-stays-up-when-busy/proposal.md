# Proposal: one failed lookup never takes every shop down

## Why

`portal-connection-per-request` listed faults it left alone
(`openspec/changes/archive/2026-10-26-portal-connection-per-request/design.md`,
"Not covered" 1 to 3):

1. **The server stops on one bad request.** The request dispatcher in
   `server/server.js` does a few things of its own before any route runs: it
   reads the address, finds the shop's online shop, finds the shop named in a
   website address (`/api/portal/<shop>/...`), and looks up who is signed in
   on a staff request. These sit outside any `try`. If one of them fails (the
   database's 10 connections are all busy and the 5-second wait runs out, or
   the request carries something Postgres refuses), nothing catches it, the
   crash guard stops the process ("Fatal: unhandled promise rejection"), and
   every shop is down until it restarts. Anyone on the internet can send such
   a request.
2. **The messaging core still takes a second connection.** Setting up a
   service reminder or a review request when a bike is collected, and writing
   them when they go, read the shop's name with `pool.query` while the request
   (or the messages engine) already holds the shop's connection. So does the
   shop's own automatic messages' shop lookup, and signing a customer in by
   emailed code (`createCustomerSession`). At a busy moment, all 10
   connections can be held by requests each waiting for an eleventh.

## What Changes

- The dispatcher's own steps fail one request, not the server: a failure
  answers that request with 500 "Internal server error", as each route
  already does, and the server goes on answering the next one.
- `server/messaging/service-reminders.js`, `review-requests.js` and
  `own-messages.js` read the shop's name and address through the shop's own
  connection (`prepare`), as `workshop.js` and `job-messages.js` already do
  since `portal-connection-per-request`.
- Sign-in by emailed code makes the customer's session on the request's own
  connection. Sign-up and log-in with a password (which run outside any
  shop's connection) are unchanged.
- No other behaviour changes: same answers, same shop for each request, same
  row-level security.

## Capabilities

### Modified Capabilities

- `staff-sign-in`: a staff request whose sign-in can't be looked up gets an
  error; the server stays up.
- `customer-accounts`: the same for the shop's website; sign-in by code at a
  busy moment.
- `messages`: reminders and review requests are set up and written without a
  second connection.

## Work package and risk

A fault fix, the follow-up named in `portal-connection-per-request`'s "Not
covered", taken by Jack's session. **Risky areas:** `server/server.js`, the
messaging core, and customer sign-in (`/api/portal/*`), so it needs `/review`.
No migration, no dependency, no screen change. No drawing or decision is
touched.

## Out of scope

- Pool size and the 5-second wait.
- `validateNewLogin` (`server/auth.js:74`), reached when the Owner adds a team
  member, inside the shop's connection: the same second connection, on an
  Owner-only screen. Noted in design.md, not changed here.
- Answering an address that can't be read with 400 rather than 500.
