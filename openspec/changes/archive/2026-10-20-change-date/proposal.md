# Proposal: Change the date on the booking page

## Why

Book a repair decision 10 (Jack, 1 Oct): "Change the date" opens the day strip in place on the booking's own page, and a change to a confirmed booking waits for the shop. Jack, 19 Oct, chose Change the date and Cancel booking; Cancel merged (#303). The server's change route exists (piece 12), but the page can't offer days and times for the booking: the link doesn't carry its mechanic or length, and the shop's free times count the booking's own slot as taken. Jack, 20 Oct: "1: build the server additions for Change the date yourself, merge once checks pass, and flag them for Mark."

## What Changes

- **Server (Mark's `portal.js`, flagged for him):** `GET /api/portal/:slug/booking-links/:code/availability` — the days and times this booking could move to, for its own mechanic and length, leaving the booking itself out.
- **Confirmed booking page:** "Change the date" before Cancel booking, while the booking can be changed online. It opens "Choose a new date" in place: the day strip (`bk-change`), the chosen day's times, the note, Keep [day] / Ask for this date.
- **A change waiting** (`bk-change-pending`): "New date waiting for the shop", what was asked for, "Cancel my date change" and Cancel booking.
- **A change the shop declined** (`bk-change-declined`): a notice at the top that the shop couldn't do it, with the booking as it stands.

## Lane, work package, drawings and decisions

- **Work package:** part of WP-4.4 (bk-change, block 37), taken early. **Lane:** the route is Mark's file, built by Jack's session on Jack's word (20 Oct) and flagged for Mark; the screens are Jack's.
- **Drawings:** `bk-change`, `bk-change-pending`, `bk-change-declined` (`book.mjs` `bookingPage`, `strip`).
- **Decisions:** `2026-10-01-book-a-repair-review.md` decisions 7, 10 and 12; piece 12 (`docs/superpowers/specs/2026-09-27-book-server-12-change-cancel-design.md`); Jack, 19 and 20 Oct.

## Out of scope

- Changing the mechanic or the services (decision 10: services aren't changed here); Change the date on a request's page; deposits and Free to cancel until; texts.

## Impact

- Server: `server/routes/portal.js`; tests
- Screens: `src/screens/book/pending.tsx`, `pending-rules.ts`, `pending-query.ts`, a new `change-date.tsx`; tests
