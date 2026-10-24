# Design: saying yes to service reminders when booking

## Decisions

1. **Two yes-or-no answers on the customer, and when they were given.**
   Migration 077 adds these to `customers`:
   - `service_reminders` and `review_requests`, both `BOOLEAN NOT NULL
     DEFAULT false`;
   - `reminders_said_yes_at TIMESTAMPTZ` and `reminders_said_yes_via TEXT`,
     where via is `'booking'` or `'collection'`.

   There are two answers because "How we contact you" switches them
   separately later (`ac-account`, decision 6), although one tick says yes
   to both. When and where are kept because a yes to being contacted should
   be provable.

2. **Only a tick writes.** `remindMe: true` in the booking body sets both to
   true and records when and how. Anything else leaves the customer as they
   were. A customer who said yes before and books again without ticking
   keeps their yes: "Stop these" and the account are where it goes off
   (decision 6). The drawing always starts the tick unticked.

3. **Saved with the rest of the customer.** The booking already updates the
   customer once the job is in, inside the lock (`portal.js`, the
   update_channel write), so a refused booking writes nothing. The yes is
   written right after it, in the same transaction. For a guest this row is new each time
   (`resolveGuestCustomer`), so a stranger's booking can't turn on another
   customer's reminders.

4. **The screen.** The tick sits after the email box and before the
   deposit, as drawn (contact, updates, tick, pay). It uses the shared
   `Checkbox` with the drawn two-line label, top-aligned. The draft keeps
   `remindMe`. The request sends `remindMe: true` only when it is ticked.

## Contract

`POST /api/portal/:shopSlug/bookings` takes an optional `remindMe`. Only
`true` counts; other values are ignored rather than refused, as
`marketingPermission` is.
