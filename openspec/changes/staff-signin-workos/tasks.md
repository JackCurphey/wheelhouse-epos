# Tasks

One pull request, about 450 changed lines.

## 1. Tests first

- [ ] 1.1 Server tests (`tests/staff-signin-workos.test.js`), against a live
  server with `STAFF_SIGNIN_PROVIDER=pretend`, going through start, the
  pretend page and the callback. They cover:
  - an owner signs in and `/api/auth/me` shows their shop;
  - a second sign-in uses the saved link after the email changes at WorkOS;
  - an email on no staff list, a turned-off login, and a login linked to
    someone else all get `not-on-staff`;
  - an unchecked email gets `unchecked`, and nothing is linked;
  - a missing or wrong `state` gets `failed`, with nobody signed in;
  - a code is used once;
  - with no provider, start goes to `signin=off`, and password sign-in
    still works;
  - signing out of a WorkOS session gives a `signOutUrl`, and a password
    session's sign-out doesn't;
  - the callback's rate limit.

  Watch each one fail for the right reason before the code exists.
- [ ] 1.2 Real-provider tests with a stand-in `fetch`:
  - the authorize address has the right settings;
  - authenticate sends the API key as `client_secret` and reads `sid`;
  - the sign-out address is right;
  - a missing setting means not connected, with the setting named in the log.

  Watch each one fail.
- [ ] 1.3 Hosted-copy guard test: an `sk_live_` WorkOS key is refused, and
  an `sk_test_` key isn't. Watch it fail.
- [ ] 1.4 Migration test from an empty scratch database: 082 adds both
  columns, and an existing login and session are untouched.

## 2. Build

- [ ] 2.1 Migration `082_staff_signin_workos.sql` (design 5). Checked by 1.4.
- [ ] 2.2 `server/staff-signin/` (`provider.js`, `pretend.js`, `workos.js`),
  as design 2. Checked by 1.1 and 1.2.
- [ ] 2.3 `createSession` keeps an optional WorkOS session id. The routes
  are start, the pretend page, the callback, and `signOutUrl` on sign-out
  (design 3 and 4). Update `tests/fixtures/route-list.txt`. Checked by 1.1.
- [ ] 2.4 The `sk_live_` refusal in `server/hosted-copy-guard.js`. Checked by 1.3.
- [ ] 2.5 Log in `docs/decisions/decided-while-building.md` (Jack's section):
  - the callback's new address;
  - the four `?signin=` reasons;
  - the pretend page's ticked "checked" box.

  Update `docs/decisions/2026-10-25-workos-account.md`'s addresses.

## 3. Check

- [ ] 3.1 `/review`, because this is sign-in and a migration. Then
  `npm run lint`, `npm test` and `npm run test:browser`, all passing locally.
- [ ] 3.2 Against the real test environment, once Jack has changed its
  Redirects (design 3):
  - start the app with `STAFF_SIGNIN_PROVIDER=workos`;
  - Jack signs in on WorkOS's page with his staff email and lands signed in;
  - then he signs out through `signOutUrl`.

  The proof is `/api/auth/me` before and after, and the server log.

## Workflow follow-up

- `/opsx:archive` as the last commit in the pull request, then merge when CI
  is green on it.
- The next change, `staff-signin-workos-screens`: "Sign in" goes to WorkOS,
  plus `auth-signedout`, `auth-expired`, the `?signin=` messages, and
  sign-out following `signOutUrl`.
