# Proposal: the customer's account, the screens

## Why

The account page (journey 7: `ac-account`, `ac-account-new`,
`ac-account-repairs`, `ac-account-lower`; `docs/design/user-journeys/generator/account.mjs:60-125`)
on top of `customer-account-server`. Account decisions 1, 6, 8 and 9
(`docs/decisions/2026-10-01-account-and-reminders-review.md`), and Jack's
answers of 25 and 26 Oct (`docs/decisions/2026-10-26-customer-account.md`).
WP-4.5, Jack's lane.

**Risky area:** customer accounts and public routes. `/me` and `/history`
each gain a few fields. No migration.

## What Changes

- **`/book/:shopSlug/account`, "Your account":**
  - the customer's name and email, with Sign out, and Book a repair;
  - Your bikes, each with "In the shop now · WH-[n]" while a repair of it is
    in, and Book a repair;
  - Your details: Name, Mobile, Email;
  - How we contact you: Job updates, Service reminders, Review requests,
    Offers and news;
  - History: Everything, Repairs or Purchases, with Now and "Earlier, newest
    first", and Show more. Each row is a repair or a purchase, and a repair
    opens its own page (job-<id>).
  - The drawn empty states, and the drawn phone order.
- **Signed out,** the account sends the customer to sign in and back.
- **Signing in with no page to return to** goes to the account, not the
  booking page.
- **The server:** `/me` adds mobile and the four contact choices; `/history`
  adds each repair's bike and how far its work is, for the drawn "In the
  shop" chip.

## Capabilities

### Modified Capabilities

- `customer-accounts`: the account page.

## Out of scope

These aren't built, so they're left out, not shown disabled:
- **Store credit** (decision answer 3).
- **"Ask the shop a question".**
- **Edit, Change and "+ Add a bike".**
- **The warranty line and next service due.**
- **The receipt pop-up** behind "receipt".
- **Message rows, online orders and Cycle to Work rows.**
- **Your data.**
- **The website frame with Account in its header:** the page uses the
  booking pages' frame, as sign-in does.
