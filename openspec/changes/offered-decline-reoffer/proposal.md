# Declining or re-offering a time already offered

## Why
Once staff offer a booking request another time, the booking shows as "Time offered" and nothing more can be done with it from the diary: no decline, no different time (`decided-while-building.md`, Offer another time, the customer's page, item 5). The server already allows both (`bookingRequest`: `offered → offer | decline`). Jack, 20 Oct: "draw staff declining or re-offering an offered booking time", then "Approve the offered-time drawings (offer a different time, decline); build it." (`docs/decisions/2026-10-20-offer-another-time.md` item 4).

## What changes
- Clicking an offered booking's block opens the request pop-up for it (drawn `request-offered`): the offered time, who it's with, "Waiting for [first name] to accept it or cancel. It’s kept free for them.", "Your message to [first name]", the request; **Offer a different time** (the diary pick, as Offer another time) and **Decline**; no Accept.
- **Decline** opens `request-offered-decline`: a message to the customer, "[day] at [time] is no longer kept for [first name].", Decline & notify customer or Keep request.
- A second offer's pop-up says "Asked for" the day first asked for.
- Staff job data gains `offer` (`fromDate`, `fromTime`, `message`) while a time is offered, as the customer's link already has.

## Drawings and decisions
`request-offered`, `request-offered-decline` (`docs/design/user-journeys/generator/diary.mjs`, #332); `docs/decisions/2026-10-20-offer-another-time.md` item 4.

## Impact
- `server/workshop/jobs.js` (`serializeWorkshopJob`; workshop server, flagged for Mark).
- `src/screens/diary/request-dialog.tsx`, `diary-page.tsx`, `offer-dialog.tsx`, `rules.ts`.
- Tests: `tests/workshop-offer.test.js`, `tests/screens/request-offered.test.js`.
