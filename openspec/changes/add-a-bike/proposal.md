# Adding a bike: on the staff customer page and on the customer's account

## Why

Two "+ Add" buttons are drawn, but neither is built:
- the staff customer page's Bikes heading (`cs-page`, `customer.mjs:113`);
- the customer's account (`ac-account`, `ac-account-new`).

Neither form is drawn. The not-drawn pages answers say:
- the staff one copies the new-job dialog's bike form (rows 17 and 23,
  answer C);
- the account one follows "A different bike" on the booking page (row 16,
  answer C).

(`docs/decisions/2026-10-08-not-drawn-pages.md`.) Both were left out until
their pieces existed (`decided-while-building.md`, 24 Oct customer page,
and 26 Oct account screens). Those pieces have now merged.

This also carries one fix found on the account. A repair opened from the
account said "Keep this link to check your booking", but that link works
only for the signed-in customer. It now shows "Your account" instead.

**Risky area:** customer accounts and public routes. The account's
`POST /api/portal/:shopSlug/bikes` now refuses a request from another
website, as the account's other actions do.

## What changes

- **Staff customer page:** "+ Add" beside Bikes opens "Add a bike" with
  Make, Model, Colour and Serial number, as the new-job dialog has them, and
  Cancel and Add bike. A bike with neither make nor model is refused: "Enter
  a make or a model."
- **The account:** "+ Add a bike" under the bikes, and on the empty card,
  opens "Add a bike". It has "Make and model" and "Colour, or anything that
  helps us spot it", as the booking's bike step does, with Cancel and Add
  bike. The new bike shows straight away.
- **The account's add-bike route** refuses another website.
- **A repair opened from the account** shows "Your account", not a link to
  keep.
