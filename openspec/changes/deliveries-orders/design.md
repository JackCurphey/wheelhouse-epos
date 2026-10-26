# Design: purchase orders and the Deliveries page

## Contract (server, `server/routes/purchase-orders.js`)

Unchanged routes, one new field, and the Owner-only check:

- `GET /api/purchase-orders` and `GET /api/purchase-orders/:id`: any signed-in
  staff member. Each order now also has `totalCost`: the sum of each line's
  `qtyOrdered × unitCost`, in pounds as stored (`unit_cost` is
  `NUMERIC(10,2)`), rounded to the penny. Nothing is converted to pence.
- `POST /api/purchase-orders` (`{ supplierId, items: [{ productId, qty, unitCost }] }`),
  `PUT /api/purchase-orders/:id`, `POST /api/purchase-orders/:id/mark-ordered`
  and `POST /api/purchase-orders/:id/cancel`: the Owner only. Anyone else gets
  403 `{ code: 'owner_only', error: "Only the shop's owner can order stock" }`
  before any lookup.
- After the review (26 Oct): `POST /api/purchase-orders` also takes
  `markOrdered: true`, which makes the order already ordered in the same
  transaction (New order's "Mark as ordered" is one request). Mark-ordered
  and cancel check the status in the `UPDATE` itself and answer 409 when
  nothing changed (mark-ordered: not a draft; cancel: already cancelled, or
  something booked in). Cancel changes only a draft or an ordered order
  (`status IN ('draft', 'ordered')`) with no line booked in. The status is
  what holds when a receipt is booked in at the same moment: the receipt
  changes the order's row, so the cancel waits for it and re-checks the
  status on the new row, where a check on the lines alone would be re-run
  against the old snapshot (second review, 26 Oct). A line over 100000, or
  a unit cost over 99999999.99, is a 400.
- `POST /api/purchase-orders/:id/receive` stays open to everyone (decision 4:
  everyone can receive), and goes on the owner-only test's allow-list.
- `GET /api/suppliers` and `GET /api/products?search=` are read as they are.

`ownerOnly(req, res, message)` takes an optional refusal message; the default
is still the settings one.

## Decisions

1. **Routes.** `deliveries` is `/workshop/deliveries` (the hub);
   `rs-order` is `/workshop/deliveries/new-order`; `rs-order-ordered` is
   `/workshop/deliveries/orders/:id`. The header keeps "Deliveries and
   orders" on the sub-pages, as a customer's page keeps "Customers"; each
   sub-page has the drawn "← Deliveries and orders" link and its own heading.
2. **The hub** (`src/screens/deliveries/deliveries-page.tsx`):
   - the Owner sees Orders: open orders only (draft, ordered, partly
     delivered), newest first; each row "[Supplier] · [n] lines", "Ordered
     [date] · [n] still to come" or "Draft · not ordered yet", a grey tag
     ("Draft", "Ordered", "Partly delivered") and Open; "+ New order" on the
     section; the drawn empty note when there are none;
   - anyone else sees the page without Orders (decision 4), with a line
     saying orders are for the shop's owner.
3. **New order** (`new-order.tsx`):
   - suppliers as pills (`PillGroup`), the most recently ordered from
     first, then by name; the first three, then "Other…" shows the rest;
     the first is picked;
   - the search box finds products by name, code or barcode
     (`/api/products?search=`); Enter adds an exact barcode or code match,
     or the only match; a click adds any match; adding a product already
     on the order adds one to its count;
   - a line's cost is its count × the product's cost; the total is their
     sum, worked out in whole pence on the screen so it doesn't drift, and
     shown in pounds. Once saved, the order page shows the server's
     `totalCost`;
   - "Save as draft" makes the order; "Mark as ordered" makes it already
     ordered, in one request; both open the order page;
   - a line with no cost (none recorded, or 0 as the old app saves it)
     shows "No cost recorded" and a box to type one; "Mark as ordered"
     waits until every line has a cost, a draft saves without; a count
     stops at 100000 (after the review, 26 Oct).
4. **An order** (`order-page.tsx`):
   - heading "[Supplier] · ordered [date]" (a draft: "[Supplier] · draft");
     the status tag; each line "[code] · ordered [n] · arrived [n]" with
     "All arrived" or "[n] to come";
   - the Owner sees "Mark as ordered" on a draft, and "Close the order"
     while nothing has arrived; Close always asks first ("Close the
     order?", "[Supplier] · ordered [date] · [n] still to come", "Closing
     drops everything still to come on this order.", Keep it open / Close
     the order), then cancels it on the server;
   - an order that has partly arrived has no Close: the server refuses,
     and closing one needs a write that drops what's still to come
     (reported, not built).
5. **The restock list is left out.** It needs, from Jack: what "selling
   fast" means and over how many days; what count to suggest; the
   basket file's format; how a product's supplier (a typed name today)
   matches a supplier; and where "For customers" comes from (job lines on
   order, walk-through 3 M7, not built).
6. **Phone.** Rows and lines wrap; a line's cost and Remove move under the
   count on a phone, as the drawing drops them from the row.
