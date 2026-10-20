# Telling staff when a booking message didn't go

## Why
Staff answers send the booking messages (#336), but when the customer has no phone or email nothing is sent and staff aren't told (logged gap, booking-message-triggers item 5). Jack, 20 Oct: drawn as `diary-no-message` and `diary-no-message-phone`, and approved ("Approve the didn't-go note drawing; build it."; `docs/decisions/2026-10-20-booking-messages.md` answer 5).

## What changes
- Accept, decline, offer and an accepted date change reply with `bookingMessage: { skipped: 'no_contact', name }` when the message had no way to reach the customer (workshop server, flagged for Mark). Switched off says nothing.
- The diary shows the drawn floating note, "“Booking confirmed” didn’t go: Sam Reed has no phone number or email on file.", in the panel's colours, with Close.

## Impact
`server/routes/workshop.js`; `src/screens/diary/no-message.ts` (new), `request-dialog.tsx`, `offer-dialog.tsx`, `diary-page.tsx`. Tests: `tests/messaging-booking-triggers.test.js`, `tests/screens/diary-answer.test.js`, `diary-offer.test.js`.
