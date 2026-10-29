# Proposal: Download a copy of your data

## Why

A customer signed in to their account on the shop's website can see their
bikes, history and details, but can't take a copy of what the shop holds
about them. Jack chose an instant copy (account and reminders decision 4,
1 Oct: "Download a copy of your data" is ready straight away, with details,
bikes, jobs, purchases, messages and consents, and logged). UK data
protection gives customers the right to that copy; doing it straight away
means the shop never has to answer the request by hand.

Work package: **WP-4.5** (account, history and reminders: "Your data"),
slice A, taken by Jack. Nothing of Mark's is needed.

**Risky areas:** a public route (`/api/portal/*`, a customer's account) and
a migration (108). No money or stock, and not `server.js` or messaging.

## What Changes

- **A "Your data" card on the account**, under History (on a phone, last),
  with "Download a copy of your data".
- **The download is one `.zip` file**, made straight away, with a
  spreadsheet (CSV) for each of: your details, your bikes, your repairs, your
  purchases, your messages, and what you agreed to.
- **The account says it's downloading**, with the file's name and "Not
  started? Download it again"; if it fails, "The download didn't start." with
  Try again.
- **Each copy is logged** as a privacy request, from the account, done at
  once (migration 108, `privacy_requests`), so the shop's Privacy requests
  list (`cs-privacy`, a later piece) can show it. A merge moves the log with
  the customer.

## Drawings and decisions

- Drawings (`docs/design/user-journeys/generator/account.mjs`, journey 7):
  `ac-account` (the Your data card under History), `ac-download` (the green
  bar), `ac-download-failed` (the warning bar with Try again).
- Decisions: account and reminders decision 4 and the audit's M2 ("Your
  data" under History), `docs/decisions/2026-10-01-account-and-reminders-review.md`;
  privacy requests are dated and answered within a month,
  `docs/decisions/2026-09-30-customer-service-review.md` decision on privacy
  requests; the customer account's history, `openspec/specs/customer-accounts/spec.md`.

## Out of scope

- **"Ask us to delete your account"** (`ac-delete`, `ac-delete-blocked`,
  `ac-delete-sent`, the pending banner and Cancel my request): its own piece,
  with the staff side. Left out, not shown disabled, as the account's other
  unbuilt parts are.
- **The shop's Privacy requests list** (`cs-privacy`, `ac-privacy-requests`)
  and "+ Log a request": a later piece, reading the table this one starts.
- **"Privacy notice"**: there is no privacy notice page yet, so the link is
  left out (logged).
- **Store credit, Cycle to Work and online orders** in the copy: not built.
