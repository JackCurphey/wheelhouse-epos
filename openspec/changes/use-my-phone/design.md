# Design: Use my phone

## Context

Built pieces this reuses (survey, 23 Oct):
- **No-sign-in links:** the booking link stores only a SHA-256 of a 64-hex
  code (`server/booking-link.js`), and is checked shape-first, then by hash,
  inside the shop's RLS scope, under a per-IP limiter (`portal.js:277-314`).
  Every public route has the shop's slug in its address, which is how
  `runWithShop` scopes the database (`server.js:603-637`).
- **A line's photo:** the staff app uploads to the job's attachments, then
  re-saves the whole draft with `photoId` on the line, matched by place,
  because a draft save gives every line a new id (`quote-panel.tsx:143-158`,
  `createRevision` in `server/workshop/quotes.js`). `photoProblem` checks the
  photo is one of the job's JPEG, PNG or WebP files.
- **Uploads** are cleaned of hidden details (`removePhotoDetails`, #433).
- **Pop-up polling:** react-query `refetchInterval`, as job messages do
  (`job-messages.tsx:83`).

## Goals / Non-Goals

**Goals:** the drawn flow; a code that can't be guessed, lasts 15 minutes,
works once and only adds a photo to that draft line; nothing about the
customer on the phone. **Non-Goals:** see the proposal.

## Decisions

1. **A code is a row, keyed by its hash.** Migration 062 adds
   `quote_photo_codes` (shop-scoped, RLS enabled and forced, as
   `061_job_notes.sql`): `code_hash` (unique), `workshop_job_id`,
   `quote_id`, `line_position`, `line_description`, `expires_at` (made +
   15 minutes), `used_at`, `attachment_id`. The code is 64 hex from
   `newLinkCode()`; only `hashLinkCode()` is stored. *Alternative:* a signed
   token with no table. Rejected: "works once" needs somewhere to record use.
2. **The line is found by quote and place, and checked by its words.** Line
   ids change on every draft save, so the code holds the draft quote's id,
   the line's place and its description. When the photo arrives, the server
   reads the job's current draft: if it's not the same quote (sent, or a new
   revision), or the line at that place has different words, the code is
   treated as expired and nothing changes. Otherwise it saves the draft again
   with `photoId` on that line, as the staff app does, in one transaction
   with marking the code used. *Alternative:* re-key lines with lasting ids.
   Rejected: a change to the quote engine for one feature.
3. **Routes.**
   - `POST /api/workshop-jobs/:id/quote-photo-codes` (staff) with
     `{ quoteId, linePosition }` makes a code and returns its path
     `/book/:shopSlug/photo/:code` and `expiresAt`.
   - `GET /api/workshop-jobs/:id/quote-photo-codes/:codeId` (staff) says
     `waiting`, `added` (with the attachment id) or `expired`, for the pop-up
     to ask every 3 seconds while it's open.
   - `GET /api/portal/:shopSlug/photo-codes/:code` (public) returns only the
     shop name, the job's reference, the bike, the line's words and reason;
     410 when expired or used.
   - `POST /api/portal/:shopSlug/photo-codes/:code` (public) takes
     `{ dataBase64 }`, checks the picture is a JPEG, PNG or WebP of at most
     10 MB (`readBookingPhotos`' rules, which also clean it), saves it as one
     of the job's files and puts it on the line.
   The public routes run under their own per-IP limiter, as booking links do,
   and answer the same 410 for unknown, used and run-out codes, so a code
   can't be probed.
4. **The phone page lives in the customer app**, at `/book/:shopSlug/photo/:code`,
   in `BookFrame`, so the shop's name and look come for free. The customer
   routes test is changed to allow this one page outside the booking steps.
   Its four states are the four drawings.
5. **The QR code is drawn in the browser** with the `qrcode` package (small,
   well-known, no native parts), from the full address. The link under it is
   the same address. *Alternative:* draw it on the server. Rejected: adds a
   dependency to the server, which keeps to `pg` on purpose.
6. **The choice shows on a computer only**: a fine pointer and wide window
   (not `(pointer: coarse)`, not under 1024px), as the quote bar decides it.

## Risks / Trade-offs

- [Someone guesses a code] → 64 hex characters, a per-IP limiter, the same
  answer for every bad code, 15 minutes, one use.
- [A code shared by mistake] → It can only add one photo to one draft line
  and shows nothing about the customer.
- [Staff edit the line while waiting] → The words check (decision 2) refuses
  rather than putting the photo on the wrong line.
