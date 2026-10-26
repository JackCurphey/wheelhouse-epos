# Design: receiving a delivery

## Contract (server, `server/routes/purchase-orders.js`)

`POST /api/purchase-orders/:id/receive`, open to everyone signed in (on the
owner-only test's allow-list, as before). Body, additive:

- `items: [{ itemId, qtyReceived }]`, as before: added to stock and to the
  line's `qty_received`.
- `problems: [{ itemId, kind, qty, note }]`, new: `kind` is `damaged`,
  `wrong_item` or `missing`; `qty` a whole number above 0; `note` optional
  (trimmed, up to 500 characters). Recorded in `delivery_problems`; nothing
  goes into stock or `qty_received`.

For each line, `qtyReceived` plus its problems' `qty` must not be more than
is still to come (`qty_ordered − qty_received`), else 400 with
`Cannot receive [n] of "[name]" - only [n] outstanding`. A body with no
quantities and no problems is 400 as before. The reply is the order, as
before.

**Atomic and counted once:** everything runs in one transaction that starts
by locking the order (`SELECT … FOR UPDATE`), then reads its status and
lines and checks them, so a second booking of the same order waits and then
sees the first one's counts. Stock is `stock_qty = stock_qty + n …
RETURNING`, never a value read earlier. The order's status becomes
`received` when every line has arrived, `partially_received` when anything
has, and stays as it was when only problems were marked. Shopify pushes
stay after the reply.

## Migration 090: `delivery_problems`

`id`, `shop_id` (row-level security, like every shop table),
`purchase_order_id`, `purchase_order_item_id`, `product_id`, `kind`
(`damaged` | `wrong_item` | `missing`), `qty` (> 0), `note`, `created_at`.
Additive; nothing else changes. To return and Returned read it later.

## Screens

1. **Routes.** `rs-receive` is `/workshop/deliveries/receive`;
   `?order=[id]` picks that order. "Receive a delivery" on the hub (for
   everyone, in "A delivery arrived?") and "Receive against this order" on
   an order still to come (for everyone) open it.
2. **From.** Pills, one per order that's ordered or partly delivered, named
   by its supplier ("[Supplier] · ordered [date]" when a supplier has more
   than one); the newest first, or the one in `?order=`. With none: "No
   orders are waiting for a delivery."
3. **Scan.** The search box finds products as New order does; Enter takes
   an exact barcode or code match, or the only match; a click takes any.
   A product on the order adds one to its scanned line and says "Added
   [name] · 1"; one already all counted says so and adds nothing; one not
   on the order says "[name] isn't on this order"; no match says "Nothing
   in Wheelhouse has the barcode [code]".
4. **A scanned line.** "[name]", "[code] · on your order: [n]" (n still to
   come), a count (1 to n; − at 1 takes the line off) and "Problem?". A
   marked problem adds "Damaged · [n], set aside" (or Wrong item; Missing
   reads "Missing · [n]").
5. **Still to come on the order.** Each line with something not yet
   scanned: "[code] · ordered [n], arrived [n]" and "[n] to come".
6. **Something wrong?** A dialog: "[name] · [code] · [n] scanned"; pills
   Damaged, Wrong item, Missing; How many (up to what's scanned; for
   Missing, up to what's to come and not scanned); Note (optional); the
   drawn note per kind; Cancel and "Mark as damaged" / "Mark as wrong item"
   / "Mark as missing". Damaged and wrong come off what's booked in.
7. **Book in.** "[n] items to book in" (" · [n] set aside") and "Book in
   [n] items"; it sends one receive with the items and the problems; then
   "[n] items booked in · stock updated", the list empties and the order's
   counts refresh.
8. **Phone.** Rows wrap; nothing scrolls sideways.
