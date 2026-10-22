# Proposal: quote lines that go together, and what happens without a Needed line

## Why
Jack, 1 Oct (`docs/decisions/2026-10-01-drop-off-and-quote-review.md`):
decision 2, "lines that only make sense together (pads and fitting) tick and
untick as a pair"; decision 7 ("yeah go ahead with all of them"): "an
unticked "Needed" line says what happens without it" and "staff choose which
lines go together ("Goes with: Shimano brake pads", M2, option 1)". Both were
left for later in the quote stage (`2026-10-03-quote-stage-design.md`) and
are the next WP-4.2 piece.

## What changes
- **Migration 055**: `workshop_quote_lines.goes_with_line_id` (the part a
  labour line goes with; `ON DELETE SET NULL`) and `without_text` (up to 300
  letters).
- **Server** (`server/workshop/quotes.js`): a line can carry `goesWith` (the
  index, in the same list, of the part it goes with) and `without`. Only a
  labour line can go with something, and only with a part, so pairs never
  chain. Replies carry `goesWithLineId` and `without`. A whole answer that
  says yes to one of a pair and no to the other is refused; the old
  one-line-at-a-time decision refuses a line in a pair.
- **Staff job page** (dq-job-quote): a draft labour line has "Goes with"
  (Nothing, or one of the quote's parts); once sent it reads "Goes with
  Shimano brake pads". A draft Needed line has "What happens without it".
  Record their answer ticks a pair together.
- **Customer card** (dq-quote, dq-quote-decline): ticking or unticking one of
  a pair does both, and says so to screen readers ("Fit & adjust brakes
  unticked too."); an unticked Needed line with words shows "Alex recommends
  this. [words]".

## Not in this change
Photos, reminders, the newer-quote view, the spending limit.

## Risky areas
A migration, and a public route's reply (`/api/portal/*`). Reviewed.
