# Proposal: "Add a note for the shop" from the quote

## Why
Quotes (WP-4.2). The drawings put "Add a note for the shop" on the
customer's quote card — "Not sure? Call [shop phone], or [Add a note for the
shop]" (`quoteCard` in `docs/design/user-journeys/generator/quote.mjs`,
dq-quote) — and on the Work agreed card (`agreed()`, dq-in-shop,
dq-answered). In the mock-up the button goes to the job's page with its
note box (`mockup/links/j04.mjs`: ac-job-note). Since #422 that box is the
"Notes with the shop" card on the same booking page
(`src/screens/book/notes-card.tsx`; account decision 3,
`docs/decisions/2026-10-01-account-and-reminders-review.md`).

## What changes
- The quote card's last line reads "Not sure? Call [shop phone], or" and
  then an "Add a note for the shop" button, as drawn.
- The Work agreed card ends with the same button, as drawn.
- The button moves the customer to the Notes with the shop card and puts
  the cursor in its box (labelled "Add a note for the shop", or "Reply" once
  there is a note).
- Where the page has no notes card (before the bike is in), the quote card
  keeps "Not sure? Call [shop phone]." with no button.

## Not in this change
The same button on the Ready to collect card (`collect.mjs`); a later piece.

## Risky areas
None: a customer screen only, no server change.
