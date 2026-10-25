# Proposal: the staff sign-in screens

## Why

`staff-signin-workos` (#504) made WorkOS the only way staff sign in. It
sends people back to the staff app with a reason when sign-in fails, but
the app still shows a plain "You're signed out" page for every case. The
drawn pages were waiting for this change:
- `auth-signedout`, "You've signed out" (`docs/design/user-journeys/generator/signin.mjs:64`);
- `auth-expired`, "Please sign in again" (`signin.mjs:65`).

Walk-through 8 tells the shared-computer story through them
(`docs/design/user-journeys/ux-walkthrough-8-shared-workshop.md:23`).

This is WP-1.7's staff screens, taken by Jack with the server half (25 Oct).

**Risky area:** sign-in. It changes `GET /api/auth/me` and the WorkOS
start and callback, so it needs `/review` before it merges. No migration.

## What Changes

- **Signing out** ends at `auth-signedout`, "You've signed out" with "Sign
  in again". The address is `/workshop/signed-out`, and WorkOS's sign-out
  comes back to it.
- **A session that has run out** shows `auth-expired`, "Please sign in
  again". After signing in, the person is back on the page they were on, as
  drawn ("Sign in and you'll be back where you were").
  - `/api/auth/me` says `expired` when the browser sent a session that is
    no longer live.
  - Start takes `?from=`, any staff-app page only, and the callback goes
    there.
- **A failed sign-in** (`?signin=` from #504) shows a message page in the
  same drawn frame, saying what went wrong and how to go on. Its wording
  isn't drawn, so it's logged in `decided-while-building.md`.
- **Opening the staff app when not signed in** goes straight to WorkOS's
  page, with no "You're signed out" click first. That page is the drawn way
  in (`workos-signin`), and Jack wants the fewest clicks.

## Capabilities

### Modified Capabilities

- `staff-sign-in`: the pages around signing in and out.

## Out of scope

- **The shared workshop computer** (walk-through 8 decisions 1 and 3): PIN
  take-over, and going back to the PIN screen when idle. These are later
  WP-1.7 pieces.
- **The `[n]` in "signed out after a while"**: still `[n]` (consolidation
  B-1-2 note 1). The page says "a while", as drawn.
- **The old app at `/`**: it keeps its password box, which now answers that
  staff sign in through WorkOS. Taking the old app away is its own piece
  (Jack, 23 Oct, answer 6).
- **A logo:** none exists, so the frame shows the word Wheelhouse only.
