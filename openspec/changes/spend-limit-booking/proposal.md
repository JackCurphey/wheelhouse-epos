# Proposal: the customer's spending limit, chosen at booking and shown on the job

## Why
Workshop day 41–43 (`docs/decisions/2026-09-27-workshop-day-review.md`): the
customer can say how much the whole bill may come to when booking; the job
shows it as a tag "so a mechanic sees how far extra work can go before a
call"; within it, the quote step is skipped (a later piece). Drawn on the
booking's bike step (`book.mjs` `limit()`) and the job page's tag
(`job-page.mjs` `SPEND_LIMIT`, "Customer OK up to £200"). The first of three
pieces: this one stores and shows the limit.

## What changes
- **Migration 058**: `workshop_jobs.spend_limit`, whole pounds, 1 to 100000;
  empty means ask first.
- **Booking, bike step**: "If the mechanic finds more to do", with "Ask me
  before any extra work" (chosen to start) and "Go ahead if the whole bill
  comes to no more than £[200]"; the amount is whole pounds.
- **Booking summary**: a line when a limit is set.
- **Server**: the online booking takes `spendLimit`; a job's replies carry
  `spendLimit`.
- **Job page**: the drawn tag, "Ask before any extra work" or "Customer OK up
  to £200".

## Not in this change
Skipping the quote within the limit, the "Work added within your limit"
message and the customer's within-limit page (the next pieces); staff
setting or changing a limit (not drawn; for Jack).

## Risky areas
A migration and a public route (`POST /api/portal/:shopSlug/bookings`). Reviewed.
