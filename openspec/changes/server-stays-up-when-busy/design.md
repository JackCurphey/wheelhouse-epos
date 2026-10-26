# Design: one failed lookup never takes every shop down

Follows `server-connection-per-request` and `portal-connection-per-request`
(both archived 26 Oct), on the same pool: `max: 10`,
`connectionTimeoutMillis: 5000` (`server/db.js`).

## The fault

1. **The dispatcher's own steps.** `server/server.js`'s request handler did
   four things outside any `try` before a route's own `try`:
   - `decodeURIComponent(url.pathname)` (was line 421): an address with a bad
     escape (`/%ZZ`) throws `URIError`.
   - `resolveStorefrontShop` (was line 441, `pool.query` in
     `server/storefront.js:89`): `?storefrontSlug=%00` on any address.
   - the website's shop lookup (was line 610, `pool.query` on `shops` by
     `:shopSlug`): `/api/portal/%00/...`.
   - the staff `currentSession(req)` (was line 650): a `wh_session` cookie of
     `%00` (refused by Postgres) or `%ZZ` (`URIError` in `parseCookies`).

   Each is an `async` handler's rejection that nothing catches, so the crash
   guard (`installCrashGuard`) logs "Fatal: unhandled promise rejection" and
   exits. A pool whose 5-second wait runs out at the same four places does the
   same. None needs a sign-in.
2. **Second connections in the messaging core**, each reached from inside a
   `runWithShop` (checked by following every caller):
   - `reminderVars` (`server/messaging/service-reminders.js:68`) and
     `reviewVars` (`server/messaging/review-requests.js:24`): from
     `queueServiceReminder` / `queueReviewRequest`, called by the collect
     route (`server/routes/workshop.js:1095`, inside the dispatcher's
     `runWithShop`), and from `serviceReminderNow` / `reviewRequestNow`,
     called by the engine inside its own `runWithShop`
     (`server/messaging/engine.js:227`).
   - The stop-link slug lookups (`service-reminders.js:102`,
     `review-requests.js:47`): the same callers, but only inside
     `messageLink`, which runs them only once sending is real. Sending is
     pretend everywhere today (`isPretend()` returns `true`), so these are not
     reached yet. Moved all the same, as the same fault.
   - `shopRow` (`server/messaging/own-messages.js:65`): from
     `queueOwnMessages`, called by the engine inside `runWithShop`
     (`engine.js:223`). Reached today for a sale (`varsFor`); for a job only
     once sending is real.
   - `createCustomerSession` (`server/customer-auth.js:128`): from sign-in by
     code (`server/routes/portal.js:781`), inside the portal branch's
     `runWithShop`. Its other callers, sign-up (`:722`) and log-in (`:747`),
     run in the dispatcher's sign-up/log-in/log-out branch, outside any
     `runWithShop`, so they are not this fault.

## The change

1. `server/server.js:419`: the handler body becomes `async function
   dispatch(req, res)`, and `createServer` calls it with one `.catch`: log the
   error, answer 500 `{ error: 'Internal server error' }` if nothing has been
   sent, else end the connection. One place covers all four steps and any
   later one. Each branch's own `try` is unchanged, so a route's error still
   answers as before. 500, not 503, because that is what the rest of the
   dispatcher answers, and the message is the generic one rather than
   `err.message`, since these requests need no sign-in.
2. The five messaging lookups use `prepare('SELECT ... FROM shops WHERE id =
   ?').get(shopId)`, as `workshop.js` and `job-messages.js` already do. `pool`
   is no longer imported by those three files, so a new `pool.query` there
   would need a new import.
3. `createCustomerSession(loginId, { onShopConnection: true })` from sign-in
   by code: the row goes on the request's own connection
   (`prepare(...).get`). Without the option it uses the pool exactly as before,
   for sign-up and log-in.

## Why shop isolation is unchanged

- **Row-level security is untouched.** `runWithShop`, `set_config`, the
  policies and the shop each request runs as are not edited.
- **The dispatcher's catch only catches what used to stop the process.** It
  runs after every branch's own `try`, so it never sees a route's error, never
  chooses a shop, and answers with a fixed message, so no error text from a
  lookup reaches the caller. Every connection is already back in the pool
  when it runs (`runWithShop` releases in its own `finally`; the four steps
  run before any `runWithShop`).
- **The messaging lookups read the same row.** `shops` has no row-level
  security (none of the migrations turns it on), and each query names its row
  with `WHERE id = shopId`, the same `shopId` as before, from the
  dispatcher's session (`ctx.shop.id`) or the engine's loop over shops. Only
  the connection changes: the shop's own, which is scoped to that same
  `shopId`. Outside a shop's scope `prepare` throws "No database client in
  scope" rather than quietly using another connection.
- **The customer's sign-in row is the same row.** `customer_sessions` has no
  shop column and no row-level security (`server/customer-auth.js:9`); a
  session belongs to a shop through its `customer_login_id`, and the login
  comes from `loginForSignedInEmail(shop.id, email)`, unchanged. In
  `DB_TENANT_SCOPE=transaction` the row now commits with the request's own
  transaction, so a sign-in whose request fails afterwards leaves no session
  behind (before, it did).

## Tests

- `tests/server-stays-up.test.js`, each case on its own server: a staff
  cookie `%00` and `%ZZ`, `/api/portal/%00/services`, `/?storefrontSlug=%00`
  and `/%ZZ` each get 500 `{ error: 'Internal server error' }`, then
  `/healthz` answers 200.
- `tests/messaging-connection-per-request.test.js`: after a warm-up burst, 12
  collections at once all answer 200 in under 4 seconds and each job has its
  service reminder and review request waiting. Then, in this test's own
  process with 9 of its 10 connections held, `serviceReminderNow`,
  `reviewRequestNow` and `queueOwnMessages` (an after-sale message) each
  finish in under 4 seconds with the shop's name in the words.
- `tests/portal-connection-per-request.test.js`, test 10: 12 customers enter
  their emailed codes at once; all 200 in under 4 seconds, and each cookie
  opens that customer's own `/me`.

Before the fix:
- All five dispatcher cases failed: the request's socket closed
  (`UND_ERR_SOCKET`) and the server log showed "Fatal: unhandled promise
  rejection", from `server.js:650` (staff session; `http.js:14` for `%ZZ`),
  `:610` (website shop), `:441` (`storefront.js:89`) and `:421` (address).
- Collections: 2 of 12 answered "timeout exceeded when trying to connect"
  after about 11 seconds, and the logs showed every reminder and review
  request failing to be set up at `service-reminders.js:68` and
  `review-requests.js:24`.
- Written when it goes: both timed out after about 5 seconds at the same two
  lines; the after-sale message at `own-messages.js:65`.
- Sign-in by code: 500s with the timeouts at `customer-auth.js:128`, 5.7
  seconds.

Mutation checks (each confirmed in the file by grep, run, restored by copying
back a saved copy and checked byte for byte with `cmp`):

1. The dispatcher's catch rethrows (`throw err;` first): all five dispatcher
   cases failed with `UND_ERR_SOCKET`.
2. `reminderVars` back on `pool.query`: the collections and "a
   service_reminder is written" failed; the other two passed.
3. `reviewVars` back on `pool.query`: the collections and "a review_request
   is written" failed; the other two passed.
4. `shopRow` back on `pool.query`: only the after-sale test failed.
5. Sign-in by code with `onShopConnection: false`: test 10 failed with the
   timeouts at `customer-auth.js`.

Not seen red: the two stop-link lookups (`service-reminders.js:104`,
`review-requests.js:49`) and own messages' job-link `shopRow` call. No test
can reach them while sending is pretend.

## Not covered (left alone to keep this small)

1. `validateNewLogin` (`server/auth.js:74`, `pool.query` on `logins`) runs
   from the Owner adding a team member (`server/team.js`), inside the shop's
   connection: the same second connection, on an Owner-only screen.
2. An address with a bad escape now gets 500; 400 would be more exact.
3. A pool that is really exhausted at the dispatcher is not tested directly
   (the server's pool lives in another process); the refused values above
   reach the same code paths.
