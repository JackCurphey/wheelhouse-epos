# Design: close an order that has partly arrived

Line numbers are main's (8c415c9e) before this change.

1. **How "not coming" is stored: a status, nothing per line.** A partly
   delivered order that is closed gets status `closed`; its lines keep
   `qty_received` as it is. "Not coming" is worked out, not stored: on a
   `closed` or `cancelled` order a line's still to come is 0, and its not
   coming is what would have been to come (ordered − arrived − set aside as
   damaged or wrong, never below 0). Nothing that arrived is changed, so the
   stock movements and the line's arrived count are the history. Considered
   and not taken: a `qty_not_coming` column per line (a migration, and a
   second number that must agree with the first for ever); setting
   `qty_ordered` down to what arrived (rewrites what was ordered, and the
   order's total cost with it).
2. **Why `closed` and not `cancelled`.** `cancelled` keeps meaning "closed
   with nothing in", as before, so its words and tests stand; `closed` says
   something arrived. Neither is open (`isOpen` on the screen, the
   `ordered`/`partially_received` check in `bookIn`), and both show "Closed"
   (`STATUS` in `deliveries-bits.tsx` already showed `cancelled` as "Closed").
   `status` is TEXT with no check on its values
   (`server/migrations/007_purchase_orders.sql:17`), so no migration.
3. **The close** (`server/routes/purchase-orders.js:404`). One `UPDATE`, as
   before, with the decision in it:
   `SET status = CASE WHEN status = 'partially_received' THEN 'closed' ELSE 'cancelled' END`
   `WHERE id = ? AND (status = 'partially_received' OR (status IN ('draft', 'ordered') AND NOT EXISTS (… qty_received > 0)))`.
   The `NOT EXISTS` stays for the `cancelled` branch only (an order marked
   ordered with lines booked behind its back is still refused, as the
   existing test checks). Refusals: `cancelled` → "This purchase order is
   already cancelled" (unchanged); `closed` → "This purchase order is
   already closed"; `received` → "Everything on this purchase order has
   arrived"; anything else keeps "This purchase order already has items
   booked in and cannot be cancelled".
4. **Race-safe against booking in.** Booking in (`bookIn`, `:152`) locks each
   order row `FOR UPDATE` first and refuses any status but `ordered` and
   `partially_received` (`:163-165`); the close's `UPDATE` takes the same
   row lock.
   - *Close while a booking is open:* the `UPDATE` waits on the row; under
     READ COMMITTED Postgres then re-checks the `WHERE` and works out the
     `CASE` on the row the booking committed. A booking that made the order
     `partially_received` is closed to `closed` with its count kept; one that
     made it `received` is refused. The status decides, because the status
     is on the locked row; the lines' `NOT EXISTS` alone would be re-run on
     the old snapshot (the 26 Oct second review's finding, kept).
   - *Booking while a close is open:* the booking's `SELECT … FOR UPDATE`
     waits, then reads `closed` and is refused before any line or product is
     touched.
   - Mistakes this rules out, each tried on purpose in the tests: deciding on
     a status read before the `UPDATE` (a close during a booking would be
     refused); a booking that doesn't lock the order (it would write
     `partially_received` over `closed` and add the stock).
5. **What the server sends.** `serializePurchaseOrder` (`:31`) sends, per
   line, `outstanding` (0 on a closed or cancelled order) and a new
   `notComing` (0 on any other order). The list and the order route both use
   it, so Deliveries and orders, the order page and Receive a delivery all
   read a closed order as all in.
6. **The screens.**
   - The order page (`src/screens/deliveries/order-page.tsx`): "Close the
     order", its note and its box show for the Owner on every open order
     (they were hidden once anything had arrived), as `rs-order-ordered`
     draws on a partly delivered order. A line with nothing to come and some
     not coming says "[n] not coming" in the grey tag "[n] to come" uses.
     A closed order shows "Closed" and no buttons, as a cancelled one did.
   - Deliveries and orders and Receive a delivery: unchanged code; `closed`
     is neither open nor awaiting, so it leaves the Orders list and "Still to
     come on the order", and `?order=` naming it says "This order is all in.".
   - Logged in `docs/decisions/decided-while-building.md` (Jack's section):
     the "[n] not coming" tag and the new refusal words, since the drawings
     show no closed order.
