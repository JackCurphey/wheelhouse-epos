# Design: own booking terms

## Data (exists, piece 11)

- `GET`/`PUT /api/workshop-settings` `bookingTerms`: a string, or null for the standard terms. PUT trims; empty or blank → null; over 20,000 characters → 400 "Booking terms can be up to 20,000 characters". Owner only.
- `GET /api/portal/:slug/terms` → `{ title, text, standard }`: the standard text when the shop has none of its own. Settings reads it once to fill the box when "Use your own" is pressed.

## Screen

- A "Terms" sub-heading at the end of Online booking.
- Standard (`bookingTerms` null, box closed): label "Booking terms", hint "Wheelhouse's standard terms · a copy is kept with each booking", button "Use your own".
- "Use your own" opens a textarea "Your booking terms" (8 rows, `maxLength` 20,000) filled with the standard text, with the hint "Customers agree to these when they book. A copy is kept with each booking." It saves when left, only if the words differ from what customers get now (so leaving the standard text untouched saves nothing); "Saved." or the server's refusal.
- Own (`bookingTerms` set): hint "Your own terms · a copy is kept with each booking", the textarea with them, and "Go back to Wheelhouse's standard terms" (ghost), which saves `bookingTerms: null` and closes the box.
