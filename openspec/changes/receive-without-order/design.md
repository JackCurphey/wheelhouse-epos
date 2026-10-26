# Design: receiving a delivery without an order

## Contract (server, `server/routes/purchase-orders.js`)

`POST /api/deliveries/receive`, open to everyone signed in (decision 4; on
the owner-only test's allow-list). Body:

- `supplierId`: the supplier picked, or `null`. When given it must exist.
- `items: [{ productId, qty, itemId? }]`: `qty` a whole number above 0. With
  `itemId` the line is an order line, booked in as the order route does
  (stock, the line's `qty_received`, the order's status). Without it the
  product (active) is added to stock, not on an order.
- `problems: [{ kind, qty, note, itemId?, productId? }]`: on an order line
  (`itemId`) `kind` is `damaged`, `wrong_item` or `missing`, as before. Not
  on an order (`productId`, no `itemId`) only `damaged` or `wrong_item`
  (`rs-problem`: Missing is offered only when there's an order); recorded
  with the supplier, no order.

Every order line must be on an order that is still to come (ordered or
partly delivered) from `supplierId`, else 400. What's still to come on a line
is checked as the order route checks it. A body with nothing in it is 400.

Reply: `{ booked: [n], orders: [the orders touched, as GET sends them] }`.

`POST /api/purchase-orders/:id/receive` keeps its body and reply; it now runs
the same code, limited to that order.

**Stock safety, both routes:**
- one transaction; the orders touched are locked (`FOR UPDATE`) in id order
  before their lines are read and checked, so a second booking waits and sees
  the first one's counts;
- stock is `stock_qty = stock_qty + n … RETURNING`, never a value read
  earlier;
- every stock update, order line or not, runs in product-id order, as a sale
  locks its products, so a delivery can't deadlock with the till or another
  delivery;
- a `stock_movements` row per product line, with `login_id` (who booked it
  in): `po_receipt` with the order for an order line; `intake` (the product
  page's "Booked in") with "Delivery from [Supplier], not on an order" (or
  "Delivery, not on an order") otherwise;
- row-level security per shop on every table written.

## Migration 094: who, and problems without an order

Safe to run twice, and in either order with `jack/adjust-stock`'s 093:
- `stock_movements.login_id` (references `logins`), added only when missing
  (093 adds the same column the same way);
- `delivery_problems.purchase_order_id` and `purchase_order_item_id` may be
  empty; `supplier_id` (references `suppliers`) is added, set on every new
  problem; a check keeps the two order columns empty together, and a problem
  without an order damaged or wrong only (dropped and made again).

## Screen (`src/screens/deliveries/receive-page.tsx`)

1. **From**: one pill per supplier, the supplier with the newest order still
   to come first, then by name; three, then "Other…" shows the rest (New
   order's pattern). `?order=` picks that order's supplier and its lines come
   first; otherwise the first pill is picked when it has an order still to
   come, else none ("pick the supplier if you like"). Changing it empties the
   list. No suppliers: "No suppliers yet." and scanning still works.
2. **Scan**: a product with a line still to come on the supplier's orders
   counts against it (`?order=`'s order first, then oldest first), as
   before; one whose lines are all counted says so, as before; any other is
   a line "[code] · not on an order", each scan adding one.
3. **A line not on an order**: its count (no top), "Problem?" with Damaged
   and Wrong item.
4. **Still to come on the order**: every line still to come on the
   supplier's orders; none without a supplier or an order.
5. **This order is all in.** stays for `?order=` naming an order that isn't
   waiting; nothing is picked, and scanning still works.
6. **Book in**: one `POST /api/deliveries/receive`; then "[n] items booked in
   · stock updated" and the orders refresh.
7. **Deliveries and orders**: "Scan each item as it comes out of the box.
   Works with or without an order."
