# Tasks

## 1. Server

- [ ] 1.1 Tests first: migration 102 from an empty scratch database and run twice (`tests/migration-102.test.js`); the routes (`tests/stock-warnings.test.js`: the setting, Owner only, whole pence, two saves at once; an adjustment's value at cost; over, at and under the amount; none set; up and down; decided when made; Today's line, oldest first; Seen by the Owner only, once; below zero's count and the counting take; each shop sees only its own). Watch each fail
- [ ] 1.2 Migration 102; `server/routes/stockroom-settings.js`; the value and mark in `products.js`; the lines in `today.js`; Seen
- [ ] 1.3 The route list snapshot, the owner-only list
- [ ] 1.4 Break each key rule on purpose, see its test go red, and restore

## 2. Screens

- [ ] 2.1 Tests first: the Stockroom room and its fold; Today's two lines, Seen, See them and Count them (`tests/screens/`); Stock opening with Below zero picked; a browser spec. Watch each fail
- [ ] 2.2 Build them to the drawings
- [ ] 2.3 Break each key rule on purpose, see its test go red, and restore
- [ ] 2.4 Log choices in Jack's section of `decided-while-building.md`; lint, typecheck, `npm test`, `npm run test:browser`
- [ ] 2.5 `/review` (migration, stock); CI by hand; `/opsx:archive` as the last commit (left to whoever opens the pull request)
