# Proposal: the shop's website never waits for a second database connection

## Why

`server-connection-per-request` stopped a signed-in staff request needing a
second pooled connection while it holds its first. An independent review found
the same fault in two more places:

1. **The shop's website (public).** Every customer route runs inside
   `runWithShop`, which holds one of the pool's 10 connections. Eleven of them
   then call `currentCustomerSession(req)` (`server/routes/portal.js`), whose
   `getCustomerSessionContext` (`server/customer-auth.js:135`) runs
   `pool.query`: a second connection. The only early exit is an empty cookie,
   so anyone on the internet can send ten or more requests at once with a
   made-up `wh_customer_session` cookie to `/api/portal/<shop>/me`, hold all
   ten connections, and stall every shop for 5 seconds. A shop's real
   customers checking their account at a busy moment hit the same stall.
2. **Three staff routes** in `server/routes/workshop.js` read the shop's slug
   with `pool.query` from inside `runWithShop`: issuing a job's link for Bike
   ready and booking messages (`issueJobLink`), the private link, and Use my
   phone's photo codes.

## What Changes

- The customer-route dispatcher in `server/server.js` looks up the customer's
  session once, before it takes the shop's connection, and only when the
  cookie is there. It remembers the answer on the request
  (`rememberCustomerSession`, `server/lib/session.js`), and
  `currentCustomerSession(req)` returns it.
- The three workshop lookups read the slug through the request's own
  connection (`db.prepare`), as `workshop.js` already does for the shop's
  phone. So does `jobMessageVars` (`server/workshop/job-messages.js`), which
  reads the shop's name right after `issueJobLink` on the same routes and from
  a public booking message; found while testing (design.md, "The fault" 3).
- No other behaviour changes: each route's own "signed in to this shop?"
  check, row-level security and the shop each request runs as are unchanged.

## Capabilities

### Modified Capabilities

- `customer-accounts`: a signed-in customer's request is looked up once,
  before it holds a connection.
- `workshop-jobs`: a job's link and a photo code are issued without a second
  connection.

## Work package and risk

A fault fix found by review of `server-connection-per-request`, taken by
Jack's session. **Risky areas:** `server/server.js`, and public routes and
customer accounts (`/api/portal/*`), so it needs `/review`. No migration, no
dependency, no screen change. No drawing or decision is touched; it follows
`openspec/changes/server-connection-per-request`.

## Out of scope

- `getCustomerSessionContext` itself, pool size and the 5-second wait.
- `own-messages.js`'s own `issueJobLink` (it runs from the messaging engine,
  not a request; not changed here).
