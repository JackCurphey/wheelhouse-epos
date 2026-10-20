# Proposal: the waiting-for-the-shop booking page, to its drawing

## Why

A booking the shop hasn't accepted yet still shows the first release's page, headed "Awaiting shop confirmation", with no way to change or cancel it. The drawn page (`bk-page-request`) has the purple "Waiting for the shop to confirm" badge, the rows, and Change the date and Cancel request (decision 10, 1 Oct; audit H2: a waiting request opens as a request). The server already lets a customer change or cancel a request (piece 12: an unconfirmed booking moves at once). Jack, 20 Oct: "1" (this piece next).

## What Changes

For a booking waiting for the shop (`awaiting_confirmation`):
- "Your repair · [reference]" over the heading "Your booking request"; a card with the purple badge, "Please wait for the shop to confirm before bringing your bike in. Check this page to see when it does.", the Service, Bike, When and Your repair rows, and the shop's name.
- **Change the date**, the strip already built; a request moves at once, so its note and button say so ("Your request moves to the new date straight away; the shop still needs to confirm it." / "Move my request").
- **Cancel request**: "Cancel this request?", Keep my request / Cancel request; then the cancelled page.

## Lane, work package, drawings and decisions

- **Work package:** part of WP-4.4 (`bk-page-request` on the bk-page board), taken early. **Lane:** Jack's screens; no server change.
- **Drawings:** `bk-page-request` (`book.mjs` `bookingPage({ state: 'request' })`, `pageButtons(true)`), `bk-change`, `bk-cancel-ls`.
- **Decisions:** `2026-10-01-book-a-repair-review.md` decisions 10 and 12; piece 12 (an unconfirmed booking moves at once); Jack, 20 Oct.

## Out of scope

- `bk-request`, the thank-you card straight after sending ("Thanks, Maya — …": the page isn't sent the customer's name); Add a note for the shop; the offered-time page; texts.

## Impact

- `src/screens/book/pending.tsx`, `change-date.tsx`; tests
