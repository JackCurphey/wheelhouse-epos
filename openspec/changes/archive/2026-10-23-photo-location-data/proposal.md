# Proposal: photos lose their location when they're uploaded

## Why

A photo taken on a phone usually carries hidden details: where it was taken
(often the customer's home, since riders photograph bikes there), when, and
the phone it came from. Jack agreed on 1 Sep that location data is removed
when a photo is uploaded (CX-2, `docs/decisions/2026-09-01-ownership-signoff.md:111`),
and the plan's check is "a photo taken outdoors carries no location data after
upload" (`docs/superpowers/plans/2026-08-31-master-implementation-plan.md:275`).
Today nothing removes it, and quote-line photos are now shown to customers
(#411). It is the last of the quote pieces in Jack's order (STATUS, 23 Oct).

## What Changes

- Every photo a customer adds to a booking request, and every JPEG, PNG or
  WebP picture staff attach to a job (which includes a quote line's photo),
  has its hidden details removed before it is saved: location, time taken,
  camera and phone details, and any embedded text.
- What a photo needs to look right is kept: which way up it goes (so a phone
  photo isn't shown sideways) and its colour profile. The picture itself is
  not changed or recompressed.
- A file that isn't a JPEG, PNG or WebP picture (a PDF, say) is saved as it
  is.
- No screens change.

Work package WP-4.2 (quotes; CX-2), taken by Jack. **Touches a risky area:**
the booking request's photos come in through a public route
(`/api/portal/*`), so `/review` runs before merging.

Follows: `docs/decisions/2026-09-01-ownership-signoff.md` CX-2 ("Agreed");
`docs/superpowers/specs/2026-08-31-workshop-first-build.md` rule 9 ("Strip
EXIF GPS server-side on every upload"); `docs/decisions/2026-08-31-feature-catalogue.md`
LEG-06. Not drawn: there is nothing on screen.

Out of scope:
- iPhone HEIC pictures and other formats: the booking page only takes JPEG,
  PNG and WebP; a staff attachment in another format is saved as it is.
- Product and website images (`server/lib/uploads.js`), which are pictures of
  stock, not of customers' bikes.
- Photos already saved before this change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `book`: a booking request's photos are saved without their hidden details.
- `workshop-jobs`: pictures attached to a job, including a quote line's
  photo, are saved without their hidden details.

## Impact

- A new pure module, `server/photo-metadata.js`, used by
  `server/booking-photos.js` and the attachments route in
  `server/routes/workshop.js`.
- No new dependency, no migration, no screen change. The saved size of a
  cleaned photo is smaller by the details removed.
