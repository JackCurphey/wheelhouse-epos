# Proposal: a new quote after the customer says no to everything

## Why
A customer who said no to all the extra work and then changes their mind
had no way back: an all-declined quote couldn't be revised. Jack, 22 Oct
(`docs/decisions/2026-10-22-quote-after-declined.md`): "1: staff send a new
quote with just what she now wants; her earlier "no thanks" lines show as
history, like the drawn "quote has changed" page."

## What changes
- **The quote machine**: `declined` can be revised (`declined → superseded`),
  as `partly_approved` and `approved` already can.
- **Server**: the customer's quote replies carry `earlier: { agreed,
  declined }`, the lines answered on the job's earlier quotes.
- **Customer card** (dq-quote-newer): a quote with earlier answers says "The
  quote has changed", "Alex has added to the quote" (or "We’ve added to the
  quote"), "Your earlier answers are kept. Please answer the new line below.",
  "Already agreed: [booked work, earlier yeses] · £[agreed]" and "You said no
  thanks: [earlier noes]".

## Risky areas
A public route's reply (`/api/portal/*`). Reviewed.
