# Proposal: the messages engine (pretend for now)

## Why

Every message the drawings promise — Request received, Booking confirmed, Quote to approve, Bike ready and the rest — waits on WP-1.8, the messages engine (build plan :321-326). Today only two things send at all: a one-off text staff type in the old app, and the quote link, with hard-coded words and an Undo that lives in the browser tab. Jack, 20 Oct (`docs/decisions/2026-10-20-messages-engine.md`): build the engine; pretend for now — every message goes to an outbox in the app; real sending only later, with his yes.

## What Changes

- **Wording per shop** (owner setup 14): each automatic message has Wheelhouse's wording, which a shop can reword (with tap-ins like [Customer's first name]) or switch off, and go back to Wheelhouse's.
- **The engine:** a message is queued for a customer, filled in, and sent the way the customer chose (text, WhatsApp or email; else whatever contact there is), after a one-minute Undo for messages staff trigger.
- **Pretend senders only:** every channel's sender records the message in the outbox, marked pretend; nothing leaves the server. Real senders come later behind the same adapter, each only with Jack's yes (CLAUDE.md: connecting a real account).
- **A safety guard:** the hosted test copy refuses to start with any real sending key (add-hosted-copy tasks 2.1–2.2).
- **The outbox, in the app**: what was sent (pretend), to whom, how and when — drawn first, for Jack's approval.
- **Settings › Messages** (`set-msg-list`, `set-msg-edit`): the shop's messages, each with On/Off and Edit (wording, tap-ins, text and email preview).
- **First triggers:** Quote to approve (moved off the hard-coded text; Undo on the server) and Bike ready (when a job is finished). The six approved booking messages follow as their own piece.

## Lane, work package, drawings and decisions

- **Work package:** WP-1.8 (stage 1), taken now. **Lane:** the engine is Mark's; built on Jack's word (20 Oct) and flagged for him. The screens are Jack's.
- **Drawings:** `set-msg-list`, `set-msg-edit` (`setup.mjs`); the Undo bar (`diary.mjs` "“Bike ready” goes to Maya by text in 1 minute"); `bk-msg-*` wordings (`book.mjs`). The outbox isn't drawn yet.
- **Decisions:** `2026-10-20-messages-engine.md` answer 1; owner setup 14 and 23; account and reminders 3 and 6; stage 1 drawing gaps 7, 17, 24; build-plan questions Q9, Q10; drop-off and quote 5; UX walk-through H2; `2026-10-20-booking-messages.md`.

## Out of scope (later pieces)

- Real sending (each channel only with Jack's yes); the six booking messages' triggers; scheduled messages (reminders, Bike still waiting, review requests) and the shop's own messages (`set-msg-new`); "Stop these" and consent per kind; the reply line (the booking page has nowhere to reply yet); the staff inbox; running alongside Citrus Lime ("Not sent — practice").

## Impact

- Server: a new migration; `server/messaging/*` (new); `server/routes/workshop.js` (quote send, finish); new routes; `server/server.js` (the sender's timer, the guard); tests
- Screens: `src/screens/settings/*` (Settings › Messages); the outbox screen; the quote panel's Undo; tests
