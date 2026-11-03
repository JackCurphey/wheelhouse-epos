# Tasks

## 1. Server (`jack/delivery-booked-in`)

- [x] 1.1 Tests first: migration 110 from empty and run twice (`tests/migration-110.test.js`); the routes (`tests/deliveries-booked-in.test.js`): both receive routes keep a delivery; a refusal keeps none; lines' costs copied; a set-aside item on the record; only Missing keeps none; the Owner's costs and nobody else's; still to come; 404s; another shop's; newest 10. Watch each fail
- [x] 1.2 Migration 110, `bookIn` writes the record, the two routes
- [x] 1.3 The route list snapshot

## 1a. The independent review, 3 Nov (server, same pull request)

- [x] 1a.1 Tests first, each watched failing (`tests/deliveries-who-and-costs.test.js`, `tests/migration-110.test.js`, `tests/remove-shop.test.js`): who a delivery names on a workshop computer and a till; one request key books once; order costs for the Owner only, on every route and shared computer; old deliveries after a rename; a failure after the stock update takes everything back
- [x] 1a.2 Migration 110 extended; `whoIsBooking`, `replayDelivery`, `canSeeCosts`
- [x] 1a.3 Break each rule on purpose, see its test go red, and restore

## 2. Screens (next pull request)

- [ ] 2.1 Tests first: Book in lands on Delivery booked in, as Owner and as Staff; a delivery with and without costs; Recent deliveries; a load that fails (`tests/screens/delivery-booked-in.test.js`); update the receive tests and browser spec. Watch each fail
- [ ] 2.2 Build `rs-booked`, `rs-delivery`, Recent deliveries on `rs-hub`
- [ ] 2.3 Break each key rule on purpose, see its test go red, and restore
- [ ] 2.4 Log choices in Jack's section of `decided-while-building.md`; lint, `npm test`, `npm run test:browser`; self-review against the drawings and this spec
- [ ] 2.5 `/opsx:archive` as the last commit
