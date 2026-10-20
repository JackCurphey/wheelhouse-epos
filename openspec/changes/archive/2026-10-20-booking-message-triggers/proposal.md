# The booking messages staff answers send

## Why
The six booking messages' wording is approved and stored (`docs/decisions/2026-10-20-booking-messages.md` answer 4: "built with the messages engine … and the booking messages' triggers"), but nothing sends them. The four that follow a staff answer live in the workshop server (Jack's lane); Request received and Booking cancelled follow the customer's own actions in Mark's booking server and wait for him.

## What changes
- Accepting a request queues **Booking confirmed**; offering another time, **New time offered**; declining (a request or an offered time), **Request declined**; accepting a date change, **Date change answered**. At once, the customer's way, pretend (no Undo is drawn for these answers).
- Their tap-ins: the service, the booked day and time ("Thu 17 Sep, 11:30"), when to drop off (the booking page's rule), the shop's note on the confirmation, the suggested or new time, and the shop's message.
- **While sending is pretend, a message shows "[link]" and no new link is issued**, so the customer's own booking link keeps working; this also changes Bike ready (#326). A fresh link is issued once real sending is on.
- Settings › Messages lists these four too, under "Booking messages", as drawn.

## Impact
`server/routes/workshop.js`, `server/workshop/job-messages.js` (workshop server, flagged for Mark); `server/messaging/templates.js`, `server/messaging/senders/index.js`, `server/routes/messages.js` (messages engine, Mark's lane on Jack's word); `src/screens/settings/messages-settings.tsx`. Tests: `tests/messaging-booking-triggers.test.js`, `tests/messaging-triggers.test.js`, `tests/messaging-templates.test.js`, `tests/message-templates-routes.test.js`, `tests/screens/settings-messages.test.js`.
