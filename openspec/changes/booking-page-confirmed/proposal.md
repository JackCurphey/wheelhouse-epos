# Proposal: the confirmed booking page, to its drawing

## Why

The customer's booking page is still the first release's `pending` screen: its heading is the stage word ("Confirmed") and its summary a plain box. The drawn page (`bk-page`, `book.mjs`) differs, and the Settings Preview (#299) follows the drawings. Jack, 19 Oct: "1: the confirmed page's look and rows with the data the server already sends; the rest later."

## What Changes

For a confirmed booking only:
- Above the heading, "Your repair · WH-1042"; the heading names the bike and the work: "Trek Domane AL 3 · Standard service".
- A card: the green "Booking confirmed" badge; the drop-off sentence and the shop's note; rows Service ("Standard service · £65.00", each service its own line), Bike, When, Your repair; the shop's name at the bottom.
- Kept below the card until changing and cancelling online are built: "Keep this link to check your booking", Copy link, "Need to change or cancel? Contact [shop]". Kept inside the card: what the customer told the shop and their answers.

## Lane, work package, drawings and decisions

- **Work package:** part of WP-4.4 Book a repair, rebuilt (block 37's `bk-page` board), taken early. **Lane:** Jack's screens (`src/screens/book/`); no server change.
- **Drawings:** `bk-page`, `bk-confirmed` (`book.mjs` `bookingPage`, `bookingLines`, `shopLines`).
- **Decisions:** `2026-10-01-book-a-repair-review.md` decision 10 (the booking's own page); Jack, 19 Oct (this scope); `decided-while-building.md` (the preview's drawn page).

## Out of scope (need data Mark's server doesn't send, or later pieces)

- "Extra work", "Deposit paid", "Free to cancel until", the mechanic's name, the bike's colour, the shop's address and phone, "See this booking any time: sign in with…".
- Change the date, Cancel booking, Add a note for the shop; the other stages (request, change waiting, cancelled, declined, expired).

## Impact

- `src/screens/book/pending.tsx`, `pending-rules.ts`, `frame.tsx` (an optional line above the heading); tests
