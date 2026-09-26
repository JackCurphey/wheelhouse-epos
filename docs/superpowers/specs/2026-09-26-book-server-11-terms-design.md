# Book server piece 11: booking terms

**Date:** 2026-09-26. **For:** d5 (`2026-09-26-book-d5-details-send-pending-design.md`),
which needs this merged first. **Approved by Jack, 26 Sep**, including
migration 034 and the standard terms text below.

## Why

A booking requires the customer to accept "the terms", but no terms exist
anywhere, and the booking records only when they ticked the box, not what
they agreed to.

## Decisions (Jack, 26 Sep)

1. Standard Wheelhouse terms every shop gets; a shop can replace them with
   its own.
2. A copy of the exact terms in force is saved with each booking.
3. The standard text is Claude's plain-English draft, approved by Jack
   (not legal advice).

## Changes

- **Migration `034_booking_terms.sql`:** `workshop_settings` gains
  `booking_terms TEXT` (null: use the standard terms); `workshop_jobs` gains
  `terms_text TEXT` (the copy agreed; null for bookings made before this
  piece and for staff-made jobs). Additive only.
- **Standard terms:** one exported constant in a small server module
  (`server/standard-terms.js`), the text below exactly, plain text with a
  line break between items.
- **GET `/api/portal/:shopSlug/terms`:** `{ title: "Booking terms", text,
  standard: boolean }`, where `text` is the shop's own terms when set, else
  the standard terms, and `standard` says which. Unknown shop: 404 like the
  other portal routes.
- **Staff settings** (the existing workshop settings GET/PUT): return
  `bookingTerms` (string or null) and accept it on PUT: a string (trimmed,
  1-20,000 characters) sets the shop's own terms; `null` or an empty/blank
  string reverts to the standard terms; omitted keeps the stored value. Over
  20,000 characters: "Booking terms can be up to 20,000 characters". Not a
  string or null: "Booking terms must be text".
- **POST `/api/portal/:shopSlug/bookings`:** on success, stores in
  `terms_text` the terms in force for the shop at that moment (the same text
  the GET would return), read inside the booking's transaction. The request
  body needs nothing new; `termsAccepted: true` is still required.

## Standard terms (exact text)

Title: `Booking terms`

```
1. Your booking is a request. It's confirmed only when the shop confirms it. Please don't bring your bike in until then.
2. Prices shown online are starting prices for labour. Parts are quoted separately.
3. Extra work. If we find something else that needs doing, we'll contact you first. We won't do extra work or fit extra parts without your approval.
4. Changes and cancellations. If you need to change or cancel, please let the shop know as soon as you can.
5. Accessories. Please remove lights, bags, bike computers and other removable items before drop-off. The shop can't be responsible for items left on the bike.
6. Collection. Please collect your bike within 14 days of being told it's ready. After that the shop may charge for storage.
7. Payment is due when you collect your bike, unless the shop agrees otherwise.
8. Your details. The shop uses your name, contact details and booking information to handle your booking and send the updates you choose. They aren't used for marketing without your permission.
```

## Tests (written first, each watched failing)

- GET terms: standard text when none set (exact match to the constant),
  the shop's own when set, 404 for an unknown shop, another shop's terms
  never returned.
- Settings: `bookingTerms` returned; set, kept when omitted, reverted by
  null and by blank; over 20,000 and non-string refused with the wording
  above.
- Booking: `terms_text` holds the standard text for a shop with none, the
  shop's own when set, and the text in force at booking time (changing the
  terms afterwards leaves the stored copy unchanged).

## Not in this piece

- A staff screen for editing terms.
- Showing the terms to customers (d5).
