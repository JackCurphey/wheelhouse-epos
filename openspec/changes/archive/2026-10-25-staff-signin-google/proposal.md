# Proposal: staff sign in with Google from Wheelhouse's own screen

## Why

Jack wants Google sign-in to feel part of Wheelhouse, not a trip to another
site (25 Oct). He chose a "Continue with Google" button on Wheelhouse's own
sign-in screen that goes straight to Google, skipping WorkOS's page, and
approved its drawing, `staff-signin` (`docs/design/user-journeys/generator/signin.mjs`).
The decision is recorded in `docs/decisions/2026-09-29-signing-in-review.md`,
"Later change (25 Oct 2026)". It follows the 7 Oct decision "lets do just
google for now".

**Risky area:** sign-in. It changes the start of a WorkOS sign-in. No
migration.

## What Changes

- **`staff-signin`, "Sign in to Wheelhouse":**
  - "Continue with Google", then "or", then "Sign in with email";
  - shown at `/workshop/sign-in`, and wherever someone opens the staff app
    signed out;
  - it replaces going straight to WorkOS's page (`staff-signin-workos-screens`
    design 6).
- **Start** takes `provider=google`. That goes straight to Google's account
  chooser through WorkOS (`provider=GoogleOAuth`), and anything else goes to
  WorkOS's page as now. `from` still brings the person back to the page they
  were on.
- **"Sign in again" and "Try again"** on the signed-out, expired and failed
  pages lead to `staff-signin`.

## Capabilities

### Modified Capabilities

- `staff-sign-in`: sign-in starts on Wheelhouse's own screen, with Google
  one tap away.

## Out of scope

- **Google's official "G" logo** on the button. The file isn't in the repo,
  so the button shows a placeholder until someone downloads Google's own
  artwork. It's needed before going live.
- **Wheelhouse's own address on Google's chooser** ("continue to
  workos.com" until then). It needs a domain and WorkOS's custom domain at
  $99 a month, which waits until money comes in.
- **WorkOS's Production environment and Wheelhouse's own Google
  credentials.**
