# Design: a Done tick and a note on each line

1. **Storage (migration 074).** `sale_document_items` gains `done boolean NOT
   NULL DEFAULT false` and `note text` (null when there's none). Only order
   lines use them. The serializer adds `done` and `note`.
2. **One line at a time.** `PUT /api/sale-documents/:id/items/:itemId/progress`
   takes `{ done?, note? }`. A note is trimmed, an empty note clears it, and
   500 characters is the most (as the checklist). Refusals:
   - an order that isn't open: 409, the paid wording;
   - a linked job whose work is complete: 409, "This work is finished, so
     its work and parts can’t change. Reopen the work first.";
   - a line not on that order: 404.

   The finished check is made inside the same UPDATE, so a tick racing
   Finish is refused, as the checklist's is. No totals change.
3. **Kept through a replace.** `PUT …/items` deletes and re-inserts every
   line, so their ids change. Each incoming item may carry the `id` of the
   line it was. The old lines' `done` and `note` are read first and written
   onto the new lines with those ids. A new line, or one sent without an
   id, starts unticked with no note. The job page sends the ids.
4. **From a quote.** `addApprovedLinesToOrder` writes `note = reason` (from
   `workshop_quote_lines.reason`, null when empty).
5. **Never the customer's.** `note` isn't added to the portal's serializers,
   the receipt or any message.
6. **The screen** (`work-parts.tsx`):
   - A Done column, with a checkbox labelled "[line] done" in a 44px-wide
     hit area, as drawn; row height stays as it is.
   - A Note column: the note's text in muted type, or "+ Add note", which
     opens a box. The note saves when the box is left, as the checklist's
     does.
   - Both are disabled once the work is finished or the order isn't open,
     with "Reopen the work to change its work and parts."
   - Ticking saves straight away.
   - The phone layout follows the existing table.
