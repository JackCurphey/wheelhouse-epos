# Proposal: the customer's account, the server

## Why

The customer's account page (journey 7: `ac-account`, `ac-account-new`,
`ac-account-repairs`; `docs/design/user-journeys/generator/account.mjs`) waited
on the emailed-code sign-in, which is built (#500, #502). Jack settled its two
open questions on 25 Oct (`docs/decisions/2026-10-26-customer-account.md`):
- a code sign-in joins the one customer the shop already has with that email;
- a repair in the account opens its own page because the customer is signed
  in.

This is WP-4.5. Jack is taking it, server and screens. This change is the
server; `customer-account-screens` follows.

**Risky area:** customer accounts and public routes (`/api/portal/*`), and
migration 084. It needs `/review`.

## What Changes

- **Code sign-in joins an existing customer.** It does so when the email
  matches exactly one active customer, that customer has no online account,
  and the email is one they gave themselves (Jack, option 2 after the
  review). Case and spaces are ignored. Otherwise it makes a new customer, as
  now. This changes the first sign-in rule in `customer-accounts`.
- **Migration 084: `customers.email_from_customer`.** It starts false for
  every customer already there.
  - An online booking or online sign-up sets it.
  - Staff changing a customer's email clears it.
- **A signed-in customer opens their own repair.** The repair page's routes
  accept `job-<id>` in place of the private code when the signed-in customer
  owns that job at this shop. They answer 404 otherwise, exactly as for a bad
  code. The link's 30-day expiry doesn't apply to the job's owner. A
  cancellation made this way links the message to the account, not to a
  private link.
- **`GET /api/portal/:shopSlug/history`:** the signed-in customer's repairs,
  each with its stage and total, and their purchases from both sales records
  (`all_sales`, with what was bought), newest first.

## Capabilities

### Modified Capabilities

- `customer-accounts`: a first code sign-in can join the one matching
  customer; signed-in customers open their own repairs and see their history.

## Out of scope

- **The account page's screens** (`customer-account-screens`).
- **Store credit** (not built; decision answer 3).
- **The Edit, Change, Ask the shop and Add a bike screens.**
- **Your data.**
- **The receipt dialog.**
- **Online orders.**
- **Password sign-up** still never joins a customer (21 Oct decision,
  unchanged).
