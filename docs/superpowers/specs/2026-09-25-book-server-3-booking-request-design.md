# Book server work, piece 3: the booking request

**Date:** 2026-09-25. **Approved in session by Jack** (design, 25 Sep).
**Serves:** book screens `details` (05) and `pending` (06), and the service
choice carried from `service` (01) and `service-list` (02).
**Part of:** the server prerequisite work for journey plan 4a
(`docs/superpowers/plans/2026-09-20-phase-4a-book.md`, item 3 gap table);
piece 3 of six. Pieces 1 and 2 (2a, 2b) are merged (#64-#66). Piece 4 guest
private link, 5 service questions, 6 customer uploads are out of scope.

## Decisions this rests on (Jack, 25 Sep)

1. **Contact and consent fields split.** Update channel and marketing
   permission live on the customer; terms consent lives on the booking, with
   a timestamp.
2. **The channel decides what is required.** Email needs an email address;
   SMS or WhatsApp needs a phone number. Otherwise 400.
3. **The booking names a service by id.** `serviceId` from the shop's
   bookable-online list, or a `notSure` flag. The hardcoded `PORTAL_JOB_TYPES`
   and the `jobType` input are removed; the old `public-portal/` page stops
   booking. It is replaced under `/book` (routing decision 23 Sep).
4. **Terms consent is required and stored as a timestamp.** The terms text
   is not stored. A shop that later changes its terms cannot show which
   wording a customer accepted; storing it is a separate piece if wanted.

Also chosen in the design, not asked: a returning customer's newer
preferences overwrite stored ones; `marketingPermission` defaults to false.

## What changes

### Schema - migration `025_booking_request_fields.sql`

Ask-first change; approved with this spec.

- `customers` (already has `email`, `phone`) gains `update_channel TEXT NULL
  CHECK (update_channel IN ('email','sms','whatsapp'))` and
  `marketing_permission BOOLEAN NOT NULL DEFAULT false`.
- `workshop_jobs` gains `terms_accepted_at TIMESTAMPTZ NULL`.
- No new tables; row-level security is inherited from the existing ones.

### The booking POST - `POST /api/portal/:shopSlug/bookings`

- **New inputs:** exactly one of `serviceId` or `notSure: true`; `email`;
  `updateChannel`; `termsAccepted`; `marketingPermission`.
- **`serviceId`** must be a service of this shop with `bookable_online`
  true; anything else is 400. Title, planned minutes and price come from
  the service row. **`notSure`** books 60 minutes under a generic title.
- **Channel rule:** `email` needs `email`; `sms` and `whatsapp` need
  `guestPhone`. Missing -> 400 with a plain-English message.
- **Terms:** `termsAccepted` must be `true`, else 400. On success the job
  stores `terms_accepted_at = now`.
- **Customer record:** the channel, email and marketing permission are
  saved on the customer; a repeat booking overwrites with the newer values.
- **Unchanged:** 2b's mode handling, per-(shop, date) lock, hold, and the
  409 `capacity` / 400 shop-rule split. The 409 `code: 'capacity'` already
  shipped in 2b (`capacityRefusal`, `server/server.js:2556`), so no error
  change is needed here.

### The response

Returns the reference already allocated by `allocateReference` inside the
booking transaction, with the booking state, for the `pending` screen. A
guest reading the request back later is piece 4.

## Testing (test first; each watched failing before its code)

- `serviceId` from another shop, or not ticked bookable, is rejected.
- `notSure` books 60 minutes; sending both or neither is 400.
- Each channel with its required contact present, and missing (400).
- `termsAccepted` missing or false is 400; true sets `terms_accepted_at`.
- The response carries the reference.
- Preferences saved on the customer and overwritten on a repeat booking.
- Migration 025 applies from an empty scratch database.
- The existing 2b tests still pass; tests that used `jobType` move to
  `serviceId`.

## Done when

`npm test`, typecheck, lint, build and the CI gates in
`.agents/STATUS.md` exit 0 on the branch, and CI is green against the
branch's own head SHA.
