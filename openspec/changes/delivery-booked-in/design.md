# Design: A delivery, once it's booked in

## 1. Migration 110

Additive, safe to run twice, and both new tables have row-level security like
`delivery_problems` (092).

- `deliveries`: `id`, `shop_id`, `supplier_id` (null when none was picked),
  `booked_by_login_id` (null if the sign-in can't be told), `booked_in_at`.
- `delivery_lines`: `id`, `shop_id`, `delivery_id`, `product_id`,
  `purchase_order_id` and `purchase_order_item_id` (null when not on an
  order), `qty` above 0, `unit_cost`.
- `delivery_problems` gains `delivery_id` and `unit_cost`, null for anything
  set aside before 110.

A line's cost is what it cost then: the order line's `unit_cost`, or the
product's `cost` when it's not on an order. It is copied, because either can
change later.

## 2. Writing it

`bookIn` (both receive routes) writes the delivery inside its existing
transaction. No new lock order: the `deliveries` row is new, so nothing else
can hold it; each `delivery_lines` row is written straight after the product's
stock update, in the same product-id order. Stock, order counts and refusals
are untouched, and a refused booking rolls the delivery back with everything
else. The reply is still sent after COMMIT.

A booking with only Missing marked (possible on the old app's route) records
no delivery: nothing arrived.

A delivery's supplier is the one picked; on the old app's order route, the
order's. If Receive a delivery ever books in with no supplier picked, it stays
none.

## 3. The contract

Both are open to anyone signed in (receiving decision 4: everyone receives).

- `POST /api/deliveries/receive` → as before, plus `deliveryId`.
- `GET /api/deliveries` → `{ deliveries: [{ id, supplierName, items, bookedInAt, bookedBy }] }`,
  the newest 10. `items` is how many were booked in.
- `GET /api/deliveries/booked-in/:id` → `{ id, supplierId, supplierName, items, bookedInAt, bookedBy, lines, setAside, stillToCome }`,
  404 for a bad id or another shop's.
  - `lines`: `[{ id, productId, name, sku, qty }]`, in the order they were
    booked in.
  - `setAside`: `[{ id, name, kind, qty, returned }]`, damaged and wrong items
    only; Missing never arrived.
  - `stillToCome`: `[{ orderId, supplierName, orderedAt, qty }]`, read live
    from the delivery's orders, those with anything left to come.
  - **The Owner also gets** `bookedCost`, each line's `unitCost` and `lineCost`,
    and each set-aside item's `cost`. Anyone else's reply doesn't contain them
    at all (audit M12).

Amounts are pounds, as products and orders store them, totalled in whole pence
so floating-point sums don't show (as `totalCost`).

## 4. The screens

- `rs-delivery`: `/workshop/deliveries/delivery/:id`; `rs-booked`: the same with
  `/booked` on the end. Both read `GET /api/deliveries/booked-in/:id`, so a reload of the
  booked page keeps working.
- Book in goes to `rs-booked`, replacing the scanning page's old line. The list
  of deliveries and To return are refreshed (`['deliveries']`).
- `rs-booked` for the Owner links See the list (the hub) and Open the order.
  For anyone else: "[n] set aside as damaged — the owner will return it", "It
  isn't in stock", and no order link, as drawn.
- `rs-hub`: Recent deliveries last, for everyone, only when there is one.
- Delivery booked in stays under the frame's "Deliveries and orders" title, as
  every sub-page does (Receive a delivery, an order).
