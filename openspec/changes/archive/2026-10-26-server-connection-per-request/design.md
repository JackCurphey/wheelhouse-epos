# Design: a request never waits for a second database connection

## The fault

- `server/server.js:647` (the `/api/` dispatcher, the `currentSession(req)` call
  before `runWithShop`) looks up the staff session, then
  `runWithShop(ctx.shop.id, ...)` checks out one pooled client
  (`server/db.js`, `runWithShop`, `pool.connect()`) and holds it until the
  handler finishes.
- Inside that scope, the handler asks again. `ownerOnly` in
  `server/lib/owner-only.js:10` calls `currentSession(req)`, and 37 other
  direct `currentSession(req)` calls in `server/routes/*.js` do the same.
- `currentSession` (`server/lib/session.js`) calls `getSessionContext`
  (`server/auth.js:210`), which runs three `pool.query` calls. Each needs a
  connection of its own from the same pool (`max: 10`,
  `connectionTimeoutMillis: 5000`, `server/db.js:42` and `:63`).
- So each request needs two connections at once. With 10 or more such requests
  together, all 10 are held by requests waiting for an eleventh. None can
  finish, and after 5 seconds every one fails with 500 "timeout exceeded when
  trying to connect".

## The change

1. `server/lib/session.js`: a `WeakMap` keyed by the request object, with
   `rememberSession(req, ctx)` to store an answer. `currentSession(req)`
   returns the stored answer when there is one. With none, it does exactly
   what it did before.
2. `server/server.js:651`: straight after the dispatcher's own
   `currentSession(req)` succeeds (and after the 401 for no session), it calls
   `rememberSession(req, ctx)`. That's one line, before `runWithShop`.

A handler's later "who is signed in?" no longer touches the database, so a
request holds at most one connection at a time.

## Why shop isolation is unchanged

- **Row-level security is untouched.** `runWithShop`, `set_config`, the
  release path and the policies are not edited. The shop a request runs as is
  still `ctx.shop.id` from the same single lookup it used before.
- **The answer can't reach another request.** The key is the `req` object Node
  makes for each HTTP request. A `WeakMap` entry can only be read by code
  holding that same object, and it is dropped when the request is collected.
  There is no shared "last session" and no key built from a cookie or id.
  Mutation 3 below shows the test fails if the answer is shared.
- **Owner-only checks see the same answer as before.** Before, `ownerOnly`
  repeated the lookup a few milliseconds after the dispatcher's. Now it reads
  the dispatcher's result: the same login row, the same `is_owner` and the
  same shop. The only difference is a session ended or a login switched off
  in those milliseconds between the two lookups. The old code could catch
  that; the new code can't, so the request carries on as it was authorised at
  its start. That is how every non-owner route already works (it trusts the
  dispatcher's single lookup).
- **Only the `/api/` staff dispatcher remembers.** `/api/auth/*` routes (sign
  in, sign out) run before this line and are never remembered. A sign-out
  handler that calls `currentSession` still does a fresh lookup. Portal and
  storefront paths do not call `rememberSession`.
- **Dev auto sign-in**: the dispatcher's lookup already included
  `devSession(req)`. The remembered answer is that same result, so its
  localhost and write-origin checks still apply.

## Tests

`tests/connection-per-request.test.js` boots the real server and opens all 10
pooled connections with a warm-up burst. That matters: with a cold pool, the
time taken to open each new connection spread the burst out and the stall did
not show. Then:

1. It sends 12 `PUT /api/label-settings` from the Owner at once and expects
   all 12 to return 200 in under 4 seconds (under the 5-second wait).
2. It sends 6 + 6 such requests from two shops' owners, plus one from a
   non-owner staff member, all at once. All the owners get 200, the staff
   member gets 403 `owner_only`, and each shop reads back only its own width.

Before the fix, both tests failed three runs out of three: all 12 answers were
500 "timeout exceeded when trying to connect", taking about 5.6 seconds.

Mutation checks (each confirmed in the file, run, then restored):

1. The dispatcher's `rememberSession` line commented out: both tests failed
   with the 5-second timeouts.
2. `currentSession` ignoring the remembered answer: both tests failed in the
   same way.
3. One shared answer for every request (`remembered.last`): test 1 passed and
   test 2 failed. The staff member got 200, because they had been given an
   owner's session from the other shop. So test 2 guards against an answer
   leaking from one request to another.

## Not covered (same kind of fault, left alone to keep this small)

- Customer portal routes call `currentCustomerSession(req)` from inside
  `runWithShop` (`server/routes/portal.js:363`, `:800`, `:822`, `:996`,
  `:1024`, `:1050`, `:1065`, `:1078`). `getCustomerSessionContext` uses
  `pool.query`, so a burst of signed-in customer requests can stall in the
  same way. Those routes do their own lookup, so there is no earlier answer to
  reuse. The fix would be a different shape.
- `server/routes/workshop.js:315`, `:467`, `:490` run `pool.query` (the shop's
  slug) from inside a handler. That is the same second connection, but only on
  those routes.
