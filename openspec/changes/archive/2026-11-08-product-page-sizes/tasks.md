# Tasks

Each pull request: tests first, each watched failing for the right reason; `npm run lint`, `npm test` and `npm run test:browser` pass locally after merging main; a self-review, and `/review` with a hand-run CI where it's risky.

## 1. Price and cost changes in the history (pull request 1; migration, money)

- [x] 1.1 Tests: a price and a cost saved on a product, and a size's price saved, each write one change with was, now and who; a save that changes neither writes none; adding writes none; the Owner's `GET /api/products/:id` history has them newest first among the stock lines; Jo's has none; another business's never show.
- [x] 1.2 Migration 122 `product_price_changes`, with the business's own rows; `server/lib/price-changes.js`; `PUT /api/products/:id` and `PUT /api/product-groups/:id` call it; `GET /api/products/:id` sends them to the Owner.
- [x] 1.3 The product page shows "Price changed · £28.00 → £[price]" and "Cost changed · £[cost] → £[cost]", and the Price changes pill when there is one.

## 2. A product's page: Edit and details (pull request 2; money)

- [x] 2.1 Screen tests: Edit for the Owner only; the box filled; a price typed in pounds sent in pence; a cost left blank not sent; the category's details shown and saved after the product; the server's words kept in the box; the Details box with its answers.
- [x] 2.2 `product-box.tsx` and the page's Edit and Details · [Category].
- [x] 2.3 A browser test: the Owner changes the brake pads' price and sees it, and its history line.

## 3. A product with sizes' page (pull request 3)

- [x] 3.1 Tests: `GET /api/product-groups/:id` gains stock at each shop, its sizes' history with size and colour, price changes for the Owner only; the screen's grid, a cell opening its size, below zero warned, Add a size or colour sending one new size, Edit sending name and category; the list's row opening the page.
- [x] 3.2 The server's additions; `sizes-page.tsx`; its route; the list's row as a link.

## 4. Adding a product (pull request 4)

- [x] 4.1 Screen tests: "+ Add a product" for the Owner, not staff; "+ Add “[typed]” as a product" filling the name; adding opens its page; on receiving, an unknown barcode offers the Owner Add this product, and Add and count 1 puts it on the delivery as 1; staff are told as before.
- [x] 4.2 Stock's buttons and the receiving box.

## 5. Cost went up? Change it (pull request 5; money)

- [x] 5.1 Tests: the Owner's change moves the line, the product's cost and its history together; the same cost changes nothing; Jo is refused; a line of another delivery, or one that isn't there, is not found; another business's delivery can't be reached.
- [x] 5.2 `PUT /api/deliveries/booked-in/:id/lines/:lineId/cost`; the delivery page's Change cost and its box.
- [x] 5.3 Log every gap in Jack's section of `decided-while-building.md`; `/opsx:archive` as the last commit.
