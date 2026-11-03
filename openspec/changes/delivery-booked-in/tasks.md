# Tasks

## 1. Server (`jack/delivery-booked-in`)

- [x] 1.1 Tests first: migration 110 from empty and run twice (`tests/migration-110.test.js`); the routes (`tests/deliveries-booked-in.test.js`): both receive routes keep a delivery; a refusal keeps none; lines' costs copied; a set-aside item on the record; only Missing keeps none; the Owner's costs and nobody else's; still to come; 404s; another shop's; newest 10. Watch each fail
- [x] 1.2 Migration 110, `bookIn` writes the record, the two routes
- [x] 1.3 The route list snapshot

## 2. Screens (same pull request)

- [x] 2.1 Tests first: Book in lands on Delivery booked in, as Owner and as Staff; a delivery with and without costs; Recent deliveries; a load that fails (`tests/screens/delivery-booked-in.test.js`); update the receive tests and browser spec. Watch each fail
- [x] 2.2 Build `rs-booked`, `rs-delivery`, Recent deliveries on `rs-hub`
- [x] 2.3 Break each key rule on purpose, see its test go red, and restore
- [x] 2.4 Log choices in Jack's section of `decided-while-building.md`; lint, `npm test`, `npm run test:browser`; self-review against the drawings and this spec
- [x] 2.5 `/opsx:archive` as the last commit
