# Tasks

## 1. Server (pull request 1, `jack/till-setup`)

- [x] 1.1 Tests first: migration 100 from an empty scratch database and run twice (`tests/migration-100.test.js`); the routes (`tests/till-setup.test.js`: the Owner only; the shop's sites and taken numbers; Make this computer a till sets the cookie and stores only its hash; already a till; a number in use; a blank name; a check-in counts only on its till; Checked in today per till; the float check records its till; Today's Tills a line per till; another shop's till is no till). Watch each fail
- [x] 1.2 Migration 100, `server/till/this-till.js`, the routes
- [x] 1.3 The route list snapshot, the owner-only list
- [x] 1.4 Break each key rule on purpose, see its test go red, and restore
- [x] 1.5 Lint, typecheck, the touched tests, `npm test`, `npm run test:browser`

## 2. Screens (pull request 2, `jack/till-setup-screens`, stacked on 1)

- [x] 2.1 Tests first: Set up this till (pills, In use, the button's words, a refusal), Settings' Tills fold, the till's name on the till, the float check's pop-ups and Today's Tills lines and short float (`tests/screens/`); a browser spec. Watch each fail
- [x] 2.2 Build them to the drawings
- [x] 2.3 Break each key rule on purpose, see its test go red, and restore
- [ ] 2.4 Log choices in Jack’s section of `decided-while-building.md`, updating the stand-ins this replaces (done, 28 Oct); lint, typecheck, `npm test`, the browser specs (done, 28 Oct); `/review` (not run yet)
- [ ] 2.5 `/opsx:archive` as the last commit
