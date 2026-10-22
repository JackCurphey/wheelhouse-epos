# Proposal: a photo on a quote line

## Why
Jack, 1 Oct (`docs/decisions/2026-10-01-drop-off-and-quote-review.md`): "Photos
on each quote line, added by the mechanic from the job page"; the customer
"sees a small picture beside that line's reason and can tap to enlarge it;
photos are optional". Drawn as dq-quote-photo (the customer's line and its
enlarged photo) and on dq-job-quote ("Add photo for …", "1 photo — view or
add for …"). The next WP-4.2 piece.

## What changes
- **Migration 057**: `workshop_quote_lines.photo_attachment_id`, one of the
  job's files (`workshop_job_attachments`), `ON DELETE SET NULL`.
- **Server**: a quote line takes `photoId`, which must be a JPEG, PNG or WebP
  file of the same job (checked by its first bytes); replies carry `photoId`.
  `GET /api/portal/:shopSlug/booking-links/:code/quote/lines/:lineId/photo`
  serves that photo to the customer, only for a line of the booking's current
  customer-readable quote, inline, as the type its bytes show.
- **Job page**: a draft line has the drawn "Add photo for [line]" (44px); with
  a photo it reads "1 photo — view or add for [line]" and opens the photo
  larger with Replace photo and Remove from line. The photo is one of the
  job's files, so it also shows in Files and photos.
- **Customer card**: a line with a photo shows the drawn thumbnail with "Tap
  to enlarge"; tapping opens it larger, titled with the line and its reason.

## Not in this change
"Use my phone" (a code for a phone to add the photo, walk-through 8),
removing location data from photos (CX-2; booking photos don't yet either),
and the photo on Ready to collect: later pieces.

## Risky areas
A migration and a new public route (`/api/portal/*`). Reviewed.
