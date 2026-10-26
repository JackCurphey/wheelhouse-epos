# Design: adding a bike

## 1. The staff page
- **The button:** "+ Add" goes in `Section`'s `action`, as Details' Edit
  does. Its name for screen readers is "Add a bike".
- **The box:** a `Dialog`, "Add a bike". Its fields are copied from
  `new-job-dialog.tsx`: Make ("e.g. Trek"), Model ("e.g. FX2"), Colour and
  Serial number.
- **Saving:** `POST /api/customers/:id/bikes`, which is already built. Then
  the customer's bikes query is refreshed.

## 2. The account
- **The button:** "+ Add a bike", as drawn (a link-style button), under the
  bikes and on the empty card.
- **The box:** a `Dialog`, "Add a bike", with "Make and model" and "Colour,
  or anything that helps us spot it", as `bk-bike`'s guest fields are.
- **What's saved:** the make-and-model text goes in as `make`, with `model`
  empty, as the booking's guest bike does.
- **After saving:** the `['account', slug, 'bikes']` query is refreshed.

## 3. The server
`POST /api/portal/:shopSlug/bikes` refuses a request whose `Sec-Fetch-Site`
is present and isn't `same-origin` or `none`. This is the same rule as the
account's job actions (`resolveBookingLink`).

## 4. The repair page
- **How it knows:** the code starts with `job-`.
- **What shows:** "Your account", a link to `/book/:shopSlug/account`, in
  place of "Keep this link" and Copy link.

## 5. Decided here (logged)
- Both boxes' wording.
- "Your account" on the repair page.
