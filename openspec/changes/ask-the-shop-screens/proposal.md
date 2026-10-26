# Proposal: "Ask the shop a question", the screens

## Why

Jack decided on 26 Oct (`docs/decisions/2026-10-26-day-answers.md` sections 2
and 8) that each customer has **one running conversation** with the shop,
"Messages with [shop]", on their account, with their notes on a repair in it,
each marked with the repair; and that the staff Messages inbox shows one
conversation per customer too. The server is built
(`openspec/changes/ask-the-shop-server`, branch `jack/ask-the-shop-server`);
its `design.md` section 5 lists what the screens must change. This change is
the screens.

Jack is taking it (theme: talking to the shop).

**Risky areas:** customer accounts and public routes (the account's screens
read `/api/portal/*`); removing the old inbox route. It needs `/review`.

## What Changes

- **The conversation page** at `/book/:shopSlug/messages` (`conversationPage`:
  `ac-ask`, `ac-account-question-sent`, `ac-question`): "Your account" back,
  "Messages with [shop]", the thread (the customer's own on the right, the
  shop's on the left), each repair note marked "About WH-[n] ›" opening that
  repair, and a box ("Ask the shop a question" with nothing yet, "Your
  message" after) with Send and "We'll let you know when [shop] replies."
  Sending says "Sent. We'll let you know when [shop] replies." Signed out, it
  goes to sign-in and back.
- **The account page** (`ac-account`, `ac-account-asked`): "Ask the shop a
  question" in the header, and one history row "Messages with [shop]",
  Replied or Sent, opening the conversation.
- **The staff Messages inbox** (`ac-inbox*`): one row per customer, the
  address saying which customer (`?customer=`), each repair note marked with
  its repair, and the reply about the repair of the customer's newest
  message, or general. The inbox drawings are redrawn one row per customer
  (Jack approved, day answers 8.2).
- **The old inbox list route** `GET /api/job-notes/conversations` is removed
  (the server design kept it only for the old inbox).

## Capabilities

### Modified Capabilities

- `customer-accounts`: the conversation page; the account's header button
  and history row.
- `messages`: the inbox reads and replies one conversation per customer.

## Drawings and decisions

- `docs/design/user-journeys/generator/account.mjs`: `conversationPage`,
  `ac-ask`, `ac-account-question-sent`, `ac-question`, `ac-account-asked`,
  `ac-account` (the header button), `ac-inbox`, `ac-inbox-sent`,
  `ac-inbox-all`, `ac-inbox-list`, `ac-inbox-empty`, `ac-reply-text`.
- `docs/decisions/2026-10-26-day-answers.md` sections 2 and 8.
- `docs/decisions/2026-10-01-account-and-reminders-review.md` decisions 3 and 7.

## Out of scope

- Live updates (WP-1.9): the pages read again every 30 seconds.
- Photos or files in a message.
- Settings › Messages already lists "Reply to a message" from the server's
  templates; nothing changes there.
