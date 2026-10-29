# Tasks

## 1. Server

- [x] 1.1 Tests first: migration 102 from an empty scratch database and run twice (`tests/migration-102.test.js`); the routes (`tests/stock-warnings.test.js`: the setting, Owner only, whole pence, two saves at once; an adjustment's value at cost; over, at and under the amount; none set; up and down; decided when made; Today's line, oldest first; Seen by the Owner only, once; below zero's count and the counting take; each shop sees only its own). Watch each fail
- [x] 1.2 Migration 102; the Stockroom settings routes in `server/routes/shop-settings.js`, beside the float's; the value and mark in `products.js`; the lines in `today.js`; Seen
- [x] 1.3 The route list snapshot, the owner-only list
- [x] 1.4 Break each key rule on purpose, see its test go red, and restore

## 2. Screens

- [x] 2.1 Tests first: the Stockroom room and its fold; Today's two lines, Seen, See them and Count them (`tests/screens/`); Stock opening with Below zero picked; a browser spec. Watch each fail
- [x] 2.2 Build them to the drawings
- [x] 2.3 Break each key rule on purpose, see its test go red, and restore
- [ ] 2.4 Log choices in Jack's section of `decided-while-building.md`; lint, typecheck, `npm test`, `npm run test:browser`
- [ ] 2.5 `/review` (migration, stock); CI by hand; `/opsx:archive` as the last commit (left to whoever opens the pull request)
