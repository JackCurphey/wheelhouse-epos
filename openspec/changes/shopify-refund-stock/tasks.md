# Tasks

- [x] 1.1 Tests first (`tests/shopify-refund-stock.test.js`): a refund puts its stock back with its history line; a race test that holds the product's row on a second connection, takes three off there, lets the refund reach its write, then commits, and expects both changes to survive. Watch the race test fail (21, not 18)
- [x] 1.2 The refund webhook writes `stock_qty = stock_qty + ?` in one transaction with its history lines, and pushes the returned figure to Shopify after `COMMIT`
- [x] 1.3 Break the fix on purpose (back to the absolute write), confirm the race test goes red for that reason, restore it
- [x] 1.3a Self-review: one transaction holds several rows, so a two-line refund could deadlock with a sale. Test first (a refund listing the higher id first, while another transaction holds the lower then takes the higher), watched failing (Postgres deadlock, 500); the refund takes rows in product id order; removing the sort turns it red again
- [x] 1.4 Search `server/` for every absolute `stock_qty` write; record what was left and why in `design.md`
- [ ] 1.5 The touched tests, the Shopify tests, sales-concurrency, `npm test`, lint and `tsc`
- [ ] 1.6 Self-review and `/review` (server.js, stock); CI by hand on the branch; archive as the last commit
