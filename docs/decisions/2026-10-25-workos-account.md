# Who makes the WorkOS account

The build plan's Q10 (`2026-10-03-build-plan-questions.md`) listed the WorkOS
sign-in account among the accounts Mark would set up, and the build plan's
outside-services table says "Mark: WorkOS account (Q10)".

## Answer

1. **Jack makes it himself.** Jack, 25 Oct: "Option 2: I'll create the WorkOS
   account myself now." This changes Q10 for WorkOS only; the other accounts
   in Q10 are unchanged.

## Where it stands (25 Oct)

- The account exists, owned by Jack. Only its **Staging** (test) environment
  is set up; Production waits until Wheelhouse is hosted for real.
- Staging's addresses (Applications → Redirects), matching the 31 Aug design
  (`docs/superpowers/specs/2026-08-31-workos-auth-migration-design.md`):
  Redirect URI `http://localhost:8080/callback`, Initiate login URI
  `http://localhost:8080/api/auth/login`, Sign-out URI `http://localhost:8080/`.
- Jack's local `.env` holds `WORKOS_API_KEY` (a staging `sk_test_` key),
  `WORKOS_CLIENT_ID` and `WORKOS_COOKIE_PASSWORD`. Keys are never committed.
- Checked 25 Oct with a one-off script outside the repo: WorkOS accepted the
  API key (HTTP 200) and sent the client ID with the localhost:8080 redirect
  to its sign-in page. The same script failed as it should on a wrong key
  (HTTP 401), a wrong client ID (`client-id-invalid`) and an unregistered
  redirect address (`redirect-uri-invalid`).
- Cost, from WorkOS's pricing page on 25 Oct: the first 1 million monthly
  active users are free.

## What this doesn't change

The app's sign-in is still its own (`server/auth.js`). WorkOS sign-in for
staff is built in WP-1.7 (Sign-in and PINs), as an OpenSpec change, and can
now run against the real staging account as well as the pretend one. Mark,
or anyone else setting up their own copy, needs the staging keys from Jack,
or a WorkOS account of their own, to run it.
