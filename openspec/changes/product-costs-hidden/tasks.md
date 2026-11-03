# Tasks

## 1. One pull request, `jack/product-costs-hidden`

- [x] 1.1 Tests first: each route as Staff, the Owner, the Owner's till with nobody checked in and with Jo, and a workshop computer; a save leaves the cost alone, checked in the database; a new order doesn't write £0; the Owner still sees and changes costs (`tests/product-costs-hidden.test.js`); the screens (`tests/screens/product-costs-hidden.test.js`); the old app (`tests/old-app-product-costs.test.js`). Watch each fail
- [x] 1.2 Server: `serializeProduct` hides by default; every route through `canSeeCosts`; `saveProduct`, adding a product and an order's lines
- [x] 1.3 Screens: Stock, a product's page, New order, stock take, Today; the reset when the person changes; the old app
- [x] 1.4 Break each rule on purpose, see its test go red, and restore
- [x] 1.5 Log choices in Jack's section of `decided-while-building.md`; lint, `npm test`, `npm run test:browser`, the drawing check; self-review (`/review`, for this risky area, is still to run before merging)
- [x] 1.6 `/opsx:archive` as the last commit
