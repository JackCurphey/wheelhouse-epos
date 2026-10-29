# Tasks

## 1. Server (pull request 1, `jack/unclosed-day`)

- [x] 1.1 Tests first: migration 106 from an empty scratch database and run twice (`tests/migration-106.test.js`); the routes (`tests/unclosed-day.test.js`: the morning's figure after a day nobody closed, Count it only, the count kept for that day, not after a closed day or before a shop's first close, the Owner's look at closing; Today's line until closed; Close it's figures, banking and report; each sale in exactly one close; cash taken out for the earlier day; today's close waits, oldest first; tonight's drawer less the cash banked; two closes at once keep one). Watch each fail
- [x] 1.2 Migration 106; `float-check.js`, `close-the-day.js`, `today.js`
- [x] 1.3 The route list snapshot, if it changes (it doesn't: no new paths)
- [x] 1.4 Break each key rule on purpose, see its test go red, and restore
- [ ] 1.5 Lint, typecheck, `npm test`; `/review` (migration, money) — lint, typecheck and tests done (#580); `/review` before merging

## 2. Screens (pull request 2, `jack/unclosed-day-screens`, stacked on 1)

- [x] 2.1 Tests first: the unclosed float check, Today's line with Close it, the earlier day's Close the day page at banking, and the waiting day shown first (`tests/screens/`); a browser spec. Watch each fail
- [x] 2.2 Build them to the drawings
- [x] 2.3 Break each key rule on purpose, see its test go red, and restore
- [ ] 2.4 Log choices in Jack's section of `decided-while-building.md`; lint, typecheck, `npm test`, `npm run test:browser`; `/review` — all done but `/review`, before merging
- [x] 2.5 `/opsx:archive` as the last commit
