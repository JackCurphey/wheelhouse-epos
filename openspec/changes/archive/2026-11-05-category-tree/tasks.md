# Tasks

Each test written first and watched failing for the right reason; each rule broken on purpose, with the break confirmed landed.

## 1. First pull request: the tree and its writers

- [x] 1.1 Test: migration 119 from empty, onto two businesses' text under the app role, isolation, and run twice (`tests/migration-119.test.js`)
- [x] 1.2 Migration 119: the three tables, row-level security, keys including the business, the index on a category's products, the tree from existing text
- [x] 1.3 Test: tidying, and every writer finding or making its path (`tests/category-tree.test.js`)
- [x] 1.4 `server/lib/categories.js`; adding and saving a product, the supplier import and the Citrus import use it
- [x] 1.5 Measure 119 on large made-up tables, with a stock write tried throughout; query plans under row-level security
- [x] 1.5a From the review: Uncategorised inside a path; a Citrus row already here makes no category; a count's category of any length; running counts follow tidied text
- [x] 1.5b From the re-check: 119 trims every space the server does, and drops Uncategorised in any case
- [x] 1.6 Piece 3's re-check: design 5's wording; two items for the switcher's list

## 2. Second pull request: Settings › Stockroom › Categories' server

- [x] 2.1 Test: list, add, Save with details, rename, move, refusals, Owner only, isolation, busy (`tests/product-categories-routes.test.js`)
- [x] 2.2 `server/routes/product-categories.js`; the route snapshot
- [x] 2.2a From the review: starting a count holds its category; moving checks details against the new place; race tests for both holds, each watched red
- [x] 2.3 Measure renaming a category with many products
- [x] 2.4 Log in `docs/decisions/decided-while-building.md`
- [x] 2.5 Full runs; self-review; archive as the top pull request's last commit
