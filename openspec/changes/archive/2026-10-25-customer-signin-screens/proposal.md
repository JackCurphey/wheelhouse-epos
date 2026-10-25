# Proposal: the sign-in screens

## Why

The server for signing in with an emailed code is built
(`customer-code-signin`). These are its screens, drawn as `cust-signin`,
`cust-code` and `cust-code-expired` (`signin.mjs:256-285`; signing-in
decisions 5 and 9). Two rules carry over:
- the code checks itself on the sixth digit, and a code pasted from the
  email fills all six boxes (journey A decision 6; walk-through 12 M3);
- a sign-in link carries the page it came from, and that page opens after
  the code (third walk, answer 8).

## What Changes

- `/book/:shopSlug/sign-in`, one page in two steps:
  - "Sign in to your account": Email, then "Email me a code", with the
    line about booking links under it.
  - "Enter your code": one box drawn as six. It checks itself on the sixth
    digit. Under it go "Send a new code" and "Use a different email".
- A wrong or expired code says so under the boxes. When the code has
  expired, "Send a new code" stands out, as drawn.
- Once signed in, the page given in `?from=` opens, but only one of this
  shop's own `/book` pages. With no `from`, the shop's booking page opens.

## Capabilities

### Modified Capabilities

- `customer-accounts`: the sign-in screens.

## Out of scope

- The shop's website frame, with "Account" in its header. It isn't built,
  so these screens use the booking pages' frame, as the stop page does.
- "Continue with Google" (not drawn).
- The account pages.
- The "Sign in" links on other pages (booking, stop page). They come with
  the account pages.
