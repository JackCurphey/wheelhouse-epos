# Tasks

- [x] 1.1 Tests first (`tests/shopify-refund-stock.test.js`): a refund puts its stock back with its history line; a race test that holds the product's row on a second connection, takes three off there, lets the refund reach its write, then commits, and expects both changes to survive. Watch the race test fail (21, not 18)
- [x] 1.2 The refund webhook writes `stock_qty = stock_qty + ?` in one transaction with its history lines, and pushes the returned figure to Shopify after `COMMIT`
- [x] 1.3 Break the fix on purpose (back to the absolute write), confirm the race test goes red for that reason, restore it
- [x] 1.3a Self-review: one transaction holds several rows, so a two-line refund could deadlock with a sale. Test first (a refund listing the higher id first, while another transaction holds the lower then takes the higher), watched failing (Postgres deadlock, 500); the refund takes rows in product id order; removing the sort turns it red again
- [x] 1.4 Search `server/` for every absolute `stock_qty` write; record what was left and why in `design.md`
- [x] 1.5 The touched tests, the Shopify tests, sales-concurrency, `npm test`, lint and `tsc`
- [ ] 1.6 Self-review and `/review` (server.js, stock); CI by hand on the branch; archive as the last commit
  - [x] /review 28 Oct: nothing blocking; fixes done (tasks 2.1 to 2.5)
  - [x] Second /review 28 Oct: nothing serious; fixes done (tasks 3.1 to 3.4)
  - [ ] CI by hand on the branch
  - [ ] Archive as the last commit

## 2. Fixes from /review, 28 Oct

- [x] 2.1 The claim on a refund is the first statement of its transaction, so a failed refund is applied when Shopify retries it; the failure is recorded after the rollback, keeping an earlier error record. Tests first: a refund that fails partway (its second product at the column's largest number) changes nothing and is applied on retry, watched failing (retry dropped, 5 not 6); the same refund twice, and twice at once, counts once. Breaks: the claim back outside (red: the failure stays `ok`, retry dropped); a claim that retakes any row (red: 22 not 21, both duplicate tests)
- [x] 2.2 `no_restock` lines leave stock alone, from Shopify's docs (`refunds/create` sample payload; Refund resource). Test watched failing (6 not 5); removing the skip turns it red again
- [x] 2.3 The figure sent to Shopify, with Shopify faked in the server (`tests/helpers/fake-shopify-fetch.js`), is the stock after the race: 18. It passed first, since 1.2 already sent the returned figure; sending the stale figure turns it red (21)
- [x] 2.4 The refund's rollback is `.catch(() => {})`
- [x] 2.5 Logged for Jack in `decided-while-building.md`, not changed: importing a supplier item starts its stock with no history line
- [x] 2.6 The touched tests, the Shopify tests, sales-concurrency, `npm test`, `npm run test:browser`, lint and `tsc`

## 3. Fixes from the second /review, 28 Oct

- [x] 3.1 Error records this change writes start "Rolled back, safe to retry: " (`ROLLED_BACK_ERROR_PREFIX`), and only those are claimed again; an old unmarked 'error' row (main's handler could fail after applying part of a refund) stays taken, as on main, and a later error record never marks it. No migration. Test watched failing (old row taken again, 6 not 5). Breaks: the claim without the mark (red, 6 not 5); the error record marking an old row (red)
- [x] 3.2 The push's own database scope failing (the pool full) is logged and the webhook still answers 200, as a failed push already did (`pushStockToShopify`, `server/shopify.js`). Test watched failing (the error was thrown); removing the catch turns it red again
- [x] 3.3 Tests: two retries of a failed refund at the same moment apply once; an error record after the refund went through leaves it 'ok'. Both passed first (they guard the claim and the record's conditions); breaks turn them red (7 not 6; 'ok' given a message)
- [x] 3.4 The touched tests, the Shopify tests, `npm test`, lint and `tsc`
