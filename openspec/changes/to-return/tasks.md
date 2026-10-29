# Tasks

## 1. Server and screen (one pull request, `jack/to-return`)

- [x] 1.1 Tests first: migration 107 from an empty scratch database and run twice (`tests/migration-107.test.js`); the routes (`tests/to-return.test.js`: the Owner only; damaged and wrong items not returned, by supplier, the no-supplier group, missing left out, another shop's left out; Returned records who and when, changes no stock, 404 twice, for missing, or another shop's). Watch each fail
- [x] 1.2 Migration 107 and the routes, Returned locked
- [x] 1.3 The route list snapshot, the owner-only list
- [x] 1.4 Tests first: the sections, the lines' words, Returned, a refusal, none for Staff or with nothing to return (`tests/screens/to-return.test.js`); a browser spec. Watch each fail
- [x] 1.5 Build the section to `rs-hub`
- [x] 1.6 Break each key rule on purpose, see its test go red, and restore
- [x] 1.7 Log choices in Jack’s section of `decided-while-building.md`; lint, `npm test`, `npm run test:browser`; self-review against the drawing and this spec
- [x] 1.7a Review of #582: a list that can't be loaded says so; a refused Returned reads the list again; the waiting-longest order really tested; Returned's update only while not returned. Tests first, watched failing, each broken on purpose
- [ ] 1.8 `/opsx:archive` as the last commit
