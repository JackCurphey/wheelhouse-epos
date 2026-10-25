# Tasks

One pull request, about 450 changed lines.

## 1. Tests first

- [x] 1.1 Server tests (`tests/staff-signin-workos.test.js`), against a live
  server with `STAFF_SIGNIN_PROVIDER=pretend`, going through start, the
  pretend page and the callback. They cover:
  - an owner signs in and `/api/auth/me` shows their shop;
  - a second sign-in uses the saved link after the email changes at WorkOS;
  - an email on no staff list, a turned-off login, and a login linked to
    someone else all get `not-on-staff`;
  - an unchecked email gets `unchecked`, and nothing is linked;
  - a missing or wrong `state` gets `failed`, with nobody signed in;
  - a code is used once;
  - with no provider, start goes to `signin=off`;
  - `POST /api/auth/login` refuses a right email and password with 410
    and "Staff sign in through WorkOS now";
  - shop sign-up still signs the new owner in;
  - signing out of a WorkOS session gives a `signOutUrl`, and a password
    session's sign-out doesn't;
  - the callback's rate limit.

  Watch each one fail for the right reason before the code exists.
- [x] 1.2 Real-provider tests with a stand-in `fetch`:
  - the authorize address has the right settings;
  - authenticate sends the API key as `client_secret` and reads `sid`;
  - the sign-out address is right;
  - a missing setting means not connected, with the setting named in the log.

  Watch each one fail.
- [x] 1.3 Hosted-copy guard test: an `sk_live_` WorkOS key is refused, and
  an `sk_test_` key isn't. Watch it fail.
- [x] 1.4 Screen test: the signed-out "Sign in" in the staff app goes to
  `/api/auth/workos/start`. Watch it fail.
- [x] 1.5 Migration test from an empty scratch database: 082 adds both
  columns, and an existing login and session are untouched.

## 2. Build

- [x] 2.1 Migration `082_staff_signin_workos.sql` (design 5). Checked by 1.5.
- [x] 2.2 `server/staff-signin/` (`provider.js`, `pretend.js`, `workos.js`),
  as design 2. Checked by 1.1 and 1.2.
- [x] 2.3 `createSession` keeps an optional WorkOS session id. The routes
  are start, the pretend page, the callback, and `signOutUrl` on sign-out
  (design 3 and 4). Update `tests/fixtures/route-list.txt`. Checked by 1.1.
- [x] 2.3a WorkOS only (design 7). Make these changes:
  - password sign-in answers 410;
  - `liveServer` sets the pretend provider;
  - update `tests/server-lifecycle.test.js:146`;
  - the staff app's "Sign in" link goes to WorkOS.

  Checked by 1.1 and 1.4.
- [x] 2.4 The `sk_live_` refusal in `server/hosted-copy-guard.js`. Checked by 1.3.
- [x] 2.5 Log in `docs/decisions/decided-while-building.md` (Jack's section):
  - the callback's new address;
  - the four `?signin=` reasons;
  - the pretend page's ticked "checked" box.

  Update `docs/decisions/2026-10-25-workos-account.md`'s addresses.

## 3. Check

- [x] 3.1 `/review`, because this is sign-in and a migration. Then
  `npm run lint`, `npm test` and `npm run test:browser`, all passing locally.
- [x] 3.2 Against the real test environment, once Jack has changed its
  Redirects (design 3):
  - start the app with `STAFF_SIGNIN_PROVIDER=workos`;
  - Jack signs in on WorkOS's page with his staff email and lands signed in;
  - then he signs out through `signOutUrl`.

  The proof is `/api/auth/me` before and after, and the server log.

  Done 25 Oct. Jack signed in on WorkOS's real test page as jack@curphey.com
  (a local-only shop) and signed out. His login was linked to his WorkOS
  person. WorkOS then listed only the session from his later sign-in as
  active. The server log was clean. For 3.1, an independent review found six
  points (sign-out not ending WorkOS's session in the staff app, no
  `return_to`, the old app as a dead end, two 500s on odd input, pretend on
  the hosted copy). Each was fixed with a test watched failing first. Lint,
  the type check and 127 browser tests pass. `npm test` passes 3313 of 3317.
  The other 4 fail on untouched `main` too: no `ADMIN_DATABASE_URL` on Jack's
  Mac.

## Workflow follow-up

- `/opsx:archive` as the last commit in the pull request, then merge when CI
  is green on it.
- Tell Mark in the pull request: the hosted test copy needs the WorkOS test
  keys and its address in WorkOS's Redirects (add-hosted-copy 3.6), and the
  label printer helper is waiting for its own key.
- Jack adds `STAFF_SIGNIN_PROVIDER=pretend` (or `workos`) to his `.env`.
- The next change, `staff-signin-workos-screens`: `auth-signedout`, `auth-expired`, the `?signin=` messages, and
  sign-out following `signOutUrl`.
