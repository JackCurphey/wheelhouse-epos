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
   line. The claim on the event (`claimShopifyEvent`) stays outside, as
   before, and a failure still marks it `error`.
3. **Rows in product id order** (found in self-review, 28 Oct). Before, each
   line's write committed on its own, so the refund never held two rows at
   once. In one transaction it does, so it now takes them in product id
   order, as a sale (`server/lib/sales.js`), receiving and till sync already
   do. Otherwise a two-line refund and a two-line sale could each hold one
   row and wait for the other's: Postgres ends one as a deadlock, and a
   failed refund is already claimed, so Shopify's retry would be dropped.
4. **The Shopify push uses the returned figure, after COMMIT.** It used to
   send `<what it read> + qty`, which was stale for the same reason. It now
   sends the `RETURNING stock_qty` value, and only once the transaction has
   ended, so a Shopify call (up to about 15 s with retries) never holds the
   product's row lock. It still runs before the webhook replies, as it did.

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
