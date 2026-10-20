# Proposal: offering another time for a booking request

## Why

The request pop-up's "Offer another time" (Workshop day decision 15) and the customer's answer on their booking page (`bk-offered`; Book a repair decision 12, audit H2 option 1) are drawn, and nothing is built: no state, no route, no screen. Jack, 20 Oct (`docs/decisions/2026-10-20-offer-another-time.md`): staff pick the time in the diary itself and add a message; while the offer waits only the suggested time is kept free and the first let go; drawings approved; build the whole flow.

## What Changes

- **A booking can be "offered"**: a new `booking_state` between pending and scheduled. Staff offer from a request; the customer accepts (it becomes a confirmed booking) or cancels; staff can offer again, decline, or let it expire, as for a request.
- **Server:** a migration (the state, the offer's columns, the derived status); `POST /api/workshop-jobs/:id/offer`; the booking link's `time_offered` stage and `offer`; `POST …/booking-links/:code/accept-offer`; cancel works on an offer; changing the date doesn't.
- **Staff:** "Offer another time" in the request pop-up puts the diary in pick mode (`request-offer-pick`); a free time opens the offer pop-up (`request-offer`); the diary shows an offered booking as "Time offered", not a request to answer.
- **Customer:** the booking page's offered state (`bk-offered`): what the shop can't do, the suggested time, the shop's message, Accept this time / Cancel my request.

## Lane, work package, drawings and decisions

- **Work packages:** WP-4.1 (Offer another time, the request pop-up) and WP-4.4 (`bk-offered`), taken early.
- **Lanes:** the workshop server (state machine, migration, the offer route) is Jack's, needing Mark's approval; the booking server (`portal.js`, `booking-link.js`) is Mark's. Built on Jack's word (20 Oct) and flagged for Mark. The screens are Jack's.
- **Drawings:** `request-new`, `request-offer-pick`, `request-offer` (`diary.mjs`), `bk-offered` (`book.mjs`).
- **Decisions:** `2026-10-20-offer-another-time.md` answers 1–3; Workshop day 15; Book a repair 12; not-drawn pages row 48.

## Out of scope

- The "New time offered" text (the messages engine, WP-1.8); expiring offers on a timer (nothing expires requests on a timer yet); a decline message (the decline pop-up's box is its own piece).

## Impact

- Server: a new migration; `server/workshop/state-machines.js`, `legacy-status.mjs`, `render-constraints.mjs`, `jobs.js`; `server/routes/workshop.js`, `portal.js`; `server/booking-link.js`; generated state docs; route snapshot; tests
- Screens: `src/screens/diary/*` (request dialog, pick mode, offer pop-up, the offered state); `src/screens/book/*` (the offered page); tests
