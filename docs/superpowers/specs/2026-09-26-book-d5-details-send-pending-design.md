# Book (d5): details, sending, pending, and the whole journey

**Date:** 2026-09-26. **Follows:** d4 (#84, follow-ups #85) and **server
piece 11** (booking terms: standard Wheelhouse terms, a shop's own
replacement, a copy saved with each booking), which must merge first.
**Changes:**
- the atlas mock-ups for `details`, `pending` and `full`: one update channel
  instead of three tick boxes; no marketing box; no separate `full` screen
  (a refused time goes back to `date`); no "View request" / "Change or cancel
  request" buttons until d6.

## Why

The last steps of the customer booking journey at `/book`: the customer
gives their contact details, sends the booking request, and sees it waiting
for the shop. The private link reopens the same pending screen later. A test
drives the whole journey against the real server.

## Decisions (Jack, 26 Sep)

1. **Terms:** standard Wheelhouse terms every shop gets, replaceable by a
   shop's own; a copy of the exact text is saved with each booking. Claude
   drafts the standard text; Jack edits and approves it before it goes live
   (server piece 11).
2. **Updates:** pick one of Text message (default), WhatsApp, Email.
3. **No marketing permission box** for now.
4. **A time gone at sending** returns the customer to `date` with the time
   cleared and a message; nothing else they entered is lost.
5. **Change and cancel online** come later: server piece 12, then d6. Until
   then the pending screen says to contact the shop.
6. **The whole-journey test runs end to end** in a browser against the real
   server and a test database.

## Details screen: `details` (`/book/:shopSlug/details`)

- `BookFrame` step 4. Back link to `/book/:shopSlug/date`. Heading: "How can
  we reach you?". Action: "Request booking".
- **Guard:** requires `hasDate`; otherwise redirects to `date` (after
  `/services` has loaded, as on `date`).
- **Summary** at the top: the chosen services' names joined by ", " (or "Not
  sure"); the day and time as on `date`'s summary; "From £T" when the shop
  shows prices; the bike note when given.
- **Fields**, written to the draft as they change:
  - "Your name": required.
  - "Mobile number": required.
  - "How should we send updates?": single-choice pills "Text message"
    (default), "WhatsApp", "Email" (`updateChannel` `sms`, `whatsapp`,
    `email`).
  - "Email": required when Email is chosen; otherwise its label ends
    " (optional)".
  - A tick box "I agree to the booking terms", where "booking terms" opens
    the terms from piece 11 (the shop's, or the standard Wheelhouse text) in
    a dialog on the same screen.
- **Request booking** checks, showing each message under its field and a
  summary in the pinned area, with focus on the first problem:
  - "Please enter your name"
  - "Please enter your mobile number"
  - "Please enter a valid email address" (empty when Email is chosen, or
    not like an email address when given)
  - "Please accept the booking terms"
- **Photos cleared:** if `photosCleared` is true when Request booking passes
  its checks, the screen asks "Your photos were cleared - add them again, or
  send without them?" with "Add photos" (to `problem`) and "Send without
  photos".

## Sending

- Before sending, `/services` is refetched and answers are cleaned with
  `cleanAnswers` against it.
- The button reads "Sending…" and cannot be pressed again while sending.
- Body: `serviceIds` or `notSure: true`; `answers` (none for "Not sure");
  `bikeNote`; `description`; `photos` as `[{dataBase64}]` (bare base64, no
  `data:` prefix, no line breaks); `jobDate`, `mechanicId`, and `startTime`
  only on a timed day; `guestName`, `guestPhone`, `email` (when given),
  `updateChannel`, `termsAccepted: true`; and whatever piece 11 requires to
  record the terms.
- **Success (201):** the draft (including photos) is cleared and the
  customer goes to the reply's `privateLink`.
- **Refusals:**
  - a capacity refusal (409), "That time is no longer available", "That's
    too soon for the shop", or "That date has passed": the date, mechanic and
    time are cleared and the customer goes to `date`, which shows "Sorry,
    that time was booked while you were filling in your details - please
    choose another" until the next pick;
  - "The questions for this service have changed": to `problem`, showing
    the server's message;
  - 429: "Too many booking requests from this network - please try again
    later." on the details screen;
  - no response (network failure): "We couldn't send your booking - please
    check your connection and try again" on the details screen;
  - any other refusal: the server's message on the details screen.

## Pending screen: `pending` (`/book/:shopSlug/booking/:code`)

- Reads `GET /api/portal/:shopSlug/booking-links/:code`.
- Status line from `stage`: "Awaiting shop confirmation", "Confirmed", "In
  the workshop", "Ready to collect", "Collected", "Change requested",
  "Declined", "Cancelled", "Request expired".
- Summary: reference, services (with prices when shown, and "From £T"),
  day and time, bike note, description, answers.
- "Keep this link to check your booking" and a "Copy link" button (copies
  the page's full address; says "Copied" briefly).
- "Need to change or cancel? Contact <shop name>" (until d6).
- 404: "We can't find that booking"; 410: "This link has expired"; other
  failures: BookFrame's failed state with "Try again".
- No back link and no action.

## Rules

Pure functions in `src/screens/book/details-rules.ts` (field messages, the
request body from the draft and fresh services, sorting a refusal into
`date` / `problem` / stay) and `pending-rules.ts` (status text, summary
lines). The screens only call these.

## Tests (written first, each watched failing)

- Rules tests for both files.
- `tests/customer/details-screen.test.js`: guard, summary, fields and the
  default channel, each message, the email label, the terms dialog, the
  photos-cleared question, the sending state, success clearing the draft and
  navigating, each refusal route, 429 and network failure.
- `tests/customer/pending-screen.test.js`: each status, the summary, copy
  link, 404 and 410.
- `tests/browser/book-details.spec.ts` (320×568, mocked): the last field and
  the terms box are above the pinned area when scrolled to the bottom.
- `tests/browser/book-journey.spec.ts` (real server and test database): a
  throwaway shop with a service with a question, a mechanic and opening
  hours; a browser books from `/book/<shop>` to the pending screen, including
  a photo; then opens the private link cold and sees "Awaiting shop
  confirmation"; the booking exists in the database with the answers, bike
  note, photo and a terms copy. The shop is removed afterwards.

## Not in this piece

- Changing or cancelling online (piece 12, d6).
- Customer sign-in and saved bikes.
- Marketing permission.
- The body-size memory risk before public exposure (piece 6 open item;
  Jack's decision before hosting).
