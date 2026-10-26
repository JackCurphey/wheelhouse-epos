# Proposal: a request never waits for a second database connection

## Why

Each signed-in staff request checks out one pooled connection for its shop
(`runWithShop`, `server/db.js`) and keeps it until it finishes. Many handlers
then ask "who is signed in?" again from inside that scope (`ownerOnly` in
`server/lib/owner-only.js`, and direct `currentSession(req)` calls in the route
files). That second question runs `getSessionContext` (`server/auth.js`),
which uses `pool.query`, so it needs a *second* connection from the same pool
of 10. With ten such requests at once, all ten connections are held and every
one waits for an eleventh; after the 5-second `connectionTimeoutMillis` they
all fail with 500. A shop's owner saving settings on a few screens at once, or
any small burst across shops, can hit it.

## What Changes

- The request dispatcher in `server/server.js` already looks up the signed-in
  session once, before it takes the shop's connection. It now remembers that
  answer on the request (`rememberSession` in `server/lib/session.js`).
- `currentSession(req)` returns the remembered answer when there is one, so a
  handler asking again needs no connection at all.
- No other behaviour changes: same session, same login, same shop, same
  Owner check, same row-level security.

## Capabilities

### Modified Capabilities

- `staff-sign-in`: a signed-in request is looked up once, before it holds a
  connection.

## Touches

`server/server.js` (one line) and `server/lib/session.js`: a risky area
(`server/server.js`, sign-in), so it needs `/review`. No migration, no
dependency.

## Out of scope

- Other places a handler might use `pool.query` from inside its shop scope
  (none is changed here; see design.md "Not covered").
- Pool size and the 5-second timeout stay as they are.
