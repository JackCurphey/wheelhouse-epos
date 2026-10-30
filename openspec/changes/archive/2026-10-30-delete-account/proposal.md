# Proposal: Ask us to delete your account, and the shop's Privacy requests

## Why

A customer signed in to their account can download a copy of their data
(`your-data-copy`), but can't ask the shop to delete it. UK data protection
gives them that right, and Jack chose it as a request the shop confirms,
shown with anything in the way (account and reminders decision 4; customer
service decision 9: requests handled from a dated list, answered within a
month). What goes and what stays was settled by Jack on 30 Oct ("Use all
seven defaults", `docs/decisions/2026-10-30-answers.md` answer 3).

Work packages: **WP-4.5** (Your data on the account) and **WP-3.2**
(privacy requests on Customers), slice A, taken by Jack. Nothing of Mark's
is needed. Built on the `privacy_requests` log (migration 108) and on #589
(one copy a day).

**Risky areas:** customer accounts and a public route (`/api/portal/*`),
money records (sales and orders are kept and must stay whole), and a
migration (109). Not `server.js` or the messaging core.

## What Changes

- **The customer asks** from Your data: "Ask us to delete your account"
  opens the drawn pop-up; with a bike still in the workshop it says the
  deletion waits until the bike is collected, and they can still ask. The
  request shows on the account with "Cancel my request" until the shop has
  done it.
- **The shop's Privacy requests list**, from "Privacy requests · [n] open"
  on Customers (the Owner only): each request with who, what, where from,
  when asked and when an answer is due (a month), overdue ones marked;
  "Still in the way: bike in the workshop, [ref]" holds Delete back.
- **Delete their details** (the Owner only), after "Delete [name]'s
  details?", carries out Jack's seven answers in one locked transaction:
  the customer record and their bikes blanked and kept; their messages,
  booking photos, sent-message records, merges, sign-in and reminder
  stops removed; their sales and jobs kept whole without their name; the
  request marked done, kept with its reference and no name.
- **The customer page** shows a waiting request and what's in the way.
- **Migration 109**: when a request was cancelled; when a customer was
  deleted; at most one open deletion request per customer.

## Drawings and decisions

- Drawings: `ac-account` (Your data card), `ac-delete`, `ac-delete-blocked`,
  `ac-delete-sent`, `ac-account-delete-pending`, `ac-account-delete-cancelled`
  (`account.mjs`); `cs-list` (the link), `cs-privacy`, `cs-privacy-delete`,
  `ac-privacy-requests`, `ac-customer-delete` (`customer.mjs`, `account.mjs`).
- Decisions: Jack's 30 Oct answer 3; account and reminders decision 4 and
  audit H3 and M12 (`2026-10-01-account-and-reminders-review.md`); customer
  service decision 9 (`2026-09-30-customer-service-review.md`); coverage
  walks answers 4 and 5 (`2026-10-04-coverage-walks.md`).

## Out of scope

- **"+ Log a request" and "Send the copy"**: requests the shop logs by hand,
  and copies it sends; account copies are logged done already.
- **Store credit and money owed on account** in the pop-ups and "Still in
  the way": not built. Neither blocks a deletion (M12; only a bike blocks).
- **Today's line for a deletion request** (`ac-today`): a later piece.
- **Telling the customer when it's done** (the drawn "tell you when it's
  done"): their email goes with the deletion, so it needs a message sent in
  the same step; a later piece, logged.
- **The privacy notice** link: no notice page yet.
