# Proposal: declining a booking request with a message

## Why

Workshop day decision 15 (27 Sep) puts the decline message in the request pop-up, drawn as `request-decline` ("Explain what the customer can do next", "Message to Sam", "Decline & notify customer"), and the customer's page as `bk-declined` ("Sorry, we can't fit this booking in", "A message from [shop]: …"). Today Decline only asks "Decline [name]'s booking …? This can't be undone." and the customer's page says "Declined", because the server kept no message (staff diary spec: left out until the server can). Jack, 20 Oct: "2" (this piece next).

## What Changes

- **Server:** `POST /api/workshop-jobs/:id/decline` accepts an optional `message` (trimmed, up to 1,000 characters), kept with the job (migration 047, `decline_message`); the booking link carries `declineMessage` once declined.
- **Staff:** Decline opens the drawn step: "Explain what the customer can do next", "Message to [first name]" started for them, the note, "Decline & notify customer" and "Keep request".
- **Customer:** a declined booking's page follows `bk-declined`: "Not booked", "Sorry, we can't fit this booking in", the shop's message, "Nothing is booked.", Choose another date, the shop's name.

## Lane, work package, drawings and decisions

- **Work package:** WP-4.1 (the decline message; split plan line 568) and WP-4.4 (`bk-declined`), taken early.
- **Lanes:** the decline route and migration are the workshop server (Jack's, Mark approves); `portal.js` is Mark's; both built on Jack's word and flagged for Mark, as with Change the date and offers. Screens are Jack's.
- **Drawings:** `request-decline` (`diary.mjs`), `bk-declined` (`book.mjs`).
- **Decisions:** Workshop day 15; Book a repair 12 (a declined booking says so); Jack, 20 Oct.

## Out of scope

- The "Request declined" text (the messages engine); deposit refunds (no deposits yet).

## Impact

- Server: migration 047; `server/routes/workshop.js`; `server/routes/portal.js`; tests
- Screens: `src/screens/diary/request-dialog.tsx`; `src/screens/book/pending.tsx`, `pending-rules.ts`, `pending-query.ts`; tests
