# Design: a Shopify refund never undoes another stock change

1. **A relative write, not a lock.** The refund only adds stock, so it needs
   no check against the current figure. `UPDATE products SET stock_qty =
   stock_qty + ? … RETURNING stock_qty` is one statement: Postgres applies it
   to the row as it is when the write runs, waiting for any other transaction
   holding the row. No `SELECT … FOR UPDATE` is needed. This is the pattern of
   adjust stock (`server/routes/products.js`, `POST /api/products/:id/stock`)
   and receiving (`server/routes/purchase-orders.js`).
2. **One transaction for the stock and its history.** `BEGIN`, then for each
   refunded line the update and its `stock_movements` line (`type 'return'`,
   note `Shopify refund #<id>`), then `COMMIT`; any failure rolls back every
   line. The rollback's own failure is swallowed (`.catch(() => {})`) so it
   never hides the error that caused it.
3. **Rows in product id order** (found in self-review, 28 Oct). Before, each
   line's write committed on its own, so the refund never held two rows at
   once. In one transaction it does, so it now takes them in product id
   order, as a sale (`server/lib/sales.js`), receiving and till sync already
   do. Otherwise a two-line refund and a two-line sale could each hold one
   row and wait for the other's, and Postgres would end one as a deadlock.
4. **The Shopify push uses the returned figure, after COMMIT.** It used to
   send `<what it read> + qty`, which was stale for the same reason. It now
   sends the `RETURNING stock_qty` value, from its own database scope once
   the refund's has committed (in either tenant mode), so a Shopify call (up
   to about 15 s with retries) never holds the product's row lock. It still
   runs before the webhook replies, as it did. That step
   (`pushStockToShopify`, `server/shopify.js`) never fails the webhook
   (second /review, 28 Oct): the stock has committed, so a 500 would only have
   Shopify retry a refund that is done and then be told so, and the push
   would never go. A failed push was already logged; now a scope that can't
   open (the pool full for 5 s) is logged too, and the webhook answers 200.
5. **The claim is inside the transaction** (/review, 28 Oct). The claim on
   the event used to commit on its own before the work, so a refund that
   failed partway stayed claimed and Shopify's retry was dropped as already
   done. It is now the transaction's first statement
   (`claimShopifyEventInTransaction`, `server/shopify.js`): a rollback takes it
   too, and the retry applies the refund.
   - **Duplicates.** The claim is an insert on the one-per-event unique key.
     A second delivery arriving while the first is in its transaction waits
     on that key; when the first commits it is told the event is taken, and
     changes nothing. A delivery after a commit is told the same at once.
   - **The error record.** After the rollback, the failure is recorded in a
     fresh database scope (`recordShopifyEventError`) as `status 'error'`
     with the message, as before, so it survives in either tenant mode. Its
     message starts "Rolled back, safe to retry: "
     (`ROLLED_BACK_ERROR_PREFIX`). It updates only an earlier record of its
     own (marked) kind, and never an `ok` row, a delivery that went through.
     A marked `error` row does not block: the next delivery's claim takes it
     back to `ok`.
   - **Old error rows stay taken** (second /review, 28 Oct). On main the
     claim committed first and a refund's lines were written one by one, so
     a failure could leave part of a refund applied with an `error` row.
     Taking such a row again would apply that part twice. So only marked rows
     are claimed again; an unmarked `error` row written before this change
     stays taken, exactly as on main, and a later error record never marks
     it. A prefix in `error_message` instead of a new column: no migration.
   - **Orders are unchanged.** The order webhook keeps `claimShopifyEvent`
     outside `createSale`'s transaction; it isn't part of this change.
6. **`no_restock` lines are skipped** (/review, 28 Oct). Shopify's
   `refunds/create` payload has `refund_line_items[].restock_type` (sample
   payload, shopify.dev webhooks reference), and the Refund resource says
   `no_restock` means "Refunding these items won't affect inventory".
   `matchRefundLineItemsToProducts` leaves those lines out, so no stock and no
   history line. `return`, `cancel`, `legacy_restock` or no value at all are
   put back as before.

## Tests

`tests/shopify-refund-stock.test.js` drives the real webhook on a spawned
server, signed as Shopify signs it. Shopify itself is faked inside that server
by `tests/helpers/fake-shopify-fetch.js` (loaded with `NODE_OPTIONS=--import`),
which answers requests to `*.fake-shopify.invalid` and writes each one to
stderr, so the test reads the figure that was sent.

## Every absolute `stock_qty` write in `server/`, looked at

Searched `server/` for `stock_qty =` and `stock_qty = ?`, and read every
`stock_qty` reference outside the migrations:

- `server/server.js`, the refund webhook: the lost update. Fixed here.
- `server/suppliers/index.js` (`runSync`): `stock_qty = EXCLUDED.stock_qty`.
  **Left absolute on purpose.** It is a full sync: it writes
  `supplier_catalogue_items`, the supplier's own stock figure copied from
  their feed, not the shop's `products`. Each sync replaces the figure with
  the supplier's latest; nothing else in Wheelhouse changes that column, so
  there is no other change for it to lose.
- `server/routes/products.js` (adjust stock), `server/routes/purchase-orders.js`
  (receive), `server/lib/sales.js` (a sale) and `server/till/sync.js` (an
  offline till's sales): already relative.
- `INSERT INTO products … stock_qty` (`server/routes/products.js` adding a
  product, `server/routes/suppliers.js` adding one from a supplier): a new
  row's first figure, so nothing to overwrite.

Other Shopify paths: the order webhook goes through `createSale` (relative);
`syncProductToShopify` and `pushInventoryLevel` (`server/shopify.js`) only send
stock to Shopify and never write `stock_qty`. Wheelhouse has no
Shopify-to-Wheelhouse stock sync.
