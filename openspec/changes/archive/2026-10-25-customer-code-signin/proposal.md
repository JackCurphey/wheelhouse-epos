# Proposal: customers sign in with a code sent by email

## Why

This is decision 5 of signing in (`docs/decisions/2026-09-29-signing-in-review.md:35-40`,
Jack, 29 Sep). Customers sign in on the shop's own website, on
Wheelhouse's own "email me a code" screens in the shop's look. WorkOS
creates and checks the code behind the scenes: six digits, valid for 10
minutes. A sign-in link carries the page it came from, and after the code
that page opens (third walk, answer 8). It is drawn as `cust-signin`,
`cust-code` and `cust-code-expired` (`signin.mjs:256-285`). This is
WP-1.7's customer half. Until a WorkOS account exists, it is built
against a pretend version.

Two things wait for it: the "Sign in to your account" line on the stop
page, and the account pages.

## What Changes

**This pull request: the server**
- An adapter for sending and checking codes, with a pretend version. As
  with pretend payments, the pretend version keeps its own records
  (`pretend_signin_codes`) the way WorkOS would on its side. It is only
  switched on with `CUSTOMER_SIGNIN_PROVIDER=pretend`. Left out, nothing
  is connected and sign-in by code says so.
- **`POST /api/portal/:shopSlug/sign-in/code`** sends a code to an email.
- **`POST /api/portal/:shopSlug/sign-in/check`** checks the code:
  - If it is right, the customer is signed in with the session the
    portal already uses.
  - If it is wrong, or has expired, the reply says which.
  - The first time an email signs in, it gets a new customer and a new
    login with no password. It is never matched to a customer the shop
    already has, the same rule password sign-up follows (21 Oct review).
- Both routes are rate-limited by network and by email address.
- **Migration 081:**
  - creates `pretend_signin_codes`;
  - lets a login have no password (`customer_logins.password_hash`
    nullable).

**The next change (`customer-code-signin-screens`): the screens**
- `/book/:shopSlug/sign-in` holds both steps:
  - "Sign in to your account", "Email me a code";
  - "Enter your code", whose six boxes check themselves on the sixth
    digit.
- It handles an expired or wrong code, "Send a new code" and "Use a
  different email".
- Once signed in, the customer returns to the page they came from (`?from=`,
  only this shop's own `/book` pages).

## Capabilities

### New Capabilities

- `customer-accounts`: signing in by emailed code.

## Out of scope

- **"Continue with Google"** (7 Oct). It isn't drawn yet
  (`2026-10-07-stage-1-drawing-gaps.md:328-329`).
- **The real WorkOS connection.** It needs a real account: Jack's yes.
- **The account pages.**
- **Removing password sign-in.** The old portal still uses it.
