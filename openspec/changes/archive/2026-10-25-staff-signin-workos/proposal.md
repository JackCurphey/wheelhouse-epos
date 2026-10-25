# Proposal: staff sign in through WorkOS

## Why

Staff are meant to sign in on WorkOS's own pages, which check the password,
send reset emails and could later add Google or two-step sign-in, so
Wheelhouse never has to hold staff passwords (signing-in decision 2,
`docs/decisions/2026-09-29-signing-in-review.md:17-24`). This is WP-1.7's
staff half (build plan, `docs/superpowers/plans/2026-10-03-release-2-build-plan.md`,
WP-1.7; replan slice B). Jack takes it, with Mark's agreement (25 Oct).
Jack made the WorkOS account on 25 Oct, with its test (Staging) environment
set up and its keys checked (`docs/decisions/2026-10-25-workos-account.md`).
So this can be built against a pretend WorkOS and tried against the real
test account too.

**Risky area:** sign-in. It adds a migration (082) and touches `server/auth.js`
and the sign-in routes, so it needs `/review` before it merges.

## What Changes

**This change: the server**
- An adapter for staff sign-in, with two versions:
  - a **pretend** WorkOS, for tests and for building without the internet;
  - the **real** WorkOS, which uses the test keys in `.env`.
  `STAFF_SIGNIN_PROVIDER=pretend` or `workos` chooses one. If it's left out,
  nothing is connected and nobody can sign in, so a developer's `.env` names
  one.
- **BREAKING: staff sign in only through WorkOS** (Jack, 25 Oct: "lets do
  just work os").
  - `POST /api/auth/login` (email and password) refuses, saying staff sign
    in through WorkOS.
  - The new app's "Sign in" goes to WorkOS.
  - Passwords already stored are left alone but no longer used. Removing
    them is a later change.
- **`GET /api/auth/workos/start`** sends the person to WorkOS's sign-in page.
- **`GET /api/auth/workos/callback`** is where WorkOS sends them back. The
  person is signed in to Wheelhouse with the same 30-day session staff
  have today, if WorkOS has checked their email and it belongs to an active
  person on a shop's staff list. Otherwise they are sent back unsigned, with
  the reason.
- **Signing out** of a WorkOS sign-in also ends the WorkOS session, so the
  next person at that computer has to sign in again.
- **Migration 082:** a person's WorkOS id on their login, and the WorkOS
  session on each Wheelhouse session.
- The hosted test copy refuses to start with a live (`sk_live_`) WorkOS key.

**The next change (`staff-signin-workos-screens`): the screens**
- `auth-signedout` ("You've signed out", "Sign in again") and `auth-expired`
  (`docs/design/user-journeys/generator/signin.mjs:64-65`).
- The message when an email isn't on any staff list.

## Capabilities

### New Capabilities

- `staff-sign-in`: how staff sign in to Wheelhouse and sign out again.

## Out of scope

- **The label printer helper's own key.** The helper signs in with a staff
  password (`print-agent/main.js:69-71`), so it stops working when this
  merges, until a later change gives it its own key. Jack chose this,
  knowing it, on 25 Oct.
- **The hosted test copy's sign-in.** The test copy runs as production, so
  the pretend WorkOS refuses to run there. It needs the WorkOS test keys
  and its own address added to WorkOS's Redirects before anyone can sign in
  to it. Mark's add-hosted-copy task 3.6 ("make Jack's test login") changes
  to match.
- **Shop sign-up and adding a person** still ask for a password, which is
  stored but no longer used. Taking the password boxes out goes with the
  old app's screens.
- **Roles and permissions** are WP-1.1 (Mark). `is_owner` stays as it is.
- **Inviting staff through WorkOS.** A person signs in through WorkOS with the
  email the shop already has for them, and is linked the first time.
- **One person in several shops**, and "Where are you working today?"
  (`auth-site`). A login's email stays unique across Wheelhouse for now.
- **Till PINs and the shared workshop computer** (`pin-first`, `pin-change`,
  walk-through 8 decisions 1 and 3) are later WP-1.7 changes. They never
  depend on WorkOS (signing-in decision 3).
- **Customers moving to WorkOS Magic Auth.** That's a separate change on top
  of `customer-accounts`.
- **The production WorkOS environment.** It waits until Wheelhouse is hosted
  for real.
