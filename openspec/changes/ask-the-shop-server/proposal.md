# Proposal: "Ask the shop a question", the server

## Why

Jack decided on 26 Oct (`docs/decisions/2026-10-26-day-answers.md` sections 2
and 8) that each customer has **one running conversation** with the shop, on
their account, titled "Messages with [shop]". It holds the customer's general
messages, the shop's replies, and the customer's notes on a repair with the
shop's replies to them, each marked with its repair ("About WH-1042"). The
staff Messages inbox shows one conversation per customer too. He also decided
that a customer stays signed in for **30 days from their last visit**, not 30
days from signing in.

The drawings are approved: `conversationPage`, `ac-ask`,
`ac-account-question-sent`, `ac-question` and `ac-account-asked` in
`docs/design/user-journeys/generator/account.mjs`.

Jack is taking it. This change is the server; the screens follow in their own
change.

**Risky areas:** a migration (087); customer accounts, sign-in and public
routes (`/api/portal/*`); the messaging core (a new template). It needs
`/review`.

## What Changes

- **Migration 087.** A message on `job_notes` is either about a repair (a job)
  or a general message to or from a customer: `workshop_job_id` becomes
  optional, `customer_id` is added, and exactly one of the two is set. Every
  existing note stays a repair note and keeps working on the repair page.
- **The customer's conversation:** `GET` and `POST /api/portal/:shopSlug/messages`,
  signed in, own shop only, refused from another website, never kept by the
  browser, up to 1,000 letters.
- **The staff inbox, one row per customer:** `GET /api/customer-conversations`
  ("Needs a reply" or All), `GET /api/customer-conversations/:customerId`, and
  `POST /api/customer-conversations/:customerId/messages` (a general reply, or
  a reply about one of the customer's repairs).
- **A new message, "Reply to a message":** "[Shop name] replied to your
  message: [Link to your messages]", sent the customer's chosen way when the
  shop replies to a general message (pretend for now). The shop can reword it
  in Settings › Messages.
- **The account's history** gets one "messages" item.
- **Today's "Customers' messages waiting"** counts customers, as the inbox
  now does.
- **Customer sign-in lasts 30 days from the last visit:** the session and its
  cookie are renewed when used with less than 29 days left.
- **Merging customers** moves their general messages too.

## Capabilities

### Modified Capabilities

- `customer-accounts`: the conversation with the shop, its row in the
  history, and sign-in lasting 30 days from the last visit.
- `messages`: one conversation per customer in the inbox, and "Reply to a
  message".

## Out of scope

- **The screens** (the account's conversation page and history row, the
  inbox redrawn one row per customer). `design.md` lists exactly what they
  change. The old `GET /api/job-notes/conversations` stays until the inbox
  screen moves off it, and the screens change removes it.
- **Live updates** (WP-1.9): the screens keep reading again every 30 seconds.
- **Photos or files in a message.**
