# Tasks: the staff quote routes move to server/routes/workshop.js

## 1. The move

- [x] 1.1 Extend the tests first: `tests/workshop-jobs-module.test.js` (`jobs.js` exports `addApprovedLinesToOrder` and `answerAndAddToOrder`; `server.js` keeps no copy of them or of `publicBase`) and `tests/workshop-routes-file.test.js` (the six staff quote routes are registered in `server/routes/workshop.js`, none in `server.js`). Watched them fail (5 tests) because they were all still in `server.js`
- [x] 1.2 Move the helpers and routes verbatim. Every removed non-blank line appears unchanged in its new file, apart from `export` on the two helpers and the import lines; the six routes keep their order
- [x] 1.3 `route-files-defined` (which caught eight imports `server.js` no longer used, now removed), `route-list`, `workshop-jobs-module`, `workshop-routes-file` and the screen-trace check pass. Lint and typecheck don't cover these files (ESLint ignores them; `tsconfig.json` covers `src` only), so they prove nothing here
- [x] 1.4 `npm test` (1722 of 1722) and `npm run test:browser` (34 of 34) pass locally, against compose Postgres
- [x] 1.5 A fresh review confirmed the move is pure: same code, every name bound as before, no circular import, and no route shadowed by the new registration order. Its two wording points are fixed
