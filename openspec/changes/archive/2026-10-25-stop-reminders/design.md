# Design: "Stop these" for service reminders

## Decisions

1. **`reminder_stop_codes`**, as `quote_photo_codes` is:
   - only the code's hash is kept, with the customer and the kind
     (`service_reminders`);
   - shop row-level security.

   It never runs out, because a reminder can be months old when it's opened
   (decision 6: "works without signing in"). It can be used again: stop,
   turn back on, stop.
2. **The link is made at set-up and kept as the message's ending.**
   - Reminders are sent by the server's timer, which has no request to
     build an address from, so the code is made when the bike is collected
     (that request knows the shop's address).
   - The full "Stop these: …." line goes in a new `customer_messages.ending`
     column.
   - When the reminder goes, the shop's words are written afresh (answer 1)
     and the kept ending is put back.
   - While sending is pretend, `messageLink` gives "[link]" and no code is
     made, as for every other link.
3. **The routes** are public under `/api/portal/:shopSlug/reminder-stops/:code`,
   rate-limited as photo codes are:
   - `GET` gives `{ shopName, on }`;
   - `POST { stop: true | false }` stops reminders, or turns them back on.

   An unknown or malformed code gets the same 404, so codes can't be probed.
4. **Turning them back on** sets `service_reminders` true, with
   `reminders_said_yes_at` now and `reminders_said_yes_via` 'stop_page'.
   Migration 079 widens 077's check to allow it. Stopping clears only
   `service_reminders`: review requests have a stop of their own.
5. **The page,** in the booking frame as Use my phone's is:
   - the press page isn't drawn, so it follows the stopped page's card;
   - a code that doesn't work says "This link doesn’t work" with no customer
     details, as the photo step's gone state does;
   - the drawn "Sign in to your account" line waits for the account.

   All three are logged.
