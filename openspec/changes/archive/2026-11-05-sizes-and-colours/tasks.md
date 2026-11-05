# Tasks

Each test written first and watched failing for the right reason; each rule broken on purpose, with the break confirmed landed.

## 1. First pull request: groups, the list and a group's page

- [x] 1.1 Test: migration 120 from empty, onto populated, under the app role, isolation, its rules, run twice (`tests/migration-120.test.js`)
- [x] 1.2 Migration 120: `product_groups`, `products.group_id`, `size`, `colour`
- [x] 1.3 Test: the list, search, a group's page, costs, isolation, each size still a product (`tests/sizes-and-colours.test.js`)
- [x] 1.4 `server/routes/stock-list.js`; `/api/products` says a row's group, size and colour; the route snapshot
- [x] 1.5 Measure 120 at 1,000,000 products and the list at 100,000

## 2. Second pull request: a size on a count's line

- [x] 2.1 Test: every count list names a size, the download's columns (`tests/stock-take-sizes.test.js`); screen tests for the counting page and the check
- [x] 2.2 The count's queries and screens
- [x] 2.3 Log in `docs/decisions/decided-while-building.md`
- [x] 2.4 Full runs; self-review; archive as the top pull request's last commit
