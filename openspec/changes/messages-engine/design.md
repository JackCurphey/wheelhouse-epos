# Design: the messages engine

Pretend for now (`docs/decisions/2026-10-20-messages-engine.md`). Built in pieces, each its own pull request; archived with the last.

## Storage (migration 048)

- `message_templates`: `shop_id`, `key` (e.g. `quote_to_approve`, `bike_ready`), `enabled` (default true), `wording` (null = Wheelhouse's), `subject` (null = Wheelhouse's); unique (shop, key); row-level security per shop. A row exists only once a shop changes something.
- `customer_messages` (migration 008) gains: `job_id` (nullable), `channel` (`sms` | `whatsapp` | `email`), `template_key`, `subject`, `to_address`, `send_after` (when it may go; null for every row written before this change), `sent_at`, `pretend` (boolean, default false). Staff-triggered rows fill `sent_by_login_id`. The old `status` text column is kept in step for the old app's list: `queued` while waiting, then `sent`, `failed` or `undone`.
- **Rows already there are settled, not resent** (fresh review): every existing row reads `intent_state = 'intended'` by 020's default, so 048 sets them to `delivered` where `status = 'sent'`, else `failed`; and the sender only ever claims rows whose `send_after` is set.
- **Undone is its own state** (fresh review): `messageIntent` gains `undone`, reached by `undo` from `intended`, final (no `retry`); 048 re-makes 020's `intent_state` CHECK from the machine (`render-constraints.mjs` then points at 048).

## Wheelhouse's wording (server/messaging/templates.js)

One entry per key: name, when it's sent, text wording, email subject, and the tap-ins it allows. The booking wordings are the approved ones (`2026-10-20-booking-messages.md`); Quote to approve and Bike ready are the drafts (build-plan questions Q9; owner setup 23). Tap-ins are written `[Customer’s first name]` etc. and filled from the job, customer and shop; one with no value is left out with its sentence's spacing tidied, never shown in brackets.

## Channel

The customer's `update_channel`; with none, text if there's a phone, else email if there's an email; with neither, the message isn't queued and the caller is told "No message — no phone or email" (`2026-10-01-book-a-repair-review.md`, later change).

## Senders (server/messaging/senders/*)

One interface, `send({ channel, to, subject, body }) → { ok, providerId?, error? }`. Only the pretend sender exists: it records nothing outside the database and returns ok with `providerId: 'pretend'`; the row is `pretend = true`. A real sender is added later behind the same interface, per channel, only with Jack's yes.

## Engine (server/messaging/engine.js)

- **One clock:** `send_after` is an instant, so it is set and compared with the plain system time (as `server/clock.js` says of instants; the pinned test clock is frozen, so a delay would never come due), passed into SQL as a parameter, never Postgres `now()`. Tests shorten the Undo minute (`WH_MESSAGES_DELAY_MS`) and the timer (`WH_MESSAGES_TICK_MS`).
- `queueMessage({ customerId, jobId, key, vars, delayMs, loginId })`: skips a switched-off message (returns `{ skipped: 'off' }`); picks the channel and address (none: `{ skipped: 'no_contact' }`); renders; inserts `intended` with `send_after = now + delayMs` (60 s for staff-triggered messages, the drawn minute; 0 for others); returns the row.
- `undoMessage(id)`: `intended` → `undone`, only before `send_after`; otherwise 409.
- **The sender's timer** (in `server.js`, started with the server, stopped on shutdown; every 5 s, its interval set by `WH_MESSAGES_TICK_MS` for tests): it lists the shops, then for each one, in its own `runWithShop`, claims due rows with a single `UPDATE customer_messages SET intent_state = 'sending', claimed_at = $now … WHERE intent_state = 'intended' AND send_after IS NOT NULL AND send_after <= $now RETURNING …` (one statement, so two timers can't claim the same row). It calls the sender **outside** any shop scope, then records `delivered` (with `sent_at`) or `failed` in a second scope. A row left in `sending` for more than five minutes after its `claimed_at` (a crash mid-send; migration 049 adds the column, so a message that waited its Undo minute is never mistaken for a stuck one) is moved to `unknown` by `timeout`, and never resent automatically. One shop or message failing is logged and the round carries on. Shutdown waits for a round in flight before ending the database pool.

## Routes

- `GET /api/messages?jobId=&customerId=&limit=` (staff): the outbox, newest first: who, how, when, the words, pretend, its state.
- `POST /api/messages/:id/undo` (staff).
- `GET /api/message-templates` (staff): every key with name, when, enabled, wording (the shop's or Wheelhouse's), subject, `changed`, tap-ins.
- `PUT /api/message-templates/:key` (Owner only, as Settings): `{ enabled?, wording?, subject? }`; `wording: null` goes back to Wheelhouse's.
- `POST /api/message-templates/:key/preview` (staff): `{ wording?, subject? }` → `{ text, email: { subject, body } }` for the drawings' example (Maya Patel, Trek Domane AL 3, WH-1042).

## Triggers in this change

- **Quote to approve:** the quote panel keeps its own minute's Undo (`quote-panel.tsx`), because `POST /api/quotes/:id/send` also moves the quote to sent and makes the customer's new link, which an undone text would leave behind (fresh review). When that minute passes and the panel sends, the route queues Quote to approve through the engine with no further delay, instead of its hard-coded text. Moving the quote's Undo to the server (so a closed tab still sends) is a later piece.
- **Bike ready:** the job's `finish` — "Mark ready for collection" in the drawings (UX walk-through H2) — queues it, with the 60 s Undo; the job page shows the drawn bar "“Bike ready” goes to [first name] by [text] in 1 minute" with Undo.
- **The old app's one-off text** (`POST /api/customers/:id/texts`) goes through the engine and the pretend sender too, at once, so nothing sends for real anywhere (Jack: "every message goes to an outbox").

## Safety guard

With `WHEELHOUSE_HOSTED_COPY=1`, the server refuses to start if any `TWILIO_*`, `EMAIL_*` or `WHATSAPP_*` key is set (add-hosted-copy tasks 2.1–2.2).

## Screens

- Settings › Messages shows only messages that can be sent (stage 1 drawing gaps 7): Quote to approve and Bike ready now, each with "Customer's choice", On/Off and Edit; Edit opens the wording box with tap-ins, the text preview and the email preview, Go back to Wheelhouse's wording, Done. Other rows arrive with their pieces; "Your own messages" and "+ Add your own message" with `set-msg-new`. The shop choosing text or email per message (owner setup 14) waits too: every message goes the customer's way for now.
- The outbox: drawn first for Jack's approval.
