# Tasks: the sale helpers move to server/lib/sales.js

## 1. The move

- [x] 1.1 Write `tests/sales-lib-module.test.js` first: `sales.js` exports each helper and defines the private ones, `server.js` keeps no copy, and `sales.js` imports nothing from `server.js`. Watched it fail because `server/lib/sales.js` didn't exist and all eleven names were still defined in `server.js`
- [x] 1.2 Move the helpers verbatim. Checked that all 418 removed non-blank lines appear unchanged and in order in `sales.js`. The only new lines are the header, the imports and two section labels
- [x] 1.3 Import them in `server.js` and re-export the five names tests import. `tests/route-files-defined.test.js` caught an unused `AsyncLocalStorage` import, now removed. `route-files-defined`, `sales-lib-module` and `route-list` pass (10 tests), and `npm run lint` and `npm run typecheck` are clean
- [ ] 1.4 `npm test` and `npm run test:browser` pass. This Mac has no Docker or Postgres, so CI's run on the final commit is the evidence (it runs both against Postgres)
- [ ] 1.5 A fresh review confirms the move is pure and nothing references a name left behind

## Workflow follow-up

- Archive with `/opsx:archive` as the last commit, then merge once CI is green on it.
