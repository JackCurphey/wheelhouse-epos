# Design: how we contact you

## 1. Server
- **Migration 086** widens `customers_reminders_said_yes_via_check` to add
  `'account'`.
- **`PUT /api/portal/:shopSlug/me/contact`:**
  - **Refused first:** another website (`Sec-Fetch-Site` present and not
    `same-origin` or `none`), as the account's other actions do. Then signed
    out, or another shop (401).
  - **The body:** any of `updateChannel` (`sms`, `whatsapp`, `email`),
    `serviceReminders`, `reviewRequests`, `marketingPermission`. Anything
    else is 400.
  - **`sms` or `whatsapp` with no phone** is refused: "We don’t have a
    mobile number for you, so we can’t text you."
  - **A switch turned on:** turning on `serviceReminders` or
    `reviewRequests` sets `reminders_said_yes_at = now()` and `via =
    'account'`. Off just sets it off; the engine checks again when it sends,
    so a waiting reminder won't go.
  - **The answer** is the same contact fields `/me` gives.
- **`/me`'s `updateChannel`:** `email`, `whatsapp`, or else `sms`.

## 2. The box (`ContactBox` in `account.tsx`)
- **Layout:** a `Dialog`, laid out as `contactDialog` in `account.mjs`.
- **Job updates:** a radio group of three pill buttons (`role="radio"`).
- **The switches:** each a whole-row `role="switch"` button, saying On or
  Off in words.
- **Saving:** each press sends only what changed.
  - **On success,** the account's `me` query takes the answer, and a status
    line says what changed: "Service reminders are off" / "… are on", "Job
    updates will come by email".
  - **On failure,** nothing changes in the box, and an alert gives the
    server's words for a 400, or else "That didn’t go through. Check your
    connection and try again."
- **The page:** "Change" (`aria-label` "Change how we contact you") beside
  the "How we contact you" heading in Your details.

## 3. The stop page
After "stopped", the drawn line, with a link to
`/book/:shopSlug/sign-in?from=/book/:shopSlug/account`.

## 4. Decided here (logged)
- The no-mobile refusal's words.
- The status lines for the way and for turning a switch on.
- The stop-page line also shows for review requests and the shop's own
  messages.
