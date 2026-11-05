# Tasks

Each test written first and watched failing for the right reason; each rule broken on purpose, with the break confirmed landed.

## 1. First pull request: the data and `moveStock`

- [x] 1.1 Test: migrations 117 and 118 from empty, onto three businesses' stock under the app role, and run twice (`tests/migration-117.test.js`)
- [x] 1.2 Migration 117: `product_stock` with row-level security and keys including the business; a first shop for every business without one; existing stock to the oldest; `stock_takes.site_id`
- [x] 1.3 Migration 118: older lines' shop, on its own
- [x] 1.4 Test: first shop, each shop's figure and the total together, refusals, moves at once, isolation (`tests/stock-per-shop.test.js`)
- [x] 1.5 `moveStock` writes both; `neverBelowZero: 'here'`; a first shop made if none; `createShop` makes one
- [x] 1.6 The check that nothing else writes stock also covers `product_stock`
- [x] 1.7 Measure both migrations on large made-up tables, with a sale and a read tried throughout; query plans under row-level security (design 5)

- [x] 1.8 From the independent review: renaming the business renames the shop named after it; a Citrus Fix goes to the oldest shop; the check also sees `TRUNCATE`, `MERGE` and `ON CONFLICT DO UPDATE`; the key for links is `(id, shop_id)`

## 2. Second pull request: the count, Adjust and the screens

- [x] 2.1 Test: a count is one shop's, through its routes (`tests/stock-per-shop-routes.test.js`)
- [x] 2.2 `stock_takes.site_id` set at the start; expected, allowed-for, not counted, Apply and Undo use it
- [x] 2.3 Test and build: Adjust at this shop's figure; the product's page says each shop's
- [x] 2.4 Screen tests first: In stock lists each shop, "[n] each"; Adjust's figure is this shop's; Till setup's first shop; a till or workshop computer named after the business says it once
- [x] 2.5 Remove "This business has no shops"
- [x] 2.5a A count reads its products' figures on their own, not by a join
- [x] 2.6 Log in `docs/decisions/decided-while-building.md`
- [x] 2.7 Full runs; self-review; archive as the top pull request's last commit
