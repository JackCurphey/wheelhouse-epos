# Design: the shop's website never waits for a second database connection

Follows `openspec/changes/server-connection-per-request` (the staff
`rememberSession`), on the same pool: `max: 10`, `connectionTimeoutMillis:
5000` (`server/db.js`).

## The fault

1. **Customer routes.** The portal branch of the dispatcher
   (`server/server.js`, `/api/portal/`) looks up the shop by `:shopSlug`, then
   `runWithShop(shop.id, ...)` holds one pooled connection for the request.
   Eleven routes in `server/routes/portal.js` then call
   `currentCustomerSession(req)` (`/me`, `/me/contact`, `/bikes` GET and POST,
   `/quotes/:id`, its decision and approve, `/bookings` GET and POST,
   `/history`, and `resolveBookingLink` for `job-<id>`). That runs
   `getCustomerSessionContext` (`server/customer-auth.js:135`), whose
   `pool.query` needs a second connection. Its only early exit is an empty
   cookie, so a made-up `wh_customer_session=x` is enough.
2. **Staff link lookups.** `server/routes/workshop.js` read the shop's slug
   with `pool.query` inside the request: `issueJobLink` (Bike ready, booking
   messages, Send quote, within-limit, the quote's answer, job notes), the
   private link, and Use my phone's photo codes.
3. **Found while testing 2:** `jobMessageVars`
   (`server/workshop/job-messages.js`) read the shop's name with `pool.query`.
   It runs straight after `issueJobLink` on the same routes, and from the
   public `sendLinkMessage` (`server/routes/portal.js`, through
   `bookingMessageVars`). The Send quote burst could not pass without it.

## The change

1. `server/lib/session.js`: a second `WeakMap` keyed by the request object.
   `rememberCustomerSession(req)` reads the customer cookie and, only when it
   is there, stores `getCustomerSessionContext`'s answer (a session or null).
   `currentCustomerSession(req)` returns the stored answer when there is one;
   with none it does exactly what it did before (with no cookie that is an
   early `null`, no query).
2. `server/server.js`, the portal branch: `await rememberCustomerSession(req)`
   just before `runWithShop`, inside the existing `try`, so a database fault
   there is a 500 for that request, as a fault in the handler already is.
   Sign-up, log-in and log-out run before this and are unchanged.
3. `server/routes/workshop.js` (`issueJobLink`, private link, photo codes) and
   `server/workshop/job-messages.js` (`jobMessageVars`): the same lookup
   through the request's own connection, `db.prepare('SELECT slug FROM shops
   WHERE id = ?').get(shopId)`, as `workshop.js` already does for the shop's
   phone (Send within-limit). `shops` has no row-level security, and `shopId`
   is unchanged: the dispatcher's `ctx.shop.id`. Every caller of
   `issueJobLink` (and `queueBikeReady`) already passes `req`, `jobId` and
   `shopId` from a staff handler inside `runWithShop`, and `jobMessageVars`'s
   other caller, `own-messages.js`, runs inside the engine's `runWithShop`; a
   call outside one would now throw "No database client in scope" rather than
   quietly use another connection.

## Why shop isolation is unchanged

- **Row-level security is untouched.** `runWithShop`, `set_config`, the
  policies and the shop each request runs as are not edited. A portal request
  still runs as the shop its `:shopSlug` names, from the same lookup.
- **Each route still checks the customer belongs to this shop.** The portal
  routes' `ctx.shop.slug !== params.shopSlug` checks and `resolveBookingLink`'s
  `ctx.shop.id` against `app.current_shop_id` are not edited. The remembered
  answer is the same `{ login, shop }` the route used to fetch itself, from the
  same cookie, a few milliseconds earlier. A session ended in those
  milliseconds is the only difference, as for staff.
- **The answer can't reach another request.** It is keyed by the `req` object
  Node makes for each HTTP request, never by a cookie, id or "last" value, and
  is dropped with the request. Mutation 3 below shares one answer between
  requests and the isolation test fails.
- **The staff link lookups read the same row.** Only the connection changes:
  the request's own instead of a second pooled one. `shopId` still comes from
  the signed-in session.

## Tests

`tests/portal-connection-per-request.test.js` boots the real server, signs
Maya in to North Street Cycles by emailed code (pretend provider), and opens
all 10 pooled connections with a warm-up burst first (a cold pool spreads a
burst out and hides the stall). Then, 12 at once each:

1. `/me` with a made-up cookie: all 401, under 4 seconds.
2. `/booking-links/job-<id>` with a made-up cookie: all 404, under 4 seconds.
3. Maya's own `/me` and `job-<id>`: all 200, under 4 seconds.
4. Isolation: Maya's cookie at Elsewhere Cycles gets 401 from `/me`, `/bikes`,
   `/bookings`, `/history` and 404 from `job-<id>`; then a mixed burst (Maya at
   North Street, a made-up cookie, no cookie, Maya at Elsewhere) gets 200,
   401, 401, 401 each.
5. 12 private links: all 201, each `/book/<north-street>/booking/<code>`.
6. 12 photo codes: all 201, each on North Street's pages.
7. 12 quotes sent for a customer with no contact (so Send returns the link
   from `issueJobLink`): all 200, each link on North Street's pages.

Before the fix: tests 1, 2, 3, 5 and 6 failed with 500 "timeout exceeded when
trying to connect" after about 5 seconds. In the whole-file run the server
process then exited (see "Not covered" 1) and test 7 failed on a refused
connection, so 6 and 7 were rerun alone: 6 failed with the timeouts at
`workshop.js:490`; 7 failed after 10.9 seconds with two 500s and ten
`link: null`, the timeouts at `job-messages.js:58`. With only the portal part
fixed, 1 to 4 passed and 5 to 7 still failed. Test 4 passed before the fix, as
it should: it guards the fix, not the fault.

Mutation checks (each confirmed in the file by grep, run, restored, and the
restore checked byte for byte against a saved copy):

1. The dispatcher's `rememberCustomerSession` call commented out: tests 1, 2,
   3 failed with the 5-second timeouts.
2. `currentCustomerSession` ignoring the remembered answer: tests 1, 2, 3
   failed the same way.
3. One shared answer for every request (`rememberedCustomers.last`): test 4
   failed: the made-up-cookie and no-cookie requests got Maya's account (200).
   Maya at Elsewhere still got 401, from the route's own shop check.
4. `issueJobLink` back on `pool.query`: test 7 failed (10.2 seconds).
5. The private link back on `pool.query`: test 5 failed.
6. Photo codes back on `pool.query`: test 6 failed.
7. `jobMessageVars` back on `pool.query`: test 7 failed.

## Not covered (left alone to keep this small)

1. **A pool timeout in the dispatcher's own lookups stops the server.** The
   staff `currentSession(req)` (`server/server.js`, `/api/` branch) and the
   portal's shop lookup (`pool.query` on `shops` by slug) sit outside any
   `try`. Seen in the first test run: a timeout there became an unhandled
   rejection and the process exited ("Fatal: unhandled promise rejection").
   With this change the burst no longer exhausts the pool, but anything else
   that does would take every shop down rather than fail one request.
2. Same second-connection lookup still in request paths:
   `server/messaging/service-reminders.js:68` and `:102`,
   `server/messaging/review-requests.js:24` and `:47` (both reached from
   workshop routes), and `server/messaging/own-messages.js:65` (the messages
   engine, one shop at a time). These are the messaging core, a separate
   risky area.
