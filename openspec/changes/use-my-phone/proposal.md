# Proposal: Use my phone for a quote line's photo

## Why

On a computer, taking a photo of a worn part means getting it from a phone
onto the computer first. Jack decided on 3 Oct (walk-through 8, decision 6)
that a quote line's "Add photo" also offers "Use my phone": a code to scan
that opens that line's photo step on the phone, with no sign-in. The drawings
were approved on 23 Oct (`docs/decisions/2026-10-23-use-my-phone.md`). It is
the last quote piece in Jack's order.

## What Changes

- On a computer, a draft quote line's "Add photo" opens a choice: "Choose a
  file" (as now) or "Use my phone". On a tablet or phone it goes straight to
  the camera or file picker, as now.
- "Use my phone" opens "Add a photo from your phone" with a code to scan and
  a link to type, which work for 15 minutes, for one photo on that line. The
  pop-up shows "Waiting for the photo…", then "Photo added" by itself once
  the photo arrives.
- The phone page opens with no sign-in: the shop's name, "Add a photo for
  [line]", the job's reference and bike, the line's reason, "Take a photo"
  and "Choose from your photos"; then "Check the photo" with "Use this photo"
  and "Take another"; then "Photo added". A code that has run out, or has
  already been used, says so and nothing else. The customer's name and phone
  are never shown.
- The photo goes on the line exactly as one chosen from a file would: one of
  the job's files, its hidden details removed (photo-location-data).

Work package WP-4.1 (in the build plan), taken by Jack. **Touches two risky
areas:** a migration (the codes' table) and a public route (the phone page's
calls, under `/api/portal/`), so `/review` runs before each merge.

Follows: drawings `job-photo-choice`, `job-photo-phone`,
`job-photo-phone-added`, `phone-photo-ready`, `phone-photo-check`,
`phone-photo-done`, `phone-photo-expired` (journey 12); decisions
`2026-10-03-ux-walkthrough-8.md` decision 6 and `2026-10-23-use-my-phone.md`.

Out of scope: more than one photo per code; a photo for anything but a draft
quote's line; showing the code on a tablet or phone.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `workshop-jobs`: a draft quote line's photo can come from a phone, through
  a code that lasts 15 minutes and works once.

## Impact

- Server: migration 062 (`quote_photo_codes`), a staff route to make a code,
  a staff route the pop-up asks, and two public routes for the phone page
  under `/api/portal/:shopSlug/photo-codes/:code`; the route list (190 → 194)
  and their screen-trace comments.
- Screens: the quote panel's Add photo choice and pop-up; a new customer-app
  page at `/book/:shopSlug/photo/:code`, with the customer routes test
  updated for it.
- **New dependency:** a small, well-known QR code maker for the screens
  (`qrcode`), said so in the pull request (project rule 6).
- Two pull requests: the server half, then the screens.
