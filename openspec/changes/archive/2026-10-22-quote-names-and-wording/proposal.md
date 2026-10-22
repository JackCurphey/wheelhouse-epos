# Proposal: the customer's quote in the drawings' words, naming staff only with the switch on

## Why
The rest of quotes (WP-4.2) starts with the drawn wording (journey 4,
`docs/design/user-journeys/generator/quote.mjs`): the drawings name the
mechanic ("Alex recommends more work") and the customer ("Thanks, Maya —
Alex is carrying on"), where the built card says "We" and "Thanks". Showing
a staff name to customers was settled for sign-off only, behind the shop's
"Show who signed off to customers" switch (Jack, 18 Oct,
`docs/decisions/2026-10-16-mechanic-sign-off.md`). Jack, 22 Oct: "1: show
staff names on the quote only when the shop's Show who signed off to
customers switch is on; otherwise say we."

## What changes
- The customer's quote replies (`GET /api/portal/:shopSlug/quotes/:id` and
  `GET …/booking-links/:code/quote`) add `mechanicName` and
  `customerFirstName`; `mechanicName` and each line's `decidedByName` are
  `null` unless the switch is on.
- The customer's quote card takes the drawn words: "Alex recommends more
  work" / "We recommend more work"; "Alex recommends this." / "We recommend
  this."; "Not sure? Call [shop phone]."; the answered headings and lines
  (dq-answered, dq-answered-declined, dq-answered-phone); the withdrawn
  heading and line (dq-withdrawn).
- The staff Withdraw and Record-answer boxes take the drawn subtitles, words
  and "Withdraw quote" button (dq-withdraw, dq-record-answer).
- The switch's note in Settings › Workshop › Mechanics says it covers quotes.

## Not in this change
The pinned bar on tablet and phone, "Add a note for the shop", photos,
"Goes with", the without-it line, reminders, the newer-quote view and the
spending limit: later pieces of WP-4.2.

## Risky areas
A public route (`/api/portal/*`). Reviewed.
