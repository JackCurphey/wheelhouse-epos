# Tasks

Each test written first and watched failing for the right reason; each rule broken on purpose, with the break confirmed landed.

## 1. First pull request: the server, and sizes on the list

- [x] 1.1 Server tests: answers only when a category is picked or a measurement searched (`tests/product-details.test.js`); each row's VAT rate, a product with sizes' only when shared (`tests/sizes-and-colours.test.js`)
- [x] 1.2 `server/routes/stock-list.js`
- [x] 1.3 Screen tests: the list on `/api/stock-list`; a product with sizes' row, price range, margin and pills; a size's row (`tests/screens/stock-list.test.js`)
- [x] 1.4 The list's rows (`src/screens/stock/stock-page.tsx`, `stock-bits.tsx`)

## 2. Second pull request: categories on the list

- [ ] 2.1 Screen tests: the Category pill by keyboard; details as filters and columns; the summary; a measurement's line (`tests/screens/stock-list-categories.test.js`)
- [ ] 2.2 The pill, filters, columns and line (`src/screens/stock/stock-list-bits.tsx`, `stock-page.tsx`)
- [ ] 2.3 Browser test: picking Bearings and an outer diameter by keyboard; a size searched; computer and phone widths (`tests/browser/stock-list.spec.ts`)
- [ ] 2.4 Where the drawings are silent, logged in `docs/decisions/decided-while-building.md`
- [ ] 2.5 Tick piece 9 in `openspec/changes/wp-1-5-products/tasks.md`
