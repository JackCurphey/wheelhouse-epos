# Tasks

## 1. Server (pull request 1, `jack/opening-float-check`)

- [x] 1.1 Tests first: migration 095 from an empty scratch database and run twice (`tests/migration-095.test.js`); the routes (`tests/float-check.test.js`: the float set by the Owner only and in whole pence; today's check, first day, looked and counted; refused for someone who doesn't take payments, with no float, a look on the first day, a bad count; one a day, two at once keep one; a short float on Needs attention, Seen by the Owner only, over and earlier days not listed; each shop sees only its own). Watch each fail
- [x] 1.2 Migration 095, `server/routes/float-check.js`, the End of day route in `shop-settings.js`, the short float in `today.js`
- [x] 1.3 The route list snapshot, the owner-only list
- [x] 1.4 Break each key rule on purpose, see its test go red, and restore
- [x] 1.5 Lint, typecheck, the touched tests; `/review` (migration, money) — /review 26-27 Oct: one serious, fixed

## 2. Screens (pull request 2, `jack/opening-float-check-screens`, stacked on 1)

- [x] 2.1 Tests first: the float check pop-ups on the till, the Float fold, Today's short line (`tests/screens/`); a browser spec. Watch each fail
- [x] 2.2 Build them to the drawings
- [x] 2.3 Break each key rule on purpose, see its test go red, and restore
- [ ] 2.4 Log choices in Jack's section of `decided-while-building.md`; lint, typecheck, `npm test`, `npm run test:browser`; `/review`; `/opsx:archive` as the last commit
