# Proposal: Set up a workshop computer says not to stay signed in to Google

## Why

The Owner lock on a workshop computer is held on the server (#578), but a
Google sign-in the browser remembers could still sign someone at the
workshop computer back in as the Owner with a fresh sign-in. Jack accepted
that and asked for a warning at setup (`docs/decisions/2026-10-29-answers.md`,
answer 6: "Merge, warn at setup"), then approved the drawing ("Approve it").

Work package: **WP-1.7 task 3.6** (the shared workshop computer), slice B,
taken by Jack. **Risky area:** none; screen wording only, no server change.

## What Changes

- With "A workshop computer" chosen on Set up this till, one line before the
  button: "Don’t stay signed in to Google on this computer: anyone using it
  could sign in as you." ("device" in place of "computer" below desktop
  width, as the rest of the screen). Not shown for a till.

## Drawings and decisions

- Drawing: `till-setup-workshop` (`docs/design/user-journeys/generator/signin.mjs`,
  `tillSetupWorkshopAt`; `journeys.mjs`).
- Decision: 29 Oct answer 6 (`docs/decisions/2026-10-29-answers.md`).

## Out of scope

- Anything that stops a remembered Google sign-in (Jack accepted it).
