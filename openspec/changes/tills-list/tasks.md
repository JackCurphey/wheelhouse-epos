# Tasks

## 1. Server and screen (two stacked pull requests: `jack/tills-list-server`, then `jack/tills-list`)

- [x] 1.1 Tests first: migration 104 from an empty scratch database and run twice (`tests/migration-104.test.js`); the routes (`tests/tills-list.test.js`: the Owner only; the list with who and when, only those switched on; rename, blank is none, over 60 refused, 404 for unknown or off; remove switches off, the browser stops being it, the number stays in use; refused while someone else is checked in). Watch each fail
- [x] 1.2 Migration 104, who registers in `POST /api/till-setup` and `/workshop`, the routes, each write locked
- [x] 1.3 The route list snapshot, the owner-only list
- [x] 1.4 Tests first: the rows, Rename's box, Remove asking first, Keep, Remove, a workshop computer's words, a refusal shown (`tests/screens/tills-list.test.js`); a browser spec. Watch each fail
- [x] 1.5 Build the screen to `set-till-tills-owner` and `set-till-remove`
- [x] 1.6 Break each key rule on purpose, see its test go red, and restore
- [x] 1.7 Log choices in Jack’s section of `decided-while-building.md`; lint, `npm test`, `npm run test:browser`; self-review against the drawings and this spec
- [ ] 1.8 `/opsx:archive` as the last commit
