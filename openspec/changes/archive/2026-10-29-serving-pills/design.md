# Design: The till's Serving pills

## The contract

No migration. Staff routes, under the request's row-level security.

- `GET /api/till-checkin`: `names` is now filled on a till as well as on a
  workshop computer, with trust PIN on: who a tap would check in there.
- `POST /api/till-checkin/tap` `{ employeeId }` now also works on a till:
  the check-in is recorded on that till (`till_id`), `by_tap` true. A
  browser that is neither a till nor a workshop computer is refused with
  403 `not_shared_computer` (was `not_a_workshop`).
- **Who a tap checks in** (`tapNames`), unchanged but for the computer:
  someone active, with a PIN, never the Owner, with a check-in made by
  typing their PIN (`by_tap` false) on **this till or this workshop
  computer**, under this browser's sign-in, on the shop's day, after their
  PIN was last cleared or changed. A till's check-ins never count on a
  workshop computer or another till, nor the other way round.

## Decisions

1. **One tap, one set of rules.** The till uses the tap route and
   `tapNames` the workshop computer uses; only which computer's check-ins
   count changes. *Pattern:* trust-pin-workshop and working-pills.
2. **The strip is the drawing's**: under the quick buttons, at the end of
   the product side, a rounded box reading "Serving:", the pills (the
   person serving dark and `aria-pressed`), then "Someone else", in a group
   named "Who’s serving", scrolling sideways when it doesn't fit.
3. **The Owner's pill shows only while the Owner is serving** (see the
   proposal's "For Jack"). The person serving always has the highlighted
   pill, first if they aren't a name to tap (working-pills decision 1).
4. **The sale stays on screen when the person changes**, and Take payment
   sends whoever is serving then; nothing else moves it (roles and switches
   10, proposed). An open pay box covers the pills, so nobody changes
   mid-payment.
5. **"Someone else" ends the check-in and shows Enter your PIN** (the
   till's, with Checked in today), as Serving does today. A sale in
   progress stays, as it does when the check-in ends (review, 28 Oct, item 1).
6. **Checked in today's tappable names are buttons in the same chips**,
   44 pixels tall; the rest stay plain chips. A refused tap says why where
   a wrong PIN does, and the check-in is read again. *Pattern:*
   "Who's working?" (trust-pin-workshop design 5 and 6).
7. **The Serving button above the till stays**, with its menu for giving
   PINs: the pills are added, not swapped in, because the till bar's
   Serving (which the button stands in for) is drawn on `till-serving-pills`
   too.
