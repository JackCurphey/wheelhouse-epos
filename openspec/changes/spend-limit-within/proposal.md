# Proposal: work within the customer's spending limit goes ahead without a quote

## Why
Workshop day 41–43 (`docs/decisions/2026-09-27-workshop-day-review.md`):
"the quote step is skipped automatically… a quote is sent only when the total
would go over the limit, or when the customer set no limit". Drawn as
dq-job-within ("Within Maya’s £200 limit — no quote needed. She’ll be told
what was added.", "Save and tell Maya") and dq-within-limit ("Alex added some
work, within your limit"). The second of the spending-limit pieces; the limit
itself is `spend-limit-booking`. Only the customer sets it (Jack, 22 Oct).

## What changes
- **Migration 059**: a quote line can be decided `limit`.
- **The quote machine**: `draft → within_limit → approved`.
- **Server**: `POST /api/quotes/:id/within-limit` agrees a draft quote whose
  whole bill (the order, any booked service not on it yet, and the quote)
  stays within the job's limit, adds its lines to the job, and queues "Work
  added within your limit" to the customer. Over the limit, or with no limit,
  it is refused: send a quote instead.
- **Messages**: the "Work added within your limit" message (drafted wording,
  for Jack to read), live in Settings › Messages.
- **Job page and customer page**: in this change or the next, once Jack has
  read the wording.

## Risky areas
A migration, money (the whole bill and the order), and the messaging core.
Reviewed.
