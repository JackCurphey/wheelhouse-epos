# Design: To return to [Supplier], with Returned

## 1. Migration 107

`delivery_problems.returned_at TIMESTAMPTZ` and
`returned_by_login_id INTEGER REFERENCES logins(id)`, both null until
Returned. `ADD COLUMN IF NOT EXISTS`, so safe to run twice; the table keeps
its row-level security (092).

## 2. The contract

Both the Owner's only (403 `owner_only`, "Only the shop's owner can order
stock", as orders), until roles bring "Can order stock".

- `GET /api/deliveries/to-return` →
  `{ suppliers: [{ supplierId, supplierName, items: [{ id, productName, kind, qty, deliveredAt }] }] }`.
  Every damaged or wrong item not yet returned (missing items are still to
  come on their order, never returned). The supplier is the order's, or the
  one picked when it wasn't on an order; items with none are grouped with
  `supplierId: null`, `supplierName: null`. The supplier whose
  oldest item has waited longest first, the no-supplier group last; items
  oldest first. `kind` is `damaged` or
  `wrong_item`; `deliveredAt` is when it was booked in.
- `POST /api/deliveries/to-return/:id/returned` → 200 `{ id, returnedAt }`.
  `BEGIN`, the row `SELECT … FOR UPDATE` while it is damaged or wrong and
  not returned, the `UPDATE` with who and when, `COMMIT`, then the reply. A
  row that isn't there, is another shop's, is missing, or was already
  returned is 404 (two presses at once: one marks it, the other is 404).
  Stock doesn't change: the item was never added to it.

## 3. The screen

Stockroom › Deliveries and orders, for the Owner, as drawn in `rs-hub`:

- After "A delivery arrived?" and before Orders, a card per supplier,
  "To return to [Supplier]", only when it has something on it.
- Each item: the product's name, then "Damaged · 1 · from the delivery on
  Tue 1 Sep" (or "Wrong item"), and "Returned" (aria-label
  "Returned: [Product], damaged").
- Returned marks it at once and the list is read again; the item leaves the
  list and the card goes when it's empty. A refusal shows in the card.
- Staff see the hub as now.

## 4. Gaps the drawings leave

Logged in Jack's section of `decided-while-building.md`: items with no
supplier; one line per problem rather than summed; Returned with no
confirmation or Undo; the date's form.
