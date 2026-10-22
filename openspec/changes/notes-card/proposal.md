# Proposal: the customer's "Notes with the shop" card

## Why
WP-4.5's second piece. Decision 3 (`docs/decisions/2026-10-01-account-and-reminders-review.md`):
conversations on the job's page. Drawn as `jobThread` in
`generator/account.mjs`: ac-job-note (writing), ac-job-note-sent and
ac-job-note-answered, on the in-the-shop booking page. The server is
`notes-with-the-shop` (#421).

## What changes
- The booking page, while the bike is in the shop, shows "Notes with the
  shop": the thread (yours on the right, the shop's on the left, who and
  when), "Add a note for the shop" with Send note until there's a note, then
  "Reply" with Send; "Sent. [Shop] will reply here, and we’ll text you when
  they do." while waiting; "We’ll reply here and text you when we do." under
  the box.

## Risky areas
A public page's use of a public route. Reviewed.
