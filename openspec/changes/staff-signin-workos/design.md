# Design: staff sign in through WorkOS

## Context

Today staff sign in with an email and password (`POST /api/auth/login`,
`server/routes/auth.js:71`). Wheelhouse holds the password and makes a 30-day
session: the `sessions` table and the `wh_session` cookie (`server/auth.js:152-183`).
The 31 Aug design (`docs/superpowers/specs/2026-08-31-workos-auth-migration-design.md`)
would have replaced all of that with WorkOS's sealed cookie and dropped the
session tables. Since then, 192 test files, the till's own token, the label
printer helper and 44 `currentSession(req)` calls have come to rely on
`wh_session`. Customers have also moved to Wheelhouse's own emailed-code
screens (`customer-accounts`). So this design keeps Wheelhouse's own
sessions, and uses WorkOS only to prove who the person is. WorkOS becomes
the only way staff sign in (Jack, 25 Oct; decision 7).

## Decisions

### 1. WorkOS proves who you are; Wheelhouse keeps its own session
After WorkOS sends the person back, Wheelhouse makes the same session and
cookie it makes today (`createSession`). Nothing downstream changes: `/me`,
the till, the tests' helpers and the print helper all work as they do now.
The 30-day rule (`2026-10-07-stage-1-drawing-gaps.md:212`) stays
Wheelhouse's, and doesn't depend on what WorkOS allows (unchecked, :333).
*Not chosen:* WorkOS's sealed cookie (the 31 Aug design), which would break
every signed-in test and the print helper in one go.

### 2. An adapter with pretend and real versions
`server/staff-signin/provider.js` follows `server/signin/provider.js`:
`STAFF_SIGNIN_PROVIDER` chooses `pretend` or `workos`, and `null` when it's
unset. Each provider has three parts:
- `authorizeUrl({ state, redirectUri })` gives the page to send the person to.
- `authenticate({ code, redirectUri })` gives back
  `{ user: { id, email, emailVerified }, sessionId }`.
- `logoutUrl({ sessionId })` gives WorkOS's sign-out address, or null.

- **Real:** plain `fetch` against WorkOS's own API, checked in its docs on
  25 Oct. No SDK, so no new dependency for three calls.
  - Authorize: `GET https://api.workos.com/user_management/authorize`
    with `client_id`, `redirect_uri`, `response_type=code`,
    `provider=authkit` and `state`.
  - Authenticate: `POST https://api.workos.com/user_management/authenticate`
    with `client_id`, `client_secret` (the API key),
    `grant_type=authorization_code` and `code`. The session id is the
    access token's `sid` claim. The token comes straight from WorkOS over
    HTTPS, and only `sid` is read, so it isn't verified.
  - Sign out:
    `https://api.workos.com/user_management/sessions/logout?session_id=…`.
  - Settings: `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, and
    `WORKOS_REDIRECT_URI` (default `http://localhost:8080/api/auth/workos/callback`).
    If a setting is missing, the provider counts as not connected, and the
    server log names the missing setting.
- **Pretend:** answers as WorkOS does, without the internet.
  - Its authorize page is `GET /api/auth/workos/pretend`: a plain form
    with an email box and a "WorkOS has checked this email" box, ticked by
    default.
  - Posting the form makes a one-use code, valid for 10 minutes, and goes
    back to the callback with it.
  - The codes live in memory. The pretend version is for one server
    process only: tests and a developer's machine.
  - User ids are `user_pretend_` plus a hash of the email.
  - It refuses to run when `NODE_ENV=production` or on the hosted test copy (`WHEELHOUSE_HOSTED_COPY=1`), since anyone could sign in as anyone on its page.

### 3. Routes
All three sit under `/api/auth/`, outside the session check, as sign-in does
today (`server/server.js:636`).
- **`GET /api/auth/workos/start`:**
  - makes a random `state`;
  - stores it in a 10-minute, HttpOnly, SameSite=Lax cookie (`wh_signin_state`);
  - sends the person to `authorizeUrl`.

  With no provider, it sends them to `/?signin=off`.
- **`GET /api/auth/workos/callback`:**
  - checks that `state` matches the cookie, which stops a sign-in link made
    elsewhere from signing this browser in;
  - calls `authenticate`;
  - finds the login (decision 4);
  - makes the session, with WorkOS's session id saved on it (migration 082);
  - ends any session this browser already had, makes the new one, clears the state cookie and sends the person to the staff app, `/workshop`. Its signed-out page links to WorkOS; the old app at `/` no longer can (review).

  Each failure sends them to `/workshop?signin=<reason>`, where the next change's
  screens show the message. The reasons are `off`, `failed` (a bad state,
  or WorkOS refused the code), `unchecked` (WorkOS hasn't checked the email),
  `not-on-staff`, and `busy`. `busy` is the callback's limit, the same as
  password sign-in's was: 10 tries per network every 15 minutes.
- **`POST /api/auth/logout`:** as today, and when the session has a WorkOS
  session id, the reply adds `signOutUrl`. The next change's screens go
  there. The staff app's Sign out goes to it (or to `/workshop` when there's
  none); the old app ignores it. WorkOS's sign-out address carries
  `return_to`, the app's own address, the Sign-out URI in its Redirects.

The callback path is new. Jack changes the test environment's Redirects
(redirect URI `…/api/auth/workos/callback`, sign-in start
`…/api/auth/workos/start`). `/callback` from the 25 Oct note isn't routed,
because only `/api/…` paths skip the static files.

### 4. Linking a WorkOS person to the staff list
1. Look for a login with this `workos_user_id`.
2. If there is none, look for one whose email matches (logins' emails are
   unique across Wheelhouse, `001_init_schema.sql:38`) and that isn't
   linked yet. Save the link.
3. A login that is turned off, has no match, or is linked to a different
   WorkOS person gives `not-on-staff`. All three get the same answer, so
   nobody can test which emails exist.
4. An email WorkOS hasn't checked gives `unchecked`, and nothing is linked.
   Otherwise anyone could make a WorkOS account with a shop owner's email.

### 5. Migration 082
```sql
ALTER TABLE logins   ADD COLUMN workos_user_id    TEXT UNIQUE;
ALTER TABLE sessions ADD COLUMN workos_session_id TEXT;
```
Both tables are the shop registry: no `shop_id` and no row-level security
(`server/auth.js:1-8`), so neither column needs a policy. Nothing is dropped.
Password sign-in keeps working.

### 6. The hosted test copy
`hostedCopyRefusal` refuses a `WORKOS_API_KEY` starting `sk_live_`. Test keys
(`sk_test_`) are allowed: they only reach WorkOS's test environment.
`WORKOS_` isn't added to `REAL_KEY_PREFIXES`, which would refuse test
keys too.

### 7. WorkOS only (Jack, 25 Oct)
- **`POST /api/auth/login`** answers 410 with "Staff sign in through
  WorkOS now", whatever the email and password. The route stays so the old
  app and the print helper get a clear answer, not a 404.
  `tests/server-lifecycle.test.js:146`, the one test that posts to it,
  changes to expect this.
- **Shop sign-up** still signs the new owner straight in, as today. It needs
  the private sign-up code, so it isn't a way round WorkOS. The next time the
  owner signs in, it's through WorkOS with the same email.
- **The new app's "Sign in"** (`src/staff/staff-layout.tsx:248-256,275`)
  goes to `/api/auth/workos/start` and no longer to the old app's password
  form.
- **No provider:** nobody can sign in, apart from a new shop's sign-up.
  `tests/helpers/liveServer.js` sets `STAFF_SIGNIN_PROVIDER=pretend`, as it
  does for payments. Each developer's `.env` needs
  `STAFF_SIGNIN_PROVIDER=pretend` or `workos`.
- **Breaks, knowingly:**
  - the label printer helper, until it has its own key (a later change);
  - signing in to the hosted test copy, until it has the WorkOS test keys
    and its address is in WorkOS's Redirects. Mark's add-hosted-copy 3.6 is
    told.

## Risks

- **Sign-in is a risky area**, so this needs `/review` before it merges.
- **Someone else's email:** decision 4's "checked email only" rule is the
  guard. WorkOS checks emails on its sign-up by default.
- **The old app's sign-out** leaves the WorkOS session alive until the next
  change's screens use `signOutUrl`. Signing in again then goes straight
  through WorkOS without a password for a while. At a shared computer that
  matters, so the next change's sign-out comes straight after this one.
- **Label printing stops** for anyone using the helper until it has its own
  key. No real shop uses Wheelhouse yet.
- **The real provider** is tested against a stand-in `fetch` in the automated
  tests. Only Jack can sign in on the real test page, so the manual check
  against Staging is his, with the steps in tasks.md.
