# Design: the messages engine

Pretend for now (`docs/decisions/2026-10-20-messages-engine.md`). Built in pieces, each its own pull request; archived with the last.

## Storage (migration 048)

- `message_templates`: `shop_id`, `key` (e.g. `quote_to_approve`, `bike_ready`, `booking_confirmed`), `enabled` (default true), `wording` (null = Wheelhouse's), `subject` (null = Wheelhouse's); unique (shop, key); row-level security per shop. A row exists only once a shop changes something.
- `customer_messages` (migration 008) gains: `job_id` (nullable), `channel` (`sms` | `whatsapp` | `email`), `template_key`, `subject`, `to_address`, `send_after` (when it may go), `sent_at`, `pretend` (boolean). Its `intent_state` (020) is used as the `messageIntent` machine says: `intended` (queued, waiting for `send_after`) → `sending` → `delivered` | `failed`; Undo is `cancel` (`intended` → `failed`, error "Undone").

## Wheelhouse's wording (server/messaging/templates.js)

One entry per key: name, when it's sent, text wording, email subject, and the tap-ins it allows. The booking wordings are the approved ones (`2026-10-20-booking-messages.md`); Quote to approve and Bike ready are the drafts (build-plan questions Q9; owner setup 23). Tap-ins are written `[Customer’s first name]` etc. and filled from the job, customer and shop; one with no value is left out with its sentence's spacing tidied, never shown in brackets.

## Channel

The customer's `update_channel`; with none, text if there's a phone, else email if there's an email; with neither, the message isn't queued and the caller is told "No message — no phone or email" (`2026-10-01-book-a-repair-review.md`, later change).

## Senders (server/messaging/senders/*)

One interface, `send({ channel, to, subject, body }) → { ok, providerId?, error? }`. Only the pretend sender exists: it records nothing outside the database and returns ok with `providerId: 'pretend'`; the row is `pretend = true`. A real sender is added later behind the same interface, per channel, only with Jack's yes.

## Engine (server/messaging/engine.js)

- `queueMessage({ customerId, jobId, key, vars, delayMs })`: skips a switched-off message (returns `{ skipped: 'off' }`); picks the channel and address; renders; inserts `intended` with `send_after = now + delayMs` (60 s for staff-triggered messages, the drawn minute; 0 for others); returns the row.
- `undoMessage(id)`: `intended` → `failed` ("Undone"), only before `send_after`; otherwise 409.
- The sender's timer (in `server.js`, started with the server, stopped on shutdown; every 5 s, configurable for tests): for each shop, claims due `intended` rows (`FOR UPDATE SKIP LOCKED`), moves them to `sending`, calls the sender outside the shop's database session, then `delivered` (with `sent_at`) or `failed`.

## Routes

- `GET /api/messages?jobId=&customerId=&limit=` (staff): the outbox, newest first: who, how, when, the words, pretend, its state.
- `POST /api/messages/:id/undo` (staff).
- `GET /api/message-templates` (staff): every key with name, when, enabled, wording (the shop's or Wheelhouse's), subject, `changed`, tap-ins.
- `PUT /api/message-templates/:key` (Owner only, as Settings): `{ enabled?, wording?, subject? }`; `wording: null` goes back to Wheelhouse's.
- `POST /api/message-templates/:key/preview` (staff): `{ wording?, subject? }` → `{ text, email: { subject, body } }` for the drawings' example (Maya Patel, Trek Domane AL 3, WH-1042).

## Triggers in this change

- Quote to approve: `POST /api/quotes/:id/send` queues it (60 s Undo) instead of sending the hard-coded text; the quote panel's Undo calls `POST /api/messages/:id/undo` instead of holding the send in the browser.
- Bike ready: the job's `finish` queues it (60 s Undo).

## Safety guard

With `WHEELHOUSE_HOSTED_COPY=1`, the server refuses to start if any `TWILIO_*`, `EMAIL_*` or `WHATSAPP_*` key is set (add-hosted-copy tasks 2.1–2.2).

## Screens

- Settings › Messages: the rows that exist (Quote to approve, Bike ready, the six booking messages), each with "Customer's choice", On/Off and Edit; Edit opens the wording box with tap-ins, the text preview and the email preview, Go back to Wheelhouse's wording, Done.
- The outbox: drawn first for Jack's approval.
