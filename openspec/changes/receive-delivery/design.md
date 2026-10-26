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

What's still to come on a line, the order's `outstanding`, is
`qty_ordered − qty_received − set aside`, where set aside is the line's
damaged and wrong items recorded in any delivery (decision 9: they go on To
return, not back to "to come"; a replacement is a new line or a new order).
Missing items aren't set aside and stay to come. For each line,
`qtyReceived` plus its problems' `qty` must not be more than is still to
come, else 400 with `Cannot receive [n] of "[name]" - only [n]
outstanding`, so received plus set aside never passes what was ordered
(second review, 26 Oct). A body with no
quantities and no problems is 400 as before. The reply is the order, as
before.

**Atomic and counted once:** everything runs in one transaction that starts
by locking the order (`SELECT … FOR UPDATE`), then reads its status and
lines and checks them, so a second booking of the same order waits and then
sees the first one's counts, problems included. Stock is `stock_qty =
stock_qty + n … RETURNING`, never a value read earlier, and the lines are
updated in product order, as a sale locks its products, so two bookings
with the same products in another order can't deadlock. The order's status
becomes `received` when nothing is left to come on any line (booked in or
set aside), `partially_received` when anything is in stock, and otherwise
stays as it was (only problems marked, nothing in stock). Shopify pushes
stay after the reply.

Cancel (deliveries-orders) changes only a draft or ordered order, and a
receipt changes the order's row in its transaction, so a close at the same
moment waits and is then refused.

## Migration 090: `delivery_problems`

`id`, `shop_id` (row-level security, like every shop table),
`purchase_order_id`, `purchase_order_item_id`, `product_id`, `kind`
(`damaged` | `wrong_item` | `missing`), `qty` (> 0), `note`, `created_at`.
Additive; nothing else changes. A line's damaged and wrong rows are summed
into its set-aside count; To return and Returned read it later.

## Screens

1. **Routes.** `rs-receive` is `/workshop/deliveries/receive`;
   `?order=[id]` picks that order. "Receive a delivery" on the hub (for
   everyone, in "A delivery arrived?") and "Receive against this order" on
   an order still to come (for everyone) open it.
2. **From.** Pills, one per order that's ordered or partly delivered, named
   by its supplier ("[Supplier] · ordered [date]" when a supplier has more
   than one); the newest first, or the one in `?order=`. With none: "No
   orders are waiting for a delivery." When the order asked for isn't
   waiting (all in, or `?order=` names a draft or a received one), "This
   order is all in." and nothing is picked until the person chooses; after
   booking in, the page stays on that order.
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
   / "Mark as missing". Damaged and wrong come off what's booked in. A kind
   already marked opens on its count and note, and − at 1 takes it off (an
   undo, with the controls already there).
7. **Book in.** "[n] items to book in" (" · [n] set aside") and "Book in
   [n] items"; it sends one receive with the items and the problems; then
   "[n] items booked in · stock updated", the list empties and the order's
   counts refresh. A refused booking says why, keeps the list and refreshes
   the orders too.
8. **Phone.** Rows wrap; nothing scrolls sideways.
