# Request received and Booking cancelled send

## Why
Jack approved the six booking messages' wording on 20 Oct (`docs/decisions/2026-10-20-booking-messages.md` answer 4). The four that staff answers send went in that day. Request received and Booking cancelled waited for the customer's side, which was Mark's booking server. Under the working agreement (#349), Jack builds them.

## What changes
- **Request received:** sent when a booking request is sent and not confirmed at once. When it is confirmed at once, Booking confirmed goes instead.
- **Booking cancelled:** sent when the customer cancels from their booking page, and when the shop cancels.
- **The customer's side:** these messages carry the link the customer already has, made absolute with `APP_PUBLIC_URL` only, never from the request's Host. Staff cancelling goes through `sendBookingMessage`, and says when the customer has no way to be reached, as the other answers do.
- **Settings › Messages:** both now show as sent (`LIVE_KEYS`).
- **Everything is pretend for now:** the link reads "[link]".

## Impact
- **Code:** `server/routes/portal.js` (`sendLinkMessage`), `server/routes/workshop.js`, `server/messaging/templates.js`.
- **Tests:** `tests/messaging-booking-triggers.test.js`, plus the lists in `tests/messaging-templates.test.js`, `tests/message-templates-routes.test.js` and `tests/auto-confirm.test.js`.
